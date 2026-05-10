// ABOUTME: Utilities for business document metadata and download-safe naming.
// ABOUTME: Keeps router logic focused on access control and persistence concerns.

export function base64SizeBytes(base64: string): number {
  const cleaned = (base64 || "").replace(/\s/g, "");
  if (!cleaned) {
    return 0;
  }

  const padding = cleaned.endsWith("==") ? 2 : cleaned.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((cleaned.length * 3) / 4) - padding);
}

export function sanitizeDownloadFileName(fileName: string): string {
  const baseName = (fileName || "document.bin").split(/[\\/]/).pop() || "document.bin";
  const cleaned = baseName
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "");

  return cleaned || "document.bin";
}

export function resolveMimeType(mimeType?: string | null): string {
  return mimeType && mimeType.trim().length > 0
    ? mimeType
    : "application/octet-stream";
}
