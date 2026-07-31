import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "src-tauri/target/**",
      "public/**",
      "supabase/.temp/**",
      "npm-audit.json"
    ]
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: [
      "src/**/*.{ts,tsx}"
    ],

    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",

      globals: {
        ...globals.browser,
        ...globals.es2022
      }
    },

    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },

    rules: {
      ...reactHooks.configs.recommended.rules,

      "react-refresh/only-export-components": [
        "warn",
        {
          allowConstantExport: true
        }
      ],

      "@typescript-eslint/no-explicit-any": "off",

      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_",
          "ignoreRestSiblings": true
        }
      ],

      "@typescript-eslint/no-empty-object-type": "off",

      "no-console": [
        "warn",
        {
          "allow": [
            "warn",
            "error",
            "info"
          ]
        }
      ],

      "prefer-const": "warn",
      "no-debugger": "error"
    }
  },

  {
    files: [
      "vite.config.ts",
      "playwright.config.ts",
      "eslint.config.js",
      "tests/**/*.{ts,tsx}",
      "src/**/*.test.{ts,tsx}",
      "src/**/*.spec.{ts,tsx}"
    ],

    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",

      globals: {
        ...globals.node,
        ...globals.es2022
      }
    },

    rules: {
      "no-console": "off",
      "react-refresh/only-export-components": "off"
    }
  }
);