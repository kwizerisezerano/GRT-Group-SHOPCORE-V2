export type AppLanguage = "en" | "fr" | "rw" | "sw";
export type LocaleCode = "en-RW" | "fr-RW" | "rw-RW" | "sw-RW";
export type TranslationParams = Record<string, string | number | boolean | null | undefined>;
export type TranslationDictionary = Record<string, unknown>;

export const LANGUAGE_LOCALES: Record<AppLanguage, LocaleCode> = {
  en: "en-RW",
  fr: "fr-RW",
  rw: "rw-RW",
  sw: "sw-RW",
};

export const SUPPORTED_LANGUAGES = [
  { code: "en" as const, locale: "en-RW" as const, nativeName: "English", englishName: "English", flag: "https://purecatamphetamine.github.io/country-flag-icons/3x2/GB.svg" },
  { code: "fr" as const, locale: "fr-RW" as const, nativeName: "Français", englishName: "French", flag: "https://purecatamphetamine.github.io/country-flag-icons/3x2/FR.svg" },
  { code: "rw" as const, locale: "rw-RW" as const, nativeName: "Ikinyarwanda", englishName: "Kinyarwanda", flag: "https://purecatamphetamine.github.io/country-flag-icons/3x2/RW.svg" },
  { code: "sw" as const, locale: "sw-RW" as const, nativeName: "Kiswahili", englishName: "Swahili", flag: "https://purecatamphetamine.github.io/country-flag-icons/3x2/TZ.svg" },
];
