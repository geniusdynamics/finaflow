// ABOUTME: Verifies account-level business limits and per-business branch limits are enforced through the shared subscription guard.
// ABOUTME: Exercises the real tRPC callers so business and location creation stay aligned with the active subscription contract.
import { beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "../router";
import { getDb } from "../queries/connection";

type Row = { id: number };

