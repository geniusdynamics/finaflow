// ABOUTME: Verifies BusinessDetails profile summary and documents metadata sections are rendered.
// ABOUTME: Ensures secure download affordance is visible in the profile documents table output.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BusinessDetails } from "../BusinessDetails";

vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: "1" }),
  };
});

vi.mock("@/providers/trpc", () => ({
  trpc: {
    useUtils: () => ({
      businesses: {
        get: {
          invalidate: vi.fn(),
        },
      },
    }),
    businesses: {
      get: {
        useQuery: () => ({
          data: {
            id: 1,
            name: "Acme Foods",
            accountId: "ACME123",
            isActive: true,
            businessType: "Private Limited Company",
            country: "Kenya",
            county: "Nairobi City",
            subCounty: "Westlands",
            address: "Riverside",
            businessRegNumber: "BRN-111",
            phone: "+254700000000",
            natureOfBusiness: "Hospitality",
            kraPin: "P051111111A",
            email: "info@acme.test",
            plan: "pro",
          },
          isLoading: false,
        }),
      },
      getDocuments: {
        useQuery: () => ({
          data: [],
          refetch: vi.fn(),
        }),
      },
      getDocumentsDetailed: {
        useQuery: () => ({
          data: [
            {
              id: 7,
              fileName: "tax-certificate.pdf",
              documentType: "Tax Compliance Certificate",
              mimeType: "application/pdf",
              uploadedBy: 10,
              createdAt: "2026-05-09T08:00:00.000Z",
              fileSizeBytes: 1536,
            },
          ],
          isLoading: false,
        }),
      },
      update: {
        useMutation: () => ({
          mutateAsync: vi.fn(),
        }),
      },
      uploadDocument: {
        useMutation: () => ({
          mutateAsync: vi.fn(),
        }),
      },
      deleteDocument: {
        useMutation: () => ({
          mutateAsync: vi.fn(),
        }),
      },
      downloadDocument: {
        useMutation: () => ({
          mutateAsync: vi.fn(),
          isPending: false,
        }),
      },
    },
  },
}));

describe("BusinessDetails profile view", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders profile summary and documents metadata table", () => {
    const html = renderToStaticMarkup(React.createElement(BusinessDetails));

    expect(html).toContain("Business Details");
    expect(html).toContain("Profile Summary");
    expect(html).toContain("Business Name");
    expect(html).toContain("Acme Foods");
    expect(html).toContain("Business Documents");
    expect(html).toContain("tax-certificate.pdf");
    expect(html).toContain("1.5 KB");
    expect(html).toContain("Download");
  });

  it("renders print action and generated metadata block", () => {
    const html = renderToStaticMarkup(React.createElement(BusinessDetails));

    expect(html).toContain("Print Profile");
    expect(html).toContain("Generated");
    expect(html).toContain("Account ACME123");
  });
});
