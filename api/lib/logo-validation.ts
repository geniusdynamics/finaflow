// ABOUTME: Central validation rules for uploaded business logos.
// ABOUTME: Shared by API procedures and tests for MIME and payload-size checks.
export const ALLOWED_LOGO_MIME_TYPES = ["image/jpeg", "image/png", "image/svg+xml"] as const;

export const MAX_LOGO_BYTES = 5 * 1024 * 1024;

type AllowedLogoMimeType = (typeof ALLOWED_LOGO_MIME_TYPES)[number];

export function assertAllowedLogoMimeType(mimeType: string): void {
  if (!ALLOWED_LOGO_MIME_TYPES.includes(mimeType as AllowedLogoMimeType)) {
    throw new Error("Unsupported logo format. Allowed: JPEG, PNG, SVG.");
  }
}

export function assertLogoMaxSize(sizeBytes: number): void {
  if (sizeBytes > MAX_LOGO_BYTES) {
    throw new Error("Logo exceeds 5MB maximum size.");
  }
}
