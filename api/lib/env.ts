// ABOUTME: Loads and validates required environment variables, providing a typed env object.
// ABOUTME: Throws on startup if any required variable is missing.
import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  appId: required("APP_ID"),
  appSecret: required("APP_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
  appUrl: process.env.APP_URL || "http://localhost:3200",
  // Prefer explicit API_URL; never fall back to frontend APP_URL for machine-to-machine connect.
  apiUrl: process.env.API_URL || process.env.VITE_API_URL || "http://localhost:3200",
  finabillAppUrl: process.env.FINABILL_APP_URL || "http://localhost:5174",
  finabillApiUrl: process.env.FINABILL_API_URL || "http://localhost:3100",
  systemName: "finaflow" as const,
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || "12", 10),
  nhifRate: parseFloat(process.env.NHIF_RATE || "2.75"),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10),
  rateLimitMaxLogin: parseInt(process.env.RATE_LIMIT_MAX_LOGIN || "10", 10),
  rateLimitMaxApi: parseInt(process.env.RATE_LIMIT_MAX_API || "100", 10),
  superAdminAccount: process.env.SUPER_ADMIN_ACCOUNT || "",
  adminRoute: process.env.ADMIN_ROUTE || "admin",
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: process.env.SMTP_PORT || "",
  smtpUser: process.env.SMTP_USER || "",
  smtpFrom: process.env.SMTP_FROM || "",
};
