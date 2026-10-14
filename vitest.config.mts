import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // les tests d'intégration partagent une base : exécution séquentielle
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
