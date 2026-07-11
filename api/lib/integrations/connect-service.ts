// ABOUTME: First-party Fina Connect protocol for mutual app pairing (FinaFlow <-> FinaBill).
// ABOUTME: Creates short-lived sessions, exchanges API keys, and upserts sibling connections.
import crypto from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../../queries/connection";
import {
  apiKeys,
  integrationConnections,
  integrationConnectSessions,
} from "@db/schema";
import { env } from "../env";
import { encryptString, decryptString } from "../crypto";
import { generateApiKey, getKeyPrefix, hashApiKey } from "../api-key-auth";

export const DEFAULT_CONNECT_SCOPES = [
  "read",
  "write",
  "journal:write",
  "coa:read",
  "supplier:read",
  "webhooks",
  "admin",
  "sales:write",
] as const;

const SESSION_TTL_MS = 10 * 60 * 1000;
const SYSTEM = "finaflow" as const;
const SIBLING = "finabill" as const;

function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

function generatePairingCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i]! % alphabet.length];
  return `FINA-${out.slice(0, 4)}-${out.slice(4)}`;
}

function hashCode(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function createInboundApiKey(
  businessId: number,
  name: string,
  scopes: string[]
): Promise<{ id: number; key: string; prefix: string }> {
  const db = getDb();
  const rawKey = generateApiKey();
  const prefix = getKeyPrefix(rawKey);
  const keyHash = await hashApiKey(rawKey, env.bcryptRounds);
  const [row] = await db
    .insert(apiKeys)
    .values({
      businessId,
      name,
      keyHash,
      keyPrefix: prefix,
      scopes,
      isActive: true,
    } as any)
    .returning();
  return { id: row.id, key: rawKey, prefix };
}

export async function upsertSiblingConnection(input: {
  businessId: number;
  targetSystem: string;
  targetUrl: string;
  apiKey: string;
  webhookSecret?: string | null;
  scopes?: string[];
}): Promise<{ id: number }> {
  const db = getDb();
  const now = new Date();
  const [existing] = await db
    .select()
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.businessId, input.businessId),
        eq(integrationConnections.targetSystem, input.targetSystem),
        isNull(integrationConnections.deletedAt)
      )
    )
    .limit(1);

  const authData: Record<string, unknown> = {
    url: input.targetUrl.replace(/\/$/, ""),
    apiKey: encryptString(input.apiKey),
    scopes: input.scopes ?? [...DEFAULT_CONNECT_SCOPES],
  };

  if (existing) {
    const [updated] = await db
      .update(integrationConnections)
      .set({
        authMode: "api_key",
        authData,
        webhookSecret: input.webhookSecret ? encryptString(input.webhookSecret) : existing.webhookSecret,
        isActive: true,
        updatedAt: now,
        deletedAt: null,
      })
      .where(eq(integrationConnections.id, existing.id))
      .returning();
    return { id: updated.id };
  }

  const [created] = await db
    .insert(integrationConnections)
    .values({
      businessId: input.businessId,
      targetSystem: input.targetSystem,
      authMode: "api_key",
      authData,
      webhookSecret: input.webhookSecret ? encryptString(input.webhookSecret) : null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return { id: created.id };
}

export async function createConnectSession(input: {
  businessId: number;
  userId: number;
  scopes?: string[];
}) {
  const db = getDb();
  const pairingCode = generatePairingCode();
  const sessionPublicId = randomToken(18);
  const state = randomToken(24);
  const codeVerifier = randomToken(32);
  const codeChallenge = hashCode(codeVerifier);
  const scopes = input.scopes?.length ? input.scopes : [...DEFAULT_CONNECT_SCOPES];
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const partnerAppUrl = env.finabillAppUrl.replace(/\/$/, "");
  const partnerApiUrl = env.finabillApiUrl.replace(/\/$/, "");
  const initiatorAppUrl = env.appUrl.replace(/\/$/, "");
  const initiatorApiUrl = env.apiUrl.replace(/\/$/, "");

  await db.insert(integrationConnectSessions).values({
    sessionPublicId,
    initiatorSystem: SYSTEM,
    partnerSystem: SIBLING,
    initiatorBusinessId: input.businessId,
    partnerBusinessId: null,
    codeHash: hashCode(pairingCode),
    codePrefix: pairingCode.slice(0, 9),
    state,
    codeChallenge,
    redirectUri: `${initiatorAppUrl}/integrations/connect/callback`,
    scopes,
    status: "pending",
    initiatorApiUrl,
    initiatorAppUrl,
    partnerApiUrl,
    partnerAppUrl,
    exchangePayload: { codeVerifier },
    createdByUserId: input.userId,
    expiresAt,
  });

  const authorizeUrl =
    `${partnerAppUrl}/integrations/connect` +
    `?session=${encodeURIComponent(sessionPublicId)}` +
    `&state=${encodeURIComponent(state)}` +
    `&code_challenge=${encodeURIComponent(codeChallenge)}` +
    `&initiator_api=${encodeURIComponent(initiatorApiUrl)}` +
    `&initiator_app=${encodeURIComponent(initiatorAppUrl)}` +
    `&initiator_system=${SYSTEM}` +
    `&partner_system=${SIBLING}`;

  return {
    sessionPublicId,
    pairingCode,
    state,
    codeVerifier,
    authorizeUrl,
    expiresAt,
    partnerAppUrl,
    partnerApiUrl,
  };
}

export async function getConnectSessionPublic(sessionPublicId: string) {
  const db = getDb();
  const [session] = await db
    .select()
    .from(integrationConnectSessions)
    .where(eq(integrationConnectSessions.sessionPublicId, sessionPublicId))
    .limit(1);

  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now() && session.status === "pending") {
    await db
      .update(integrationConnectSessions)
      .set({ status: "expired", updatedAt: new Date() })
      .where(eq(integrationConnectSessions.id, session.id));
    return { ...session, status: "expired" as const };
  }

  return {
    sessionPublicId: session.sessionPublicId,
    initiatorSystem: session.initiatorSystem,
    partnerSystem: session.partnerSystem,
    status: session.status,
    scopes: session.scopes,
    expiresAt: session.expiresAt,
    initiatorApiUrl: session.initiatorApiUrl,
    initiatorAppUrl: session.initiatorAppUrl,
    partnerApiUrl: session.partnerApiUrl,
    partnerAppUrl: session.partnerAppUrl,
    state: session.state,
    codeChallenge: session.codeChallenge,
  };
}

