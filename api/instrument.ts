// ABOUTME: Initializes Sentry for the Node.js backend before any other imports.
// ABOUTME: Must be imported first in boot.ts or loaded via --import in production.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as Sentry from "@sentry/node";

// Detect release version from package.json (works in dev and production)
let release: string | undefined;
try {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8"));
  release = `finaflow@${pkg.version}`;
} catch {
  release = process.env.SENTRY_RELEASE || undefined;
}

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    release,
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.2"),
    enableLogs: true,
    integrations: [
      Sentry.consoleLoggingIntegration({ levels: ["error", "warn"] }),
    ],
  });
}

export { Sentry };
