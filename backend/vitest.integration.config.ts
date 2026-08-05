import "dotenv/config";
import { defineConfig } from "vitest/config";

/**
 * Integration suite: runs against a real, migrated MySQL database using the
 * credentials in .env. Kept separate from the unit config so `npm test`
 * needs no database, while `npm run test:integration` exercises the
 * behaviour that only a real engine can prove — tenant isolation, unique
 * constraints, foreign keys.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    // These share tenant fixtures and a single database; running the files
    // in parallel would let them clobber each other.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
