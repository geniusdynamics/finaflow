// ABOUTME: Formats business profile document metadata for UI and print-friendly labels.
// ABOUTME: Centralizes display formatting so page components stay focused on rendering.
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function buildPrintGeneratedLabel(accountId: string, at: Date): string {
  return `Generated ${at.toLocaleString("en-KE")} · Account ${accountId}`;
}
