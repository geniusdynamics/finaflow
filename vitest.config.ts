// ABOUTME: Configures Vitest for the repository with shared aliases and setup hooks.
// ABOUTME: Includes both API tests and focused source-level logic tests without switching to a DOM environment.
import { defineConfig } from "vitest/config";
import path from "path";
import react from "@vitejs/plugin-react";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "src"),
      "@db": path.resolve(templateRoot, "db"),
      "db": path.resolve(templateRoot, "db"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  plugins: [react()],
  test: {
    globals: true,
    environment: "node",
    // Integration tests share a single PostgreSQL database. Running them in
    // parallel causes lock contention, timeouts, and flake. The single fork
    // pool gives us one test worker that runs test files sequentially while
    // still parallelising cases inside a file.
    pool: "forks",
    singleFork: true,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    include: [
      "api/**/*.test.ts",
      "api/**/*.test.tsx",
      "api/**/__tests__/*.test.ts",
      "e2e/**/*.test.ts",
      "e2e/**/__tests__/*.test.ts",
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "src/**/__tests__/*.test.ts",
      "src/**/__tests__/*.test.tsx",
      "db/**/__tests__/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["api/**/*.ts"],
      exclude: ["api/**/*.test.ts", "api/**/*.test.tsx", "api/test/**"],
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
    setupFiles: ["api/test/setup.ts"],
  },
});
