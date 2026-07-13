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
      SELECT id, "businessId" as business_id, "targetSystem" as target_system, "authData" as auth_data, "isActive" as is_active, "targetBusinessId" as target_business_id, "targetBusinessName" as target_business_name
      FROM "integration_connections"
      WHERE "targetSystem" = 'finabill'
      ORDER BY id;
    `);
    console.log(JSON.stringify(result.rows, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
