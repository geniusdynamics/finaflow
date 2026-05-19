// ABOUTME: Unified webhook handler that routes incoming provider webhooks to the appropriate wallet provider.
// ABOUTME: Validates provider registry, delegates to provider's processWebhook, and logs results.

import { walletRegistry } from "./provider-registry";
import { logWalletTransaction } from "./transaction-logger";
import { WalletWebhookPayload, WalletWebhookResult } from "./provider-interface";

export async function handleWalletWebhook(payload: WalletWebhookPayload): Promise<{ status: number; body: string }> {
  try {
    const provider = walletRegistry.get(payload.provider);
    if (!provider) {
      return {
        status: 404,
        body: JSON.stringify({ error: `Unknown provider: ${payload.provider}` }),
      };
    }

    if (!provider.features.processWebhook) {
      return {
        status: 405,
        body: JSON.stringify({ error: `Webhooks not supported by ${provider.displayName}` }),
      };
    }

    const result: WalletWebhookResult = await provider.processWebhook(payload);

    if (result.processed && result.transaction) {
      try {
        const txn = result.transaction;
        await logWalletTransaction({
          locationId: 0,
          provider: payload.provider,
          providerTxnId: txn.providerTxnId,
          providerRef: txn.providerRef,
          txnDate: new Date().toISOString().slice(0, 10),
          txnType: "payment",
          direction: "in",
          amount: txn.amount,
          currency: txn.currency,
          status: txn.status,
          txnFee: txn.fee,
          rawPayload: payload.rawBody ? { rawBody: payload.rawBody } : undefined,
        });
      } catch (logErr) {
        console.error(`[WebhookHandler] Failed to log transaction:`, logErr);
      }

      return {
        status: 200,
        body: JSON.stringify({ received: true, transactionId: txn.providerTxnId }),
      };
    }

    return {
      status: 400,
      body: JSON.stringify({ error: result.error || "Failed to process webhook" }),
    };
  } catch (err) {
    console.error(`[WebhookHandler] Unhandled error:`, err);
    return {
      status: 500,
      body: JSON.stringify({ error: "Internal webhook processing error" }),
    };
  }
}
