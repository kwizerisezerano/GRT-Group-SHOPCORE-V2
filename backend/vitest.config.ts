import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Unit tests only. Anything touching a real database lives in
    // *.integration.test.ts and runs via vitest.integration.config.ts, so
    // `npm test` stays runnable with no MySQL present.
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "src/**/*.integration.test.ts"],
    // Keys the crypto suite needs. Set here rather than in .env so the suite
    // is reproducible on a machine that has never been configured, and so it
    // can never accidentally run against real keys.
    env: {
      ENCRYPTION_KEY: "1".repeat(64),
      BLIND_INDEX_KEY: "2".repeat(64),
      DATABASE_URL: "mysql://test@127.0.0.1:3306/shopcore_test",
      JWT_ACCESS_SECRET: "test-access-secret-value",
      JWT_REFRESH_SECRET: "test-refresh-secret-value",
    },
  },
});
