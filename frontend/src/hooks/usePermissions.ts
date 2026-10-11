import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usersApi } from "@/lib/apiClient";
import { onConnectivityChange } from "@/lib/connectivity";
import {
  cachePermissions,
  cachedPermissions,
  cachedRole,
  hasCachedPermissions,
} from "@/lib/permissions";
import { moduleAllowed, normalizePermissions, routeAllowed } from "@/lib/moduleAccess";

/**
 * One answer, shared by everything that asks.
 *
 * The sidebar and the route guard both need this, and the guard remounts on
 * every navigation — one hook instance per consumer would mean two requests on
 * load and another on every click, all returning the same thing. Worse, two
 * instances can briefly hold *different* answers, which is precisely the
 * menu-disagrees-with-the-page bug this whole change is about. So the state
 * lives here, outside React, and every instance reads the same object.
 */
type Snapshot = {
  /** `userId:tenantId` this answer belongs to. Empty when signed out. */
  key: string;
  permissions: string[];
  role: string | null;
  ready: boolean;
  loading: boolean;
  /** When the server last answered. 0 for a cache-seeded or absent answer. */
  fetchedAt: number;
};

const UNKNOWN: Snapshot = {
  key: "",
  permissions: [],
  role: null,
  ready: false,
  loading: false,
  fetchedAt: 0,
};

/**
 * How long a server answer is reused before asking again.
 *
 * `RoleGate` remounts on every navigation, so without this every click cost a
 * request for a list that changes when an administrator edits a role — which
 * is to say, almost never. A minute is short enough that a demotion reaches
 * the screen promptly, and the connection-restored path below ignores this
 * entirely because that is exactly when the answer is most likely to be stale.
 */
const FRESH_MS = 60_000;

let snapshot: Snapshot = UNKNOWN;

const listeners = new Set<() => void>();

let inFlight: Promise<void> | null = null;
let inFlightKey = "";

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return snapshot;
}

function identity(userId?: string | null, tenantId?: string | null) {
  return userId && tenantId ? `${userId}:${tenantId}` : "";
}