export async function getConnectSessionStatus(sessionPublicId: string, businessId: number) {
  const db = getDb();
  const [session] = await db
    .select()
    .from(integrationConnectSessions)
    .where(eq(integrationConnectSessions.sessionPublicId, sessionPublicId))
    .limit(1);
  if (!session) return null;
  if (session.initiatorBusinessId !== businessId) return null;
  return {
    sessionPublicId: session.sessionPublicId,
    status: session.status,
    expiresAt: session.expiresAt,
    partnerBusinessId: session.partnerBusinessId,
  };
}

export async function partnerApproveSession(input: {
  sessionPublicId: string;
  state: string;
  partnerBusinessId: number;
  partnerApiUrl: string;
  partnerAppUrl: string;
  partnerApiKey: string;
  webhookSecret: string;
  scopes?: string[];
  approvedByUserId?: number;
}) {
  const db = getDb();
  const [session] = await db
    .select()
    .from(integrationConnectSessions)
    .where(eq(integrationConnectSessions.sessionPublicId, input.sessionPublicId))
    .limit(1);

  if (!session) throw new Error("Connect session not found");
  if (session.status !== "pending") throw new Error(`Session is ${session.status}`);
  if (session.expiresAt.getTime() < Date.now()) {
    await db
      .update(integrationConnectSessions)
      .set({ status: "expired", updatedAt: new Date() })
      .where(eq(integrationConnectSessions.id, session.id));
    throw new Error("Connect session expired");
  }
  if (session.state !== input.state) throw new Error("Invalid connect state");

  const authCode = randomToken(24);
  const existingPayload =
    session.exchangePayload && typeof session.exchangePayload === "object"
      ? (session.exchangePayload as Record<string, unknown>)
      : {};

  // Prefer the partner URL we already know (env/session) over a frontend origin the partner may mis-report.
  const resolvedPartnerApiUrl = (
    session.partnerApiUrl ||
    env.finabillApiUrl ||
    input.partnerApiUrl
  ).replace(/\/$/, "");
  const resolvedPartnerAppUrl = (
    session.partnerAppUrl ||
    env.finabillAppUrl ||
    input.partnerAppUrl
  ).replace(/\/$/, "");

  await db
    .update(integrationConnectSessions)
    .set({
      status: "approved",
      partnerBusinessId: input.partnerBusinessId,
      partnerApiUrl: resolvedPartnerApiUrl,
      partnerAppUrl: resolvedPartnerAppUrl,
      approvedByUserId: input.approvedByUserId ?? null,
      codeHash: hashCode(authCode),
      codePrefix: authCode.slice(0, 8),
      exchangePayload: {
        ...existingPayload,
        partnerApiKey: encryptString(input.partnerApiKey),
        webhookSecret: encryptString(input.webhookSecret),
        partnerScopes: input.scopes ?? session.scopes ?? [...DEFAULT_CONNECT_SCOPES],
        reportedPartnerApiUrl: input.partnerApiUrl.replace(/\/$/, ""),
      },
      updatedAt: new Date(),
    })
    .where(eq(integrationConnectSessions.id, session.id));

  return {
    authorizationCode: authCode,
    redirectUri: session.redirectUri,
    state: session.state,
    sessionPublicId: session.sessionPublicId,
  };
}

