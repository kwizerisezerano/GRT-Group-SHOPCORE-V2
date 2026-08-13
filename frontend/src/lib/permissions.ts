/**
 * What the signed-in user may do, on this device, right now — including with
 * no connection at all.
 *
 * ## The rule this whole file exists to keep honest
 *
 * **Offline permission checks are advisory. The server is authoritative.**
 *
 * A disconnected till cannot ask anyone whether its cashier may void a sale,
 * so it has to work from the last answer it was given. That is fine for
 * deciding what to put on screen, and it is not a security boundary: anything
 * done offline is replayed through the API when the connection returns, and
 * `requirePermission` checks it again then, against the role the user has at
 * that moment. Someone demoted while a till was offline does not get to keep
 * their old powers by staying offline — their queued work is refused at sync
 * and quarantined with the server's reason.
 *
 * So this cache answers "what should this screen show?" and never "is this
 * allowed?". The second question is only ever answered by the server.
 */

const CACHE_KEY = "shopcore_permissions";

/** How long a cached answer is trusted before it is treated as unknown. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type CachedPermissions = {
  userId: string;
  tenantId: string;
  role: string | null;
  permissions: string[];
  cachedAt: number;
};

function read(): CachedPermissions | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedPermissions;
    if (!Array.isArray(parsed.permissions)) return null;

    /*
     * A month-old answer is not evidence about today. A till that has been in
     * a drawer since before someone left the company should not still be
     * showing them as a manager — better to fall back to nothing and make the
     * operator connect once.
     */
    if (Date.now() - parsed.cachedAt > MAX_AGE_MS) return null;

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Stores what the server said this user may do.
 *
 * Scoped to the user and workspace it was issued for, so a shared till that
 * two people sign into cannot hand one of them the other's authority.
 */
export function cachePermissions(input: {
  userId: string;
  tenantId: string;
  role: string | null;
  permissions: string[];
}) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ...input, cachedAt: Date.now() } satisfies CachedPermissions)
    );
  } catch {
    // Storage can be unavailable; the UI falls back to showing nothing extra.
  }
}

export function clearCachedPermissions() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}

/**
 * The permissions cached for this user in this workspace, or an empty list.
 *
 * Empty rather than permissive when anything is unknown or does not match:
 * a screen that shows too little is a support call, and one that shows too
 * much is a cashier discovering they can delete the product catalogue.
 */
export function cachedPermissions(userId?: string | null, tenantId?: string | null): string[] {
  const cached = read();
  if (!cached) return [];
  if (userId && cached.userId !== userId) return [];
  if (tenantId && cached.tenantId !== tenantId) return [];
  return cached.permissions;
}

export function cachedRole(userId?: string | null, tenantId?: string | null): string | null {
  const cached = read();
  if (!cached) return null;
  if (userId && cached.userId !== userId) return null;
  if (tenantId && cached.tenantId !== tenantId) return null;
  return cached.role;
}

/**
 * Whether the UI should offer something.
 *
 * Takes the live permission list when there is one and falls back to the cache
 * when there is not, which is what makes a disconnected till behave the same
 * as a connected one.
 */
export function can(
  permission: string,
  live: string[] | null | undefined,
  identity?: { userId?: string | null; tenantId?: string | null }
): boolean {
  const effective =
    live && live.length > 0
      ? live
      : cachedPermissions(identity?.userId, identity?.tenantId);

  return effective.includes(permission);
}
