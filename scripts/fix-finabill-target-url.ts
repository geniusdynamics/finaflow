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
      UPDATE "integration_connections"
      SET "authData" = (
        ("authData"::jsonb || '{"url": "http://localhost:3101"}'::jsonb)::json
      ),
      "updatedAt" = NOW()
      WHERE "targetSystem" = 'finabill'
        AND "authData"->>'url' LIKE '%://localhost:3100%';
    `);
    console.log("Updated FinaFlow FinaBill connection URL rows:", result.rowCount);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
