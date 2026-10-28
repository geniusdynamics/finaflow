// ABOUTME: Tests for party grouping across reference codes, prefixes and repeated names.
// ABOUTME: Pins the BAMBURI/ALPHA-style consolidation used by the analysis and exports.

import { describe, expect, it } from "vitest";
import { groupContacts, normalisePartyName } from "../group";

const row = (name: string, total: string) => ({ name, count: 1, total, average: total });

describe("party grouping", () => {
  it("groups the same party despite leading prefixes and trailing references", () => {
    const grouped = groupContacts([
      row("G BAMBURI CE MENT PUBLIC LIMITED FT2604", "155000.00"),
      row("Y BAMBURI CE MENT PUBLIC LIMITED FT2604", "155000.00"),
      row("H BAMBURI CE MENT PUBLIC LIMITED FT2604", "155000.00"),
      row("G ALPHA META LS", "1000.00"),
      row("T ALPHA META LS", "2000.00"),
      row("ALPHA META LS FT262591KTST", "3000.00"),
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped[0]).toMatchObject({
      name: "BAMBURI CE MENT PUBLIC LIMITED",
      count: 3,
      total: "465000.00",
      members: 3,
    });
    expect(grouped[1]).toMatchObject({
      name: "ALPHA META LS",
      count: 3,
      total: "6000.00",
      members: 3,
    });
  });

  it("collapses transaction-reference variants onto the printed party name", () => {
    const grouped = groupContacts([
      row("COAST META LS TRADERS LIMITED F T26083", "500000.00"),
      row("COAST META LS TRADERS LIMITED F T26125", "500000.00"),
      row("COAST META LS TRADERS LIMITED F T26156", "500000.00"),
      row("COAST META LS TRADERS LIMITED F T26160", "500000.00"),
      row("COAST META LS TRADERS LIMITED F T26250", "500000.00"),
      row("COAST META LS TRADERS LIMITED F T26282", "500000.00"),
      row("COAST META LS TRADERS LIMITED F T26285", "500000.00"),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({
      name: "COAST META LS TRADERS LIMITED",
      count: 7,
      total: "3500000.00",
    });
  });

  it("groups cash withdrawal narrations under the operation head", () => {
    const exact = [
      row("CASH WITHDRAWAL CHQ2 S TOCK PURCHASE AT-T WNCTR416", "900000.00"),
      row("CASH WITHDRAWAL CHQ10 8 BUSINESS RESTOCKI NG AT-TW", "450000.00"),
    ];
    const grouped = groupContacts(exact);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({ name: "CASH WITHDRAWAL", count: 2, total: "1350000.00" });
    expect(grouped[0].aliases).toEqual(exact.map((item) => item.name).sort());
    // The exact-name report keeps every narration untouched.
    expect(exact[0].name).toBe("CASH WITHDRAWAL CHQ2 S TOCK PURCHASE AT-T WNCTR416");
  });

  it("leaves names without a removable prefix alone", () => {
    expect(normalisePartyName("MEGHA MAR KETING EA LIMITED")).toBe("MEGHA MAR KETING EA LIMITED");
    expect(normalisePartyName("APEX STEEL LIMITED")).toBe("APEX STEEL LIMITED");
  });

  it("does not merge different parties", () => {
    const grouped = groupContacts([row("BAMBURI CE MENT", "100.00"), row("BAMBURI CEMENT", "200.00")]);
    expect(grouped).toHaveLength(2);
  });
});
