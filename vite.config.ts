// ABOUTME: Vite configuration with React, Hono dev server, path aliases, and build output settings.
// ABOUTME: Dev server runs on PORT env var (default 3000) with the Hono backend wired in.
import devServer from "@hono/vite-dev-server"
import path from "path"
const __dirname = import.meta.dirname
import react from "@vitejs/plugin-react"
import { sentryVitePlugin } from "@sentry/vite-plugin"
import { defineConfig } from "vite"

const releaseName = process.env.npm_package_version
  ? `finaflow@${process.env.npm_package_version}`
  : undefined;

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    devServer({ entry: "api/boot.ts", exclude: [/^\/(?!(api\/|health)).*$/] }),
    react(),
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          release: {
            name: releaseName,
            inject: true,
            create: true,
            finalize: true,
          },
          sourcemaps: {
            assets: "./dist/public/**",
            filesToDeleteAfterUpload: ["./dist/public/**/*.map"],
          },
        })]
      : []),
  ],
  server: {
    port: Number.isFinite(Number(process.env.PORT)) ? Number(process.env.PORT) : 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@db": path.resolve(__dirname, "./db"),
      "db": path.resolve(__dirname, "./db"),
    },
  },
  envDir: path.resolve(__dirname),
  build: {
    sourcemap: "hidden",
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
});
