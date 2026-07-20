import { describe, it, expect, beforeAll } from "vitest";

let app: Awaited<ReturnType<typeof import("../boot")>["default"]>;

beforeAll(async () => {
  process.env.NODE_ENV = "development";
  const mod = await import("../boot");
  app = mod.default;
}, 120_000);

describe("documentation pages", () => {
  describe("GET /docs", () => {
    it("returns HTML with the navigation header", async () => {
      const res = await app.fetch(new Request("http://localhost/docs"));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");

      const html = await res.text();
      expect(html).toContain("FinaFlow Documentation");
      expect(html).toContain('href="/"');
      expect(html).toContain('href="/docs"');
      expect(html).toContain('href="/docs/api"');
      expect(html).toContain('href="/dashboard"');
    });

    it("links to the API reference, authentication, and webhooks guides", async () => {
      const res = await app.fetch(new Request("http://localhost/docs"));
      const html = await res.text();
      expect(html).toContain('href="/docs/api"');
      expect(html).toContain('href="/docs/authentication"');
      expect(html).toContain('href="/docs/webhooks"');
    });

    it("has a documentation card structure", async () => {
      const res = await app.fetch(new Request("http://localhost/docs"));
      const html = await res.text();
      expect(html).toContain("API Reference");
      expect(html).toContain("Authentication");
      expect(html).toContain("Webhooks");
      expect(html).toContain("Interactive");
    });
  });

  describe("GET /docs/api", () => {
    it("returns HTML with Scalar API reference", async () => {
      const res = await app.fetch(new Request("http://localhost/docs/api"));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");

      const html = await res.text();
      expect(html).toContain("FinaFlow API Reference");
      expect(html).toContain("api-reference");
      expect(html).toContain("cdn.jsdelivr.net/npm/@scalar/api-reference");
    });

    it("includes the navigation header with correct links", async () => {
      const res = await app.fetch(new Request("http://localhost/docs/api"));
      const html = await res.text();
      expect(html).toContain('href="/"');
      expect(html).toContain('href="/docs"');
      expect(html).toContain('href="/docs/api"');
      expect(html).toContain('href="/dashboard"');
    });

    it("references the openapi.yaml spec", async () => {
      const res = await app.fetch(new Request("http://localhost/docs/api"));
      const html = await res.text();
      expect(html).toContain("/openapi.yaml");
    });

    it("has the API link highlighted as active", async () => {
      const res = await app.fetch(new Request("http://localhost/docs/api"));
      const html = await res.text();
      expect(html).toContain("color:#C73E1D");
    });
  });

  describe("GET /docs/authentication", () => {
    it("returns HTML with authentication content", async () => {
      const res = await app.fetch(new Request("http://localhost/docs/authentication"));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");

      const html = await res.text();
      expect(html).toContain("Authentication");
      expect(html).toContain("API key");
      expect(html).toContain("Scopes");
    });

    it("includes the navigation header", async () => {
      const res = await app.fetch(new Request("http://localhost/docs/authentication"));
      const html = await res.text();
      expect(html).toContain('href="/"');
      expect(html).toContain('href="/docs"');
      expect(html).toContain('href="/docs/api"');
      expect(html).toContain('href="/dashboard"');
    });

    it("has a breadcrumb back to documentation", async () => {
      const res = await app.fetch(new Request("http://localhost/docs/authentication"));
      const html = await res.text();
      expect(html).toContain('href="/docs"');
      expect(html).toContain("Documentation");
    });
  });

  describe("GET /docs/webhooks", () => {
    it("returns HTML with webhooks content", async () => {
      const res = await app.fetch(new Request("http://localhost/docs/webhooks"));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");

      const html = await res.text();
      expect(html).toContain("Webhooks");
      expect(html).toContain("HMAC");
      expect(html).toContain("X-Fina-Signature");
    });

    it("includes the navigation header", async () => {
      const res = await app.fetch(new Request("http://localhost/docs/webhooks"));
      const html = await res.text();
      expect(html).toContain('href="/"');
      expect(html).toContain('href="/docs"');
      expect(html).toContain('href="/docs/api"');
      expect(html).toContain('href="/dashboard"');
    });

    it("documents all webhook events", async () => {
      const res = await app.fetch(new Request("http://localhost/docs/webhooks"));
      const html = await res.text();
      expect(html).toContain("sale.recorded");
      expect(html).toContain("expense.created");
      expect(html).toContain("bill.paid");
      expect(html).toContain("coa.updated");
      expect(html).toContain("supplier.updated");
      expect(html).toContain("journal.created");
    });
  });

  describe("GET /openapi.yaml", () => {
    it("returns the OpenAPI spec", async () => {
      const res = await app.fetch(new Request("http://localhost/openapi.yaml"));
      expect(res.status).toBe(200);

      const text = await res.text();
      expect(text).toContain("openapi: 3.1.0");
      expect(text).toContain("FinaFlow Integration API");
      expect(text).toContain("/verify");
      expect(text).toContain("/accounts");
      expect(text).toContain("/suppliers");
      expect(text).toContain("/daily-sales");
      expect(text).toContain("/webhooks/finabill");
    });

    it("documents the webhook event catalog", async () => {
      const res = await app.fetch(new Request("http://localhost/openapi.yaml"));
      const text = await res.text();
      expect(text).toContain("saleRecorded");
      expect(text).toContain("expenseCreated");
      expect(text).toContain("billPaid");
    });
  });

  describe("navigation consistency", () => {
    it("all doc pages share the same nav structure", async () => {
      const paths = ["/docs", "/docs/api", "/docs/authentication", "/docs/webhooks"];
      const navChecks = ['href="/"', 'href="/docs"', 'href="/docs/api"', 'href="/dashboard"'];

      for (const path of paths) {
        const res = await app.fetch(new Request(`http://localhost${path}`));
        expect(res.status).toBe(200);
        const html = await res.text();
        for (const check of navChecks) {
          expect(html, `${path} missing nav link: ${check}`).toContain(check);
        }
      }
    });
  });
});
