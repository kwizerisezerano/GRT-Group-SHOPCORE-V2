import enCommon from "./locales/en/common.json";
import frCommon from "./locales/fr/common.json";
import rwCommon from "./locales/rw/common.json";
import swCommon from "./locales/sw/common.json";
import enPlatform from "./locales/en/platform.json";
import frPlatform from "./locales/fr/platform.json";
import rwPlatform from "./locales/rw/platform.json";
import swPlatform from "./locales/sw/platform.json";
import type { AppLanguage, TranslationDictionary, TranslationParams } from "./types";

const resources: Record<AppLanguage, TranslationDictionary> = {
  en: { ...enCommon, platformAdmin: enPlatform },
  fr: { ...frCommon, platformAdmin: frPlatform },
  rw: { ...rwCommon, platformAdmin: rwPlatform },
  sw: { ...swCommon, platformAdmin: swPlatform },
};

function readPath(source: TranslationDictionary, path: string): unknown {
  let current: unknown = source;
  for (const segment of path.split(".")) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function interpolate(value: string, params?: TranslationParams) {
  if (!params) return value;
  return value.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    String(params[key] ?? `{{${key}}}`),
  );
}

function pluralKey(language: AppLanguage, key: string, params?: TranslationParams) {
  if (params?.count === undefined || params.count === null) return key;
  const count = Number(params.count);
  if (!Number.isFinite(count)) return key;
  const locale =
    language === "fr"
      ? "fr-RW"
      : language === "rw"
        ? "rw-RW"
        : language === "sw"
          ? "sw-RW"
          : "en-RW";
  return new Intl.PluralRules(locale).select(count) === "one" ? key : `${key}_plural`;
}

export function translate(language: AppLanguage, key: string, params?: TranslationParams) {
  const resolved = pluralKey(language, key, params);
  const candidates = [
    readPath(resources[language], resolved),
    readPath(resources.en, resolved),
    readPath(resources[language], key),
    readPath(resources.en, key),
  ];
  const value = candidates.find((item) => typeof item === "string");
  return interpolate(typeof value === "string" ? value : key, params);
}

export function hasTranslation(language: AppLanguage, key: string) {
  return typeof readPath(resources[language], key) === "string" ||
    typeof readPath(resources.en, key) === "string";
}
