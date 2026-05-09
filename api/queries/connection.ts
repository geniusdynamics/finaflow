import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { env } from "../lib/env";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

let pool: mysql.Pool | null = null;
let instance: ReturnType<typeof drizzle<typeof fullSchema>> | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      uri: env.databaseUrl,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });
  }
  return pool;
}

export function getDb(): ReturnType<typeof drizzle<typeof fullSchema>> {
  if (!instance) {
    instance = drizzle(getPool(), {
      mode: "planetscale",
      schema: fullSchema,
    });
  }
  return instance;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    instance = null;
  }
}
