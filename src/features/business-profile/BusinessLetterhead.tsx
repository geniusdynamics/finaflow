// ABOUTME: Renders a reusable business letterhead block for printable profile and document views.
// ABOUTME: Displays branding, account identity, and generated timestamp with optional logo support.
type BusinessLetterheadBusiness = {
  name: string;
  accountId: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  county?: string | null;
  subCounty?: string | null;
};

type BusinessLetterheadLogo = {
  mimeType: string;
  fileData: string;
} | null;

export type BusinessLetterheadProps = {
  business: BusinessLetterheadBusiness;
  logo: BusinessLetterheadLogo;
  generatedAt: Date;
};

function fallback(value?: string | null): string {
  return value && value.trim().length > 0 ? value : "—";
}

function locationLine(business: BusinessLetterheadBusiness): string {
  return [business.address, business.subCounty, business.county].filter(Boolean).join(", ") || "—";
}

export function BusinessLetterhead({ business, logo, generatedAt }: BusinessLetterheadProps) {
  return (
    <header className="mb-4 border-b border-[#E8E0D8] pb-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {logo ? (
            <img
              src={`data:${logo.mimeType};base64,${logo.fileData}`}
              alt="Business logo"
              className="h-14 w-auto max-w-[160px] object-contain"
            />
          ) : null}
          <div>
            <h2 className="font-serif text-lg font-semibold text-[#2D2A26]">{business.name}</h2>
            <p className="text-xs text-[#8D8A87]">Account {business.accountId}</p>
          </div>
        </div>
        <div className="text-right text-xs text-[#8D8A87]">
          <p>{fallback(business.phone)}</p>
          <p>{fallback(business.email)}</p>
          <p>{locationLine(business)}</p>
          <p>{generatedAt.toLocaleString("en-KE")}</p>
        </div>
      </div>
    </header>
  );
}
