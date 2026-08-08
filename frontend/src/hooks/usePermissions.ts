import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usersApi } from "@/lib/apiClient";
import { onConnectivityChange } from "@/lib/connectivity";
import { cachePermissions, cachedPermissions, cachedRole } from "@/lib/permissions";

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
 */
export function usePermissions() {
  const { user, tenantId, permissions: sessionPermissions, role: sessionRole } = useAuth();

  const [permissions, setPermissions] = useState<string[]>(() =>
    cachedPermissions(user?.id, tenantId)
  );
  const [role, setRole] = useState<string | null>(() => cachedRole(user?.id, tenantId));
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id || !tenantId) return;

    setLoading(true);
    try {
      const fresh = await usersApi.myPermissions();
      setPermissions(fresh.permissions);
      setRole(fresh.role);
      cachePermissions({
        userId: user.id,
        tenantId,
        role: fresh.role,
        permissions: fresh.permissions,
      });
    } catch {
      /*
       * Unreachable, or the session has gone. Keep whatever is already on
       * screen rather than blanking it: the cache is the best answer available
       * and the server will refuse anything it disagrees with anyway.
       */
      setPermissions((current) =>
        current.length > 0 ? current : cachedPermissions(user.id, tenantId)
      );
    } finally {
      setLoading(false);
    }
  }, [user?.id, tenantId]);

  // /auth/me already carries them, so the first paint is usually free.
  useEffect(() => {
    if (!user?.id || !tenantId) return;

    if (Array.isArray(sessionPermissions) && sessionPermissions.length > 0) {
      const list = sessionPermissions as unknown as string[];
      setPermissions(list);
      setRole(sessionRole ?? null);
      cachePermissions({ userId: user.id, tenantId, role: sessionRole ?? null, permissions: list });
      return;
    }

    void refresh();
  }, [user?.id, tenantId, sessionPermissions, sessionRole, refresh]);

  /*
   * Re-ask when the connection returns. Someone's role may well have changed
   * while a till was offline — that is exactly when it is worth checking, and
   * it is the moment the queued work is about to be replayed and judged.
   */
  useEffect(
    () => onConnectivityChange((state) => { if (state === "online") void refresh(); }),
    [refresh]
  );

  const can = useCallback(
    (permission: string) => permissions.includes(permission),
    [permissions]
  );

  const canAny = useCallback(
    (...candidates: string[]) => candidates.some((p) => permissions.includes(p)),
    [permissions]
  );

  /** Whether a module should appear at all — true if any of its actions are allowed. */
  const canSeeModule = useCallback(
    (module: string) => permissions.some((p) => p.startsWith(`${module}.`)),
    [permissions]
  );

  return { permissions, role, loading, can, canAny, canSeeModule, refresh };
}
