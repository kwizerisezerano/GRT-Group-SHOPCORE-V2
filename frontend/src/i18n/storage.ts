import type { AppLanguage } from "./types";

export const LANGUAGE_STORAGE_KEY =
  "shopcore-preferred-language";

export const THEME_STORAGE_KEY =
  "shopcore-preferred-theme";

const supportedLanguages: AppLanguage[] = [
  "en",
  "fr",
  "rw",
  "sw",
];

export function readStoredLanguage():
  | AppLanguage
  | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(
    LANGUAGE_STORAGE_KEY,
  ) as AppLanguage | null;

  return value &&
    supportedLanguages.includes(value)
    ? value
    : null;
}

export function storeLanguage(
  language: AppLanguage,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    LANGUAGE_STORAGE_KEY,
    language,
  );
}

export function resolveBrowserLanguage():
  | AppLanguage
  | null {
  if (typeof navigator === "undefined") {
    return null;
  }

  const code = navigator.language
    .trim()
    .toLowerCase();

  if (code.startsWith("fr")) {
    return "fr";
  }

  if (
    code.startsWith("rw") ||
    code.startsWith("kin")
  ) {
    return "rw";
  }

  if (code.startsWith("en")) {
    return "en";
  }

  if (
    code.startsWith("sw") ||
    code.startsWith("swa")
  ) {
    return "sw";
  }

  return null;
}
