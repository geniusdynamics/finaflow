// ABOUTME: Runs one subscription sweep against DATABASE_URL (due-soon/overdue notifications,
// ABOUTME: auto-renew pendings, and bill-mode AP materialization). Mirrors the daily boot job.
import "dotenv/config";
import { closePool, getDb } from "../api/queries/connection";
import { runSubscriptionSweep } from "../api/lib/subscription-sweep";
import { sendSubscriptionDigestEmails } from "../api/lib/subscription-digest";

async function main() {
  const db = getDb();
  const sweep = await runSubscriptionSweep(db);
  console.log("sweep:", sweep);
  const digest = await sendSubscriptionDigestEmails(db);
  console.log("digest emails sent:", digest);
  await closePool();
}

main().catch(async (error) => {
  console.error(error);
  await closePool();
  process.exit(1);
});
