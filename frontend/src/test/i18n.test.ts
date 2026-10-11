import { describe, expect, it } from "vitest";

import enCommon from "@/i18n/locales/en/common.json";
import frCommon from "@/i18n/locales/fr/common.json";
import rwCommon from "@/i18n/locales/rw/common.json";
import swCommon from "@/i18n/locales/sw/common.json";
import enPlatform from "@/i18n/locales/en/platform.json";
import frPlatform from "@/i18n/locales/fr/platform.json";
import rwPlatform from "@/i18n/locales/rw/platform.json";
import swPlatform from "@/i18n/locales/sw/platform.json";
import legacyEnglish from "@/i18n/locales/legacy-ui.en.json";
import legacyFrench from "@/i18n/locales/legacy-ui.fr.json";
import legacyKinyarwanda from "@/i18n/locales/legacy-ui.rw.json";
import legacyKiswahili from "@/i18n/locales/legacy-ui.sw.json";
import { SUPPORTED_LANGUAGES } from "@/i18n/types";

function flatten(
  value: Record<string, unknown>,
  prefix = "",
): Record<string, string> {
  return Object.entries(value).reduce<Record<string, string>>(
    (result, [key, entry]) => {
      const path = prefix ? `${prefix}.${key}` : key;

      if (
        entry &&
        typeof entry === "object" &&
        !Array.isArray(entry)
      ) {
        Object.assign(
          result,
          flatten(entry as Record<string, unknown>, path),
        );
      } else if (typeof entry === "string") {
        result[path] = entry;
      }

      return result;
    },
    {},
  );
}

const catalogs = {
  en: { common: enCommon, platform: enPlatform },
  fr: { common: frCommon, platform: frPlatform },
  rw: { common: rwCommon, platform: rwPlatform },
  sw: { common: swCommon, platform: swPlatform },
};

describe("translation catalogs", () => {
  it("registers all four supported languages", () => {
    expect(SUPPORTED_LANGUAGES.map(({ code }) => code)).toEqual([
      "en",
      "fr",
      "rw",
      "sw",
    ]);
  });

  it.each(["common", "platform"] as const)(
    "keeps every %s catalog structurally complete",
    (catalogName) => {
      const english = flatten(catalogs.en[catalogName]);
      const expectedKeys = Object.keys(english).sort();

      for (const language of ["fr", "rw", "sw"] as const) {
        const translated = flatten(catalogs[language][catalogName]);

        expect(
          Object.keys(translated).sort(),
          `${language}/${catalogName} keys`,
        ).toEqual(expectedKeys);

        for (const key of expectedKeys) {
          expect(
            translated[key].trim(),
            `${language}/${catalogName}:${key}`,
          ).not.toBe("");
        }
      }
    },
  );

  it("covers every extracted legacy UI phrase in all three translated catalogs", () => {
    const expected = new Set(legacyEnglish);

    for (const [language, catalog] of Object.entries({
      fr: legacyFrench,
      rw: legacyKinyarwanda,
      sw: legacyKiswahili,
    })) {
      expect(
        Object.keys(catalog).length,
        `${language} legacy phrase count`,
      ).toBe(expected.size);

      for (const phrase of expected) {
        expect(catalog[phrase as keyof typeof catalog], `${language}: ${phrase}`)
          .toBeTruthy();
      }
    }
  });
});
