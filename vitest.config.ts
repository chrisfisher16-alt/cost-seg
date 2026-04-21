import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/vitest.setup.ts"],
    include: ["tests/unit/**/*.{test,spec}.{ts,tsx}", "lib/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["lib/**", "app/**", "components/**"],
      // Master-prompt §8 acceptance criterion: coverage ≥ 80% on lib/**.
      // The `thresholds.<path>` map enforces per-glob thresholds — vitest
      // exits non-zero when coverage dips below any listed number.
      //
      // STATE AS OF V1.2 WRAP: the lib/** coverage is ~55% — the pipeline,
      // deliver, share, ready-check and supabase-helper modules are
      // untested at the unit level because they need mocked Prisma +
      // mocked Supabase scaffolding that no existing test has built yet.
      // `pnpm test --coverage` will fail the threshold until those tests
      // land (tracked in docs/qa/register.md as B8-1). CI runs plain
      // `pnpm test` so this threshold only activates when an author opts
      // in with `--coverage` locally.
      thresholds: {
        "lib/**": {
          lines: 80,
          functions: 80,
          branches: 75,
          statements: 80,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "server-only": path.resolve(__dirname, "./tests/stubs/server-only.ts"),
    },
  },
});
