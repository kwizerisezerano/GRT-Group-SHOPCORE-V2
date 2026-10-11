import { describe, expect, it } from "vitest";
import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import rw from "./locales/rw.json";
import sw from "./locales/sw.json";
import {
  DEFAULT_LANGUAGE,
  Language,
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
  resolveLanguage,
  translate,
} from "./index";

/** Flattens a catalogue into sorted dot-paths for comparison. */
function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") return [prefix];
  if (!value || typeof value !== "object") return [];

  return Object.entries(value as Record<string, unknown>)
    .flatMap(([k, v]) => keyPaths(v, prefix ? `${prefix}.${k}` : k))
    .sort();
}

const catalogues: Record<Language, unknown> = { en, fr, es, sw, rw };

describe("catalogue completeness", () => {
  const expected = keyPaths(en);

  it.each(SUPPORTED_LANGUAGES.filter((l) => l !== "en"))(
    "%s defines exactly the same keys as en",
    (language) => {
      expect(keyPaths(catalogues[language])).toEqual(expected);
    }
  );

  it("covers the four languages the requirements name", () => {
    for (const required of ["en", "sw", "es", "fr"]) {
      expect(SUPPORTED_LANGUAGES).toContain(required);
    }
  });

  it("has no empty strings", () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const flat = JSON.stringify(catalogues[language]);
      expect(flat).not.toContain('""');
    }
  });

  it("keeps placeholders consistent across translations", () => {
    // A translation that drops {{method}} would render a message missing the
    // detail it exists to convey.
    const placeholders = (s: string) => (s.match(/\{\{\w+\}\}/g) ?? []).sort();

    for (const language of SUPPORTED_LANGUAGES) {
      expect(placeholders(translate("error.routeNotFound", language))).toEqual([
        "{{method}}",
        "{{path}}",
      ]);
    }
  });
});

describe("translate", () => {
  it("returns the message for the requested language", () => {
    expect(translate("auth.loginSuccess", "fr")).toBe("Connexion réussie.");
    expect(translate("auth.loginSuccess", "es")).toBe("Sesión iniciada correctamente.");
    expect(translate("auth.loginSuccess", "sw")).toBe("Umeingia kwa mafanikio.");
  });

  it("defaults to English", () => {
    expect(translate("auth.loginSuccess")).toBe(translate("auth.loginSuccess", "en"));
  });

  it("interpolates parameters", () => {
    expect(translate("error.routeNotFound", "en", { method: "GET", path: "/api/nope" })).toBe(
      "No route exists for GET /api/nope."
    );
  });

  it("leaves an unsupplied placeholder intact rather than printing undefined", () => {
    expect(translate("error.routeNotFound", "en", { method: "GET" })).toContain("{{path}}");
  });

  it("produces a distinct message per language", () => {
    const rendered = SUPPORTED_LANGUAGES.map((l) => translate("auth.emailExists", l));
    expect(new Set(rendered).size).toBe(SUPPORTED_LANGUAGES.length);
  });
});

describe("isSupportedLanguage", () => {
  it("accepts supported codes and rejects everything else", () => {
    expect(isSupportedLanguage("es")).toBe(true);
    expect(isSupportedLanguage("de")).toBe(false);
    expect(isSupportedLanguage(undefined)).toBe(false);
    expect(isSupportedLanguage(42)).toBe(false);
  });
});

describe("resolveLanguage", () => {
  it("prefers an explicit query parameter", () => {
    expect(
      resolveLanguage({ query: "es", headerLanguage: "fr", acceptLanguage: "sw" })
    ).toBe("es");
  });

  it("falls back to the X-Language header", () => {
    expect(resolveLanguage({ headerLanguage: "fr", acceptLanguage: "sw" })).toBe("fr");
  });

  it("negotiates Accept-Language by q-value, not document order", () => {
    expect(resolveLanguage({ acceptLanguage: "de;q=0.9, es;q=1.0" })).toBe("es");
  });

  it("matches a regional tag on its base subtag", () => {
    expect(resolveLanguage({ acceptLanguage: "fr-CA" })).toBe("fr");
    expect(resolveLanguage({ acceptLanguage: "es-419" })).toBe("es");
  });

  it("skips unsupported languages and takes the next acceptable one", () => {
    expect(resolveLanguage({ acceptLanguage: "de, ja, sw" })).toBe("sw");
  });

  it("ignores tags explicitly refused with q=0", () => {
    expect(resolveLanguage({ acceptLanguage: "fr;q=0, sw" })).toBe("sw");
  });

  it("defaults to English for empty or unrecognised input", () => {
    expect(resolveLanguage({})).toBe(DEFAULT_LANGUAGE);
    expect(resolveLanguage({ acceptLanguage: "" })).toBe(DEFAULT_LANGUAGE);
    expect(resolveLanguage({ acceptLanguage: "de, ja" })).toBe(DEFAULT_LANGUAGE);
    expect(resolveLanguage({ query: ["es"] })).toBe(DEFAULT_LANGUAGE);
  });
});
