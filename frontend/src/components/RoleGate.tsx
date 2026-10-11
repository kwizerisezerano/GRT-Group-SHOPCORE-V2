import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { moduleForRoute, permissionForRoute } from "@/lib/moduleAccess";

/**
 * Whether the signed-in member's role reaches this screen.
 *
 * ## One question, not three
 *
 * This guard answers exactly one: does the caller's role hold any permission
 * on the module this route belongs to? It used to answer three at once — role,
 * subscription plan, and whether the workspace had paid — and told the user
 * the same thing for all of them, so an unpaid workspace and a locked plan
 * both reported "your role does not allow access to this page". That sends the
 * owner of the shop to ask themselves for a permission they already have.
 *
 * The other two are already guarded, better and elsewhere:
 *
 *   - the subscription plan by `PlanGuard`, which offers the upgrade;
 *   - workspace activation by `ActivationGuard`, which routes to /activation.
 *
 * ## Why an unknown answer is not a refusal
 *
 * `ready` from `usePermissions` separates "this role holds nothing" from "we
 * have not been told yet". Only the first hides a page. The second waits, and
 * if the request has already failed with nothing cached, it lets the page
 * through — the server checks every call regardless, so a transient failure
 * costs a 403 on one request instead of bricking the application. What it must
 * never do is what the old code did, which was read an empty list as consent
 * and open every screen in the product.
 */
export function RoleGate({ children }: { children: ReactNode }) {
  const { bootstrapping, loading, user, session, role, tenantId } = useAuth();
  const { canSeeRoute, ready, loading: permissionsLoading } = usePermissions();
  const location = useLocation();

  if (loading || bootstrapping) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!user && !session?.access_token) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  if (!tenantId || !role) {
    return (
      <div className="mx-auto mt-24 max-w-md rounded-lg border bg-card p-6 text-center">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <h2 className="mb-1 text-lg font-semibold">No workspace found</h2>
        <p className="text-sm text-muted-foreground">
          Your account is not attached to any workspace yet. Please contact the
          workspace administrator.
        </p>
      </div>
    );
  }

  const module = moduleForRoute(location.pathname);
  const permission = permissionForRoute(location.pathname);

  // Your own profile, and anything outside the map, need no permission: an
  // account is what entitles you to your own account.
  if (!module && !permission) {
    return <>{children}</>;
  }

  if (!ready) {
    /*
     * Still asking. Wait rather than guess — this resolves in one request, and
     * both guesses are wrong in a way somebody notices.
     */
    if (permissionsLoading) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      );
    }

    // Asked, failed, nothing cached. The API is the boundary and it is still
    // standing; do not lock someone out of their own shop over one bad request.
    return <>{children}</>;
  }

  if (!canSeeRoute(location.pathname)) {
    return (
      <div className="mx-auto mt-24 max-w-md rounded-lg border bg-card p-6 text-center">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-destructive" />
        <h2 className="mb-1 text-lg font-semibold">No permission</h2>
        <p className="text-sm text-muted-foreground">
          Your role (<span className="font-medium">{role}</span>) does not
          allow access to this page. Ask a workspace administrator if you need
          it.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
