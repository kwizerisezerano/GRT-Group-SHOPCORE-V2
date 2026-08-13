/**
 * Wire format translation.
 *
 * The database and service layer use camelCase, because that is what Prisma
 * generates. The HTTP API speaks snake_case, because that is what the
 * frontend already consumes everywhere — it grew up against Supabase/
 * PostgREST, and `/auth/me` already answers in snake_case for exactly this
 * reason. Rather than let the two conventions leak into each other, requests
 * are converted on the way in and responses on the way out, in one place.
 *
 * This keeps the migration honest: a page moving from `supabase.from(...)`
 * to the new API sees the same field names it always did, so the move is a
 * change of data source rather than a rewrite of every property access.
 */

function toSnake(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, character: string) => character.toUpperCase());
}

/**
 * A value that must be passed through untouched rather than walked. Dates
 * and Decimals are objects, but rewriting their internals would destroy
 * them; Buffers likewise.
 */
function isOpaque(value: unknown): boolean {
  return (
    value instanceof Date ||
    Buffer.isBuffer(value) ||
    // Prisma Decimal and similar value objects expose toFixed/toNumber and
    // must survive serialisation intact.
    (typeof value === "object" &&
      value !== null &&
      typeof (value as { toFixed?: unknown }).toFixed === "function")
  );
}

function convertKeys(value: unknown, convert: (key: string) => string): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => convertKeys(item, convert));
  }

  if (value !== null && typeof value === "object" && !isOpaque(value)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        convert(key),
        convertKeys(nested, convert),
      ])
    );
  }

  return value;
}

/** Response direction: camelCase → snake_case. */
export function toSnakeCase<T>(value: T): T {
  return convertKeys(value, toSnake) as T;
}

/** Request direction: snake_case → camelCase. */
export function toCamelCase<T>(value: T): T {
  return convertKeys(value, toCamel) as T;
}
