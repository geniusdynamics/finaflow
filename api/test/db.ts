import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

let pool: pg.Pool | null = null;
let instance: ReturnType<typeof drizzle<typeof fullSchema>> | null = null;

export function getTestDb() {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/finaflow_test",
      max: 2,
    });
  }
  if (!instance) {
    instance = drizzle(pool);
  }
  return instance;
}

export async function closeTestDb() {
  if (pool) {
    await pool.end();
    pool = null;
    instance = null;
  }
}