export async function exchangeConnectSession(input: {
  sessionPublicId: string;
  authorizationCode: string;
  codeVerifier?: string;
  businessId: number;
  userId: number;
}) {
  const db = getDb();
  const [session] = await db
    .select()
    .from(integrationConnectSessions)
    .where(eq(integrationConnectSessions.sessionPublicId, input.sessionPublicId))
    .limit(1);

  if (!session) throw new Error("Connect session not found");
  if (session.initiatorBusinessId !== input.businessId) {
    throw new Error("Session does not belong to this business");
  }
  if (session.status !== "approved") throw new Error(`Session is ${session.status}, expected approved`);
  if (session.expiresAt.getTime() < Date.now()) {
    await db
      .update(integrationConnectSessions)
      .set({ status: "expired", updatedAt: new Date() })
      .where(eq(integrationConnectSessions.id, session.id));
    throw new Error("Connect session expired");
  }
  if (hashCode(input.authorizationCode) !== session.codeHash) {
    throw new Error("Invalid authorization code");
  }

  const payload =
    session.exchangePayload && typeof session.exchangePayload === "object"
      ? (session.exchangePayload as Record<string, unknown>)
      : {};

  if (session.codeChallenge && input.codeVerifier) {
    if (hashCode(input.codeVerifier) !== session.codeChallenge) {
      throw new Error("Invalid code verifier");
    }
  }

  const partnerApiKeyEnc = payload.partnerApiKey;
  const webhookSecretEnc = payload.webhookSecret;
  if (typeof partnerApiKeyEnc !== "string" || typeof webhookSecretEnc !== "string") {
    throw new Error("Partner credentials missing from session");
  }

  const partnerApiKey = decryptString(partnerApiKeyEnc);
  const webhookSecret = decryptString(webhookSecretEnc);
  const scopes = Array.isArray(payload.partnerScopes)
    ? (payload.partnerScopes as string[])
    : [...DEFAULT_CONNECT_SCOPES];

  const partnerApiUrl = (session.partnerApiUrl || env.finabillApiUrl).replace(/\/$/, "");
  if (!partnerApiUrl) throw new Error("Partner API URL missing");
  const selfApi = env.apiUrl.replace(/\/$/, "");
  if (partnerApiUrl === selfApi) {
    throw new Error(
      `Partner API URL points at this app (${partnerApiUrl}). Set FINABILL_API_URL on FinaFlow and API_URL on FinaBill to the backend origins.`
    );
  }

  const inbound = await createInboundApiKey(
    input.businessId,
    `FinaBill connect ${new Date().toISOString().slice(0, 10)}`,
    scopes
  );

  const connection = await upsertSiblingConnection({
    businessId: input.businessId,
    targetSystem: SIBLING,
    targetUrl: partnerApiUrl,
    apiKey: partnerApiKey,
    webhookSecret,
    scopes,
  });

  const completeRes = await fetch(`${partnerApiUrl}/api/connect/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionPublicId: session.sessionPublicId,
      partnerBusinessId: session.partnerBusinessId,
      initiatorSystem: SYSTEM,
      initiatorBusinessId: input.businessId,
      initiatorApiUrl: env.apiUrl.replace(/\/$/, ""),
      initiatorAppUrl: env.appUrl.replace(/\/$/, ""),
      initiatorApiKey: inbound.key,
      webhookSecret,
      scopes,
    }),
  });

  if (!completeRes.ok) {
    const text = await completeRes.text();
    throw new Error(`Partner complete failed: ${completeRes.status} ${text}`);
  }

  await db
    .update(integrationConnectSessions)
    .set({
      status: "exchanged",
      exchangePayload: {
        ...payload,
        partnerApiKey: "[redacted]",
        webhookSecret: "[redacted]",
        initiatorApiKeyId: inbound.id,
        connectionId: connection.id,
      },
      updatedAt: new Date(),
    })
    .where(eq(integrationConnectSessions.id, session.id));

  return {
    success: true,
    connectionId: connection.id,
    targetSystem: SIBLING,
    bootstrap: { ok: true },
  };
}

export async function completeReverseConnection(input: {
  partnerBusinessId: number;
  initiatorSystem: string;
  initiatorApiUrl: string;
  initiatorApiKey: string;
  webhookSecret: string;
  scopes?: string[];
}) {
  const connection = await upsertSiblingConnection({
    businessId: input.partnerBusinessId,
    targetSystem: input.initiatorSystem,
    targetUrl: input.initiatorApiUrl,
    apiKey: input.initiatorApiKey,
    webhookSecret: input.webhookSecret,
    scopes: input.scopes,
  });
  return { success: true, connectionId: connection.id };
}

export async function approveAsPartner(input: {
  initiatorApiUrl: string;
  initiatorSystem?: string;
  sessionPublicId: string;
  state: string;
  businessId: number;
  userId: number;
  scopes?: string[];
}) {
  const scopes = input.scopes?.length ? input.scopes : [...DEFAULT_CONNECT_SCOPES];
  const inbound = await createInboundApiKey(
    input.businessId,
    `FinaBill connect ${new Date().toISOString().slice(0, 10)}`,
    scopes
  );
  const webhookSecret = randomToken(32);
  const partnerApiUrl = env.apiUrl.replace(/\/$/, "");
  const partnerAppUrl = env.appUrl.replace(/\/$/, "");

  const res = await fetch(
    `${input.initiatorApiUrl.replace(/\/$/, "")}/api/connect/partner-approve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionPublicId: input.sessionPublicId,
        state: input.state,
        partnerBusinessId: input.businessId,
        partnerApiUrl,
        partnerAppUrl,
        partnerApiKey: inbound.key,
        webhookSecret,
        scopes,
        approvedByUserId: input.userId,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Partner approve failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    authorizationCode: string;
    redirectUri: string | null;
    state: string;
    sessionPublicId: string;
  };

  return {
    ...data,
    webhookSecret,
    localApiKeyId: inbound.id,
  };
}

export async function resolvePairingCodeOnInitiator(pairingCode: string) {
  const db = getDb();
  const prefix = pairingCode.slice(0, 9);
  const candidates = await db
    .select()
    .from(integrationConnectSessions)
    .where(eq(integrationConnectSessions.codePrefix, prefix));

  for (const session of candidates) {
    if (session.status !== "pending") continue;
    if (session.expiresAt.getTime() < Date.now()) continue;
    if (hashCode(pairingCode) === session.codeHash) {
      return getConnectSessionPublic(session.sessionPublicId);
    }
  }
  return null;
}
