import { describe, expect, it } from "vitest";
import * as BusinessDetailsModule from "../BusinessDetails";

describe("BusinessDetails page exports", () => {
  it("provides named BusinessDetails export for lazy route mapping", () => {
    expect(typeof BusinessDetailsModule.BusinessDetails).toBe("function");
  });
});
