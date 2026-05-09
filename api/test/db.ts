import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

let pool: mysql.Pool | null = null;
let instance: ReturnType<typeof drizzle<typeof fullSchema>> | null = null;

export function getTestDb() {
  if (!pool) {
    pool = mysql.createPool({
      uri: process.env.DATABASE_URL || "mysql://root:test@127.0.0.1:3306/finaflow_test",
      connectionLimit: 2,
    });
  }
  if (!instance) {
    instance = drizzle(pool, { mode: "planetscale", schema: fullSchema });
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
