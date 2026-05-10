// ABOUTME: Verifies BusinessLetterhead output for printable business identity content.
// ABOUTME: Protects rendering contract for business name and account metadata in letterheads.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BusinessLetterhead } from "../BusinessLetterhead";

describe("BusinessLetterhead", () => {
  it("renders name and account line", () => {
    const html = renderToStaticMarkup(
      <BusinessLetterhead
        business={{
          name: "Acme Traders",
          accountId: "ACME123",
          phone: "+254700000000",
          email: "info@acme.com",
          address: "Nairobi",
          county: "Nairobi City",
          subCounty: "Westlands",
        }}
        logo={null}
        generatedAt={new Date("2026-05-09T10:00:00.000Z")}
      />
    );

    expect(html).toContain("Acme Traders");
    expect(html).toContain("Account ACME123");
  });
});
