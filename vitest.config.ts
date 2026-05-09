import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "src"),
      "@contracts": path.resolve(templateRoot, "contracts"),
      "@db": path.resolve(templateRoot, "db"),
      "db": path.resolve(templateRoot, "db"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["api/**/*.test.ts", "api/**/*.test.tsx", "api/**/__tests__/*.test.ts"],
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
