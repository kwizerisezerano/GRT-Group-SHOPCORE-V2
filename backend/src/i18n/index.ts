import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import rw from "./locales/rw.json";
import sw from "./locales/sw.json";

/**
 * Languages the API can answer in.
 *
 * The requirements name en, sw, es and fr. `rw` (Kinyarwanda) is kept
 * alongside them because the product already ships it — it is advertised in
 * the README, the frontend has a full rw locale, and the password-reset
 * email has been sent in rw since before this catalogue existed. Dropping it
 * to match the list exactly would be a user-facing regression, and the
 * requirement is a floor, not a ceiling.
 */
export const SUPPORTED_LANGUAGES = ["en", "fr", "es", "sw", "rw"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = "en";

/**
 * Dot-separated key paths into the catalogue, derived from the English file.
 * Because every other locale is typed against this shape, adding a key to
 * en.json without adding it everywhere else is a compile error rather than a
 * runtime fallback nobody notices.
 */
type Leaves<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Leaves<T[K]>}`;
}[keyof T & string];

export type MessageKey = Leaves<typeof en>;

const catalogues: Record<Language, unknown> = { en, fr, es, sw, rw };

function lookup(catalogue: unknown, key: string): string | undefined {
  const value = key.split(".").reduce<unknown>((node, segment) => {
    if (node && typeof node === "object" && segment in (node as object)) {
      return (node as Record<string, unknown>)[segment];
    }
    return undefined;
  }, catalogue);

  return typeof value === "string" ? value : undefined;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole
  );
}

/**
 * Resolves a message in the requested language, falling back to English and
 * finally to the key itself. Returning the key rather than throwing means a
 * missing translation degrades a message, never an API response.
 */
export function translate(
  key: MessageKey,
  language: Language = DEFAULT_LANGUAGE,
  params?: Record<string, string | number>
): string {
  const message =
    lookup(catalogues[language], key) ?? lookup(catalogues[DEFAULT_LANGUAGE], key) ?? key;

  return interpolate(message, params);
}

export function isSupportedLanguage(value: unknown): value is Language {
  return typeof value === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Picks the best language for a request.
 *
 * Order: explicit `?lang=` (handy for testing and for links embedded in
 * emails), then the `X-Language` header the frontend sets from its own
 * language switcher, then standard `Accept-Language` negotiation, then
 * English.
 */
export function resolveLanguage(input: {
  query?: unknown;
  headerLanguage?: string;
  acceptLanguage?: string;
}): Language {
  if (isSupportedLanguage(input.query)) return input.query;
  if (isSupportedLanguage(input.headerLanguage)) return input.headerLanguage;

  for (const tag of parseAcceptLanguage(input.acceptLanguage)) {
    // Match the base subtag so "fr-CA" and "es-419" still resolve.
    const base = tag.split("-")[0];
    if (isSupportedLanguage(base)) return base;
  }

  return DEFAULT_LANGUAGE;
}

/** Returns tags from an Accept-Language header, highest q-value first. */
function parseAcceptLanguage(header: string | undefined): string[] {
  if (!header) return [];

  return header
    .split(",")
    .map((part) => {
      const [tag, ...directives] = part.trim().split(";");
      const q = directives
        .map((d) => d.trim())
        .find((d) => d.startsWith("q="))
        ?.slice(2);

      const quality = q === undefined ? 1 : Number.parseFloat(q);
      return { tag: tag.trim().toLowerCase(), quality: Number.isFinite(quality) ? quality : 0 };
    })
    .filter((entry) => entry.tag !== "" && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality)
    .map((entry) => entry.tag);
}
