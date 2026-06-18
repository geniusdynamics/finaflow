# Sentry Error Tracking Implementation Plan

## Summary

Integrate Sentry across the entire finaflow stack — backend (Hono/Node.js), frontend (React 19/Vite), and build pipeline (source maps) — so all unhandled errors, exceptions, and performance traces flow to a single Sentry dashboard for proactive monitoring and resolution.

---

## Current State Analysis

| Area | Current Approach | Gap |
|------|-----------------|-----|
| **Backend errors** | `console.error` in Hono catch block ([boot.ts#L112](file:///d:/DevCenter/abuilds/fina/finaflow/api/boot.ts#L112)) | Errors disappear into server logs; no aggregation, alerting, or trends |
| **Frontend errors** | React `ErrorBoundary` class component ([ErrorBoundary.tsx](file:///d:/DevCenter/abuilds/fina/finaflow/src/components/ErrorBoundary.tsx)) catches + `console.error` | No remote tracking; user sees fallback but devs never know |
| **tRPC errors** | `TRPCError` thrown in middleware ([middleware.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/middleware.ts)) formatted by tRPC error formatter | Caught server-side but not tracked remotely |
| **Background jobs** | `console.error` in try/catch blocks (trial lifecycle, seed jobs in [boot.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/boot.ts#L124-L184)) | Silent failures in production |
| **Source maps** | Not generated for production builds | Minified stack traces are unreadable |
| **Monitoring** | None — no APM, no error aggregation, no alerting | Complete blind spot in production |

**Stack:** Hono.js (Node.js ESM) + tRPC + React 19 + Vite 7 + esbuild backend bundler + Docker Node 22 Alpine

---

## Packages to Install

| Package | Purpose | Side |
|---------|---------|------|
| `@sentry/node` | Backend error tracking, tracing, logging | prod |
| `@sentry/react` | Frontend error tracking, React ErrorBoundary, replay | prod |
| `@sentry/vite-plugin` | Source map upload to Sentry during build | dev |

---

## Environment Variables

Add to [`.env.example`](file:///d:/DevCenter/abuilds/fina/finaflow/.env.example) and validate in [api/lib/env.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/lib/env.ts):

```
# ── Sentry Error Tracking ──────────────────────────────────────
SENTRY_DSN=                  # Sentry DSN (required in production)
SENTRY_ORG=                  # Sentry organization slug (for source map upload)
SENTRY_PROJECT=              # Sentry project slug (for source map upload)
SENTRY_AUTH_TOKEN=           # Sentry auth token (for source map upload only, never committed)
SENTRY_TRACES_SAMPLE_RATE=0.2   # Performance tracing sample rate (0.0-1.0, default 0.2)
SENTRY_PROFILES_SAMPLE_RATE=0.1 # Profiling sample rate (0.0-1.0, default 0.1)
```

For the frontend (Vite-exposed), add `VITE_SENTRY_DSN` to the `.env` files. Vite only exposes `VITE_*` prefixed vars to client code.

---

## Proposed Changes

### Step 1: Create backend instrument file

**New file: `api/instrument.ts`**

ABOUTME: Initializes Sentry for the Node.js backend before any other imports.
ABOUTME: Must be imported first in boot.ts or loaded via --import in production.

- Import `@sentry/node`
- Call `Sentry.init()` with DSN, tracesSampleRate, enableLogs, environment, release
- Use `Sentry.consoleLoggingIntegration` to capture console.error/warn as Sentry logs
- Only initialize when `SENTRY_DSN` is set (no-op in dev without DSN)
- Export Sentry for use elsewhere (e.g., `Sentry.captureException()` in catch blocks)

Key config:
```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.2"),
  enableLogs: true,
  integrations: [
    Sentry.consoleLoggingIntegration({ levels: ["error", "warn"] }),
  ],
});
```

### Step 2: Wire backend instrument into boot.ts

**Modify: `api/boot.ts`** ([boot.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/boot.ts))

- Add `import "./instrument"` as the very first import (line 1, before all other imports)
- In the Hono catch block (line 111-114), replace `console.error` with `Sentry.captureException(err)` + set Sentry scope context (method, path, status)
- In background job catch blocks (trial lifecycle, seed jobs), add `Sentry.captureException(error)` alongside existing `console.error`
- Add a `GET /debug-sentry` route that throws an error to verify the integration

### Step 3: Update Dockerfile and start script

**Modify: `Dockerfile`** ([Dockerfile](file:///d:/DevCenter/abuilds/fina/finaflow/Dockerfile))

- Update `CMD` to use `node --import ./api/instrument.js dist/boot.js` instead of `node dist/boot.js`
- This ensures Sentry initializes before any module loading in production

**Modify: `package.json`** ([package.json](file:///d:/DevCenter/abuilds/fina/finaflow/package.json))

- Update `start` script: `NODE_ENV=production node --import ./api/instrument.mjs dist/boot.js`
- The esbuild output is ESM (`--format=esm`), so instrument must be `.mjs`

### Step 4: Create frontend instrument file

**New file: `src/instrument.ts`**

ABOUTME: Initializes Sentry for the React frontend, capturing client-side errors and performance.

- Import `@sentry/react`
- Call `Sentry.init()` with DSN (from `VITE_SENTRY_DSN`), browserTracingIntegration, replayIntegration
- Configure `tracePropagationTargets` to include `/api/trpc` for distributed tracing
- Enable session replay on errors (`replaysOnErrorSampleRate: 1.0`)
- Only initialize when `VITE_SENTRY_DSN` is set

Key config:
```typescript
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracePropagationTargets: [/^\/api\//],
  tracesSampleRate: 0.2,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
});
```

### Step 5: Wire frontend instrument into main.tsx

**Modify: `src/main.tsx`** ([main.tsx](file:///d:/DevCenter/abuilds/fina/finaflow/src/main.tsx))

- Add `import "./instrument"` as the very first import, before `React` and all other imports
- This ensures Sentry captures errors from the earliest possible point

### Step 6: Replace ErrorBoundary with Sentry's version

**Modify: `src/components/ErrorBoundary.tsx`** ([ErrorBoundary.tsx](file:///d:/DevCenter/abuilds/fina/finaflow/src/components/ErrorBoundary.tsx))

- Import `Sentry` from `@sentry/react`
- Replace the class-based `ErrorBoundary` with a re-export of `Sentry.ErrorBoundary`
- Keep the same export name (`ErrorBoundary`) so all 20+ route references in `App.tsx` continue to work without changes
- Wrap the existing fallback UI inside Sentry's ErrorBoundary
- Add `Sentry.captureReactError(error, { componentStack: info.componentStack })` in the componentDidCatch equivalent

### Step 7: Add source map upload to Vite build

**Modify: `vite.config.ts`** ([vite.config.ts](file:///d:/DevCenter/abuilds/fina/finaflow/vite.config.ts))

- Import `sentryVitePlugin` from `@sentry/vite-plugin`
- Add it as the last plugin in the plugins array
- Configure: org, project, authToken from env vars
- Set `build.sourcemap: "hidden"` (generates maps for Sentry but doesn't expose them publicly)
- Use `sourcemaps.filesToDeleteAfterUpload` to clean up `.map` files after upload
- Only enable the plugin when `SENTRY_AUTH_TOKEN` is set (skip in dev/local builds)

```typescript
import { sentryVitePlugin } from "@sentry/vite-plugin";

// In plugins array, after react():
...(process.env.SENTRY_AUTH_TOKEN
  ? [sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        assets: "./dist/public/**",
        filesToDeleteAfterUpload: "./dist/public/**/*.map",
      },
    })]
  : []),
```

### Step 8: Add Sentry context to tRPC error handler

**Modify: `api/middleware.ts`** ([middleware.ts](file:///d:/DevCenter/abuilds/fina/finaflow/api/middleware.ts))

- Import Sentry at the top
- In the tRPC error formatter (around line 245), add `Sentry.captureException(error)` for non-Zod errors (i.e., unexpected server errors, not user-input validation errors)
- Set Sentry scope with user info when available (from tRPC context)

### Step 9: Update .env.example

**Modify: `.env.example`** ([.env.example](file:///d:/DevCenter/abuilds/fina/finaflow/.env.example))

- Add all Sentry-related env vars with descriptions
- Mark `SENTRY_AUTH_TOKEN` as "for build only, never commit"

### Step 10: Update .gitignore

**Modify: `.gitignore`** (check if exists, create if not)

- Ensure `.env.sentry-build-plugin` is ignored
- Ensure `*.map` files in dist/ are ignored (if not already)

---

## Assumptions & Decisions

1. **SaaS vs Self-hosted:** Plan targets Sentry SaaS (sentry.io). If you want self-hosted (BugSink or Sentry self-hosted), set `SENTRY_URL` to your instance URL.
2. **Sampling rates:** Default to 20% trace sampling and 10% profiling in production to manage costs. These are configurable via env vars.
3. **No session replay by default:** Replay is configured but only captures on errors (100% of error sessions, 10% of normal sessions). Can be increased later.
4. **Source maps:** Uploaded to Sentry and deleted from build output to prevent source code exposure.
5. **Dev environment:** Sentry only activates when DSN env vars are set. Local development without Sentry DSN = no overhead.
6. **Console integration:** Backend `console.error`/`console.warn` calls are automatically forwarded to Sentry Logs, giving structured log search without rewriting all console calls.
7. **Distributed tracing:** Frontend traces propagate to backend via `sentry-trace` and `baggage` headers on `/api/*` requests.

---

## Files Modified

| File | Action | Description |
|------|--------|-------------|
| `api/instrument.ts` | **Create** | Backend Sentry initialization |
| `src/instrument.ts` | **Create** | Frontend Sentry initialization |
| `api/boot.ts` | Edit | Import instrument, add Sentry error capture in catch blocks |
| `api/middleware.ts` | Edit | Add Sentry exception capture for unexpected tRPC errors |
| `src/main.tsx` | Edit | Import frontend instrument as first import |
| `src/components/ErrorBoundary.tsx` | Edit | Replace with Sentry.ErrorBoundary wrapper |
| `vite.config.ts` | Edit | Add sentryVitePlugin for source map upload |
| `package.json` | Edit | Update start script for --import flag |
| `Dockerfile` | Edit | Update CMD for --import flag |
| `.env.example` | Edit | Add Sentry env vars |
| `.gitignore` | Edit | Ensure .env.sentry-build-plugin is ignored |

---

## Verification Steps

1. **Install packages:** `npm install @sentry/node @sentry/react` and `npm install -D @sentry/vite-plugin`
2. **Create a free Sentry project** at sentry.io, grab the DSN
3. **Set env vars:** `SENTRY_DSN` (backend), `VITE_SENTRY_DSN` (frontend)
4. **Test backend:** Hit `GET /debug-sentry` — should see error in Sentry dashboard within seconds
5. **Test frontend:** Trigger a React error (e.g., throw in a component) — should see it in Sentry with component stack
6. **Test source maps:** Run `npm run build` with `SENTRY_AUTH_TOKEN` set — verify source maps uploaded in Sentry release settings
7. **Test distributed tracing:** Make a tRPC call from frontend — verify trace spans appear in Sentry performance view
8. **Test console integration:** A `console.error()` in backend should appear in Sentry Logs
9. **Run `npm run lint` and `npm run check`** to verify no type/lint errors
10. **Run `npm test`** to verify no regressions
