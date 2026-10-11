import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],

    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
    ],

    exclude: [
      "node_modules",
      "dist",
      "src-tauri",
      "playwright-report",
      "test-results",
    ],

    clearMocks: true,
    restoreMocks: true,
    mockReset: true,

    coverage: {
      provider: "v8",
      reporter: [
        "text",
        "html",
        "json-summary",
      ],

      reportsDirectory: "./coverage",

      include: [
        "src/**/*.{ts,tsx}",
      ],

      exclude: [
        "src/**/*.d.ts",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/test/**",
        "src/main.tsx",
        "src/vite-env.d.ts",
        "src/integrations/supabase/types.ts",
      ],
    },
  },
});