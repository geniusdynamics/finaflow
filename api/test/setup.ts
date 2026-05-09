import { beforeAll, afterAll } from "vitest";

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.APP_ID = "test-app";
process.env.APP_SECRET = "test-secret-key-not-for-production";
process.env.DATABASE_URL = "mysql://root:test@127.0.0.1:3306/finaflow_test";
process.env.KIMI_AUTH_URL = "https://auth.example.com";
process.env.KIMI_OPEN_URL = "https://open.example.com";
process.env.NHIF_RATE = "2.75";
process.env.BCRYPT_ROUNDS = "4";

import { clearRateLimitStore } from "../lib/rate-limit";

beforeAll(() => {
  clearRateLimitStore();
});

afterAll(() => {
  clearRateLimitStore();
});