function sameList(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * Point the store at a user and workspace, seeding from whatever this device
 * already knows about them.
 *
 * Signing out lands here with an empty key, which resets the store — a shared
 * till must not hand the next person the last one's menu.
 */
function seed(key: string, userId?: string | null, tenantId?: string | null) {
  if (snapshot.key === key) return;

  snapshot = key
    ? {
        key,
        permissions: cachedPermissions(userId, tenantId),
        role: cachedRole(userId, tenantId),
        ready: hasCachedPermissions(userId, tenantId),
        loading: false,
        // A cached answer is usable but not fresh: the first load still asks.
        fetchedAt: 0,
      }
    : UNKNOWN;

  emit();
}

/** What `/auth/me` already told us, so the first paint is not a blank menu. */
function applySession(key: string, permissions: unknown, role: string | null) {
  if (snapshot.key !== key) return;

  const list = normalizePermissions(permissions);
  if (list.length === 0) return;
  if (snapshot.ready && sameList(snapshot.permissions, list) && snapshot.role === role) {
    return;
  }

  snapshot = { ...snapshot, permissions: list, role, ready: true };
  emit();

  const [userId, tenantId] = key.split(":");
  cachePermissions({ userId, tenantId, role, permissions: list });
}

/**
 * Ask the server. Concurrent callers share the one request in flight.
 *
 * An answer that arrives after the workspace has changed underneath it is
 * dropped rather than applied — showing one workspace's menu over another's is
 * how a permission check becomes a data leak.
 */
function load(key: string, force = false): Promise<void> {
  if (!key) return Promise.resolve();
  if (inFlight && inFlightKey === key) return inFlight;

  if (
    !force &&
    snapshot.key === key &&
    snapshot.ready &&
    Date.now() - snapshot.fetchedAt < FRESH_MS
  ) {
    return Promise.resolve();
  }

  const [userId, tenantId] = key.split(":");
  inFlightKey = key;

  snapshot = { ...snapshot, loading: true };
  emit();

  inFlight = (async () => {
    try {
      const fresh = await usersApi.myPermissions();
      if (inFlightKey !== key || snapshot.key !== key) return;

      const normalized = normalizePermissions(fresh.permissions);
      cachePermissions({
        userId,
        tenantId,
        role: fresh.role,
        permissions: normalized,
      });

      snapshot = {
        key,
        permissions: normalized,
        role: fresh.role,
        ready: true,
        loading: false,
        fetchedAt: Date.now(),
      };
    } catch {
      /*
       * Unreachable, or the session has gone. Keep whatever is already on
       * screen rather than blanking it: the cache is the best answer available
       * and the server will refuse anything it disagrees with anyway.
       *
       * `ready` stays as it was. If a cached answer exists we are still
       * entitled to gate on it; if none does, callers must keep treating this
       * as "unknown" rather than as "allowed nothing".
       */
      if (inFlightKey !== key || snapshot.key !== key) return;

      snapshot = {
        ...snapshot,
        permissions:
          snapshot.permissions.length > 0
            ? snapshot.permissions
            : cachedPermissions(userId, tenantId),
        ready: snapshot.ready || hasCachedPermissions(userId, tenantId),
        loading: false,
      };
    } finally {
      if (inFlightKey === key) {
        inFlight = null;
        if (snapshot.key === key && snapshot.loading) {
          snapshot = { ...snapshot, loading: false };
        }
      }
      emit();
    }
  })();

  return inFlight;
}

/**
 * What the signed-in user may do, for the UI to hide what would be refused.
 *
 * The same answer the server enforces — both come from the same resolver, so
 * the screen and the guard cannot drift into disagreeing. That matters more
 * than it sounds: a button that is shown and then refused is a bug report, and
 * one that is hidden when it should work is a support call.
 *
 * ## This is not the security boundary
 *
 * Every check here is advisory. The server re-checks on every request, and
 * again when offline work is replayed — against the role the user has *then*,
 * not the role they had when the till lost its connection. Hiding a button is
 * a courtesy to the person using the app, not a control on what they can do.
 *
 * ## Offline
 *
 * Falls back to what was cached the last time the server answered, scoped to
 * this user and workspace. A disconnected till therefore shows the same screen
 * it showed a minute ago rather than collapsing to a blank one — and if
 * nothing is cached it shows nothing extra, because too little is a support
 * call and too much is a cashier finding they can delete the catalogue.
 *
 * ## `ready`, and why an empty list is not an answer
 *
 * Callers get a `ready` flag alongside the list, and they need it. "This role
 * holds nothing" and "we have not been told yet" are both an empty array, and
 * the right response to each is the opposite of the other: hide everything, or
 * hide nothing until we know. `RoleGate` used to read the empty list as
 * permission to show every page, which meant one failed request opened the
 * whole application. `ready` is true once the server has answered or a cached
 * answer for this exact user and workspace was found — and only then does
 * anything gate strictly.
 */
export function usePermissions() {
  const { user, tenantId, permissions: sessionPermissions, role: sessionRole } = useAuth();

  const key = identity(user?.id, tenantId);
  const state = useSyncExternalStore(subscribe, getSnapshot);

  /*
   * Between a workspace switch and the effect that reseeds the store, the
   * snapshot still describes the *previous* workspace. Report "unknown" for
   * that gap instead — the guard shows a spinner and nothing is decided on
   * someone else's permissions.
   */
  const current = state.key === key ? state : UNKNOWN;

  // An explicit refresh always asks; that is what the caller wanted.
  const refresh = useCallback(() => load(key, true), [key]);

  // /auth/me carries permissions for the initial paint, but always refresh
  // from the permission endpoint as well. Role defaults and workspace
  // overrides can change while a session remains open; trusting the old
  // session list here left a cashier stuck with yesterday's permissions.
  useEffect(() => {
    seed(key, user?.id, tenantId);
    if (!key) return;

    applySession(key, sessionPermissions, sessionRole ?? null);
    void load(key);
  }, [key, user?.id, tenantId, sessionPermissions, sessionRole]);

  /*
   * Re-ask when the connection returns. Someone's role may well have changed
   * while a till was offline — that is exactly when it is worth checking, and
   * it is the moment the queued work is about to be replayed and judged.
   */
  useEffect(
    () => onConnectivityChange((connection) => {
      if (connection === "online") void load(key, true);
    }),
    [key]
  );

  const permissions = current.permissions;

  const can = useCallback(
    (permission: string) => permissions.includes(permission),
    [permissions]
  );

  const canAny = useCallback(
    (...candidates: string[]) => candidates.some((p) => permissions.includes(p)),
    [permissions]
  );

  /**
   * Whether a module should appear at all — true if any of its actions are
   * allowed. Shared with the sidebar and the route guard through
   * `lib/moduleAccess`, so the menu and the page cannot answer differently.
   */
  const canSeeModule = useCallback(
    (module: string | null) => moduleAllowed(permissions, module),
    [permissions]
  );

  /**
   * Whether a route should be offered — by path rather than by module, so the
   * sidebar, the command palette and the route guard all ask one question and
   * cannot answer it differently. Handles the routes that need one named
   * permission (`/billing` wants `settings.billing`, not merely `settings`).
   */
  const canSeeRoute = useCallback(
    (pathname: string) => routeAllowed(permissions, pathname),
    [permissions]
  );

  return useMemo(
    () => ({
      permissions,
      role: current.role,
      loading: current.loading,
      ready: current.ready,
      can,
      canAny,
      canSeeModule,
      canSeeRoute,
      refresh,
    }),
    [
      permissions,
      current.role,
      current.loading,
      current.ready,
      can,
      canAny,
      canSeeModule,
      canSeeRoute,
      refresh,
    ]
  );
}
