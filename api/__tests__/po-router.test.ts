// ABOUTME: Verifies the purchase-order router can be imported into the app router in dev and test environments.
// ABOUTME: Prevents broken middleware wiring from crashing the entire API mount and returning HTML for JSON calls.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { poRouter } from "../po-router";
import { appRouter } from "../router";

describe("purchase order router wiring", () => {
  it("exports a router definition that can be mounted into the app router", () => {
    expect(poRouter).toBeTruthy();
    expect(appRouter).toBeTruthy();
  });

  it("uses shared permission-scoped procedures instead of createRouter.procedure", () => {
    const source = fs.readFileSync(path.resolve(import.meta.dirname, "../po-router.ts"), "utf8");

    expect(source).not.toContain("createRouter.procedure.use");
  });
});
