export function getFinabillWebhookUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/webhooks/finabill`;
  }
  return "";
}
