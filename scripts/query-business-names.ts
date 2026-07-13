import "dotenv/config";
import { Client } from "pg";

async function queryClient(name: string, connectionString: string, businessId: number) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query(
      `SELECT id, name FROM "businesses" WHERE id = $1;`,
      [businessId]
    );
    console.log(name, JSON.stringify(result.rows[0] ?? null));
  } finally {
    await client.end();
  }
}

async function main() {
  await queryClient(
    "FinaFlow business",
    process.env.FINAFLOW_DATABASE_URL ?? process.env.FINAFlow_DATABASE_URL ?? "",
    3
  );
  await queryClient(
    "FinaBill business",
    process.env.FINABILL_DATABASE_URL ?? process.env.FINABILL_DATABASE_URL ?? "",
    4
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
