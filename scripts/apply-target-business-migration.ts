import "dotenv/config";
import { Client } from "pg";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query(`
      ALTER TABLE "integration_connections"
      ADD COLUMN IF NOT EXISTS "targetBusinessId" bigint,
      ADD COLUMN IF NOT EXISTS "targetBusinessName" varchar(255);
    `);
    console.log("FinaFlow migration applied:", result.command);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
