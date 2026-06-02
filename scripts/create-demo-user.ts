// ABOUTME: Creates a fresh user account from scratch using the tRPC caller directly.
import "./patch-db";
import { getDb } from "../api/queries/connection";
import { localAuthRouter } from "../api/local-auth-router";


const DEMO_INPUT = {
  name: "GENIUS Owner",
  username: "genius",
  email: "genius@finaflow.app",
  password: "Password123!",
  accountName: "GENIUS",
  businessName: "GENIUS Corp",
  userType: "standard" as const,
  phone: "+254700000000",
  createDemo: false,
};

async function main() {
  const db = getDb();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = { db } as any;

  const caller = localAuthRouter.createCaller(ctx);

  try {
    const result = await caller.register(DEMO_INPUT);
    console.log("✓ User registered successfully!");
    console.log(JSON.stringify({
      userId: result.user.id,
      username: result.user.username,
      businessId: result.user.currentBusinessId,
      businessName: result.user.currentBusiness?.name,
      role: result.user.role,
      accountId: result.user.accountId,
    }, null, 2));
    console.log("\nToken (first 50 chars):", result.token.substring(0, 50) + "...");
    console.log("CSRF Token:", result.csrfToken?.substring(0, 20) + "...");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    if (e.code === "CONFLICT" || e.message?.includes("already taken")) {
      console.log("Note: User may already exist. Error:", e.message);
    } else {
      console.error("Registration error:", e.message || e);
    }
  } finally {
    process.exit(0);
  }
}

main();
