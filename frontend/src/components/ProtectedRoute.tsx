import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { getCachedOfflineAuth, isOfflineMode } from "@/lib/offlineAuth";
import { AppShellSkeleton } from "@/components/skeletons";

/*
 * Routes a tenant with a blocked workspace must still be able to reach —
 * the activation screen itself, the ways to unblock it, sign-out/support,
 * and the platform-admin console (whose own members have no tenant at all,
 * so gating them here on a tenant's workspace status would be wrong).
 */
const WORKSPACE_GATE_EXEMPT_PREFIXES = [
  "/activation",
  /*
   * Choosing a plan and paying for it. These run before a workspace exists,
   * so gating them on one being open is a contradiction.
   */
  "/onboarding",
  /*
   * The billing screen is how an unpaid workspace pays, so gating it on the
   * workspace being paid for is a deadlock: the customer whose mobile money
   * prompt timed out was sent to /activation, which could only take a bank
   * transfer reference, with no route back to the card or MoMo retry. It is
   * also where the card gateway returns the payer (/billing/payment-return),
   * carrying the reference that settles the payment.
   */
  "/billing",
  "/onboarding/payment",
  "/pending-approval",
  "/force-password-change",
  "/verify-otp",
  "/platform-admin",
  "/support-access",
  "/support-center",
  "/auth",
];

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const {
    user,
    session,
    loading,
    bootstrapping,
    mustChangePassword,
    otpRequired,
    tenantId,
    isPlatformAdmin,
    workspaceAccessStatus,
  } = useAuth();
  const location = useLocation();

  if (loading || bootstrapping) {
    return <AppShellSkeleton />;
  }

  const cachedOfflineUser = getCachedOfflineAuth()?.user;

  const authenticated =
    !!user ||
    !!session?.access_token ||
    (isOfflineMode() && !!cachedOfflineUser);

  if (!authenticated) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  /*
   * A member created with a generated password (see usersApi.createUser)
   * must choose their own before reaching anything else — the mailed
   * password is meant to be used exactly once. Excluded from the redirect
   * itself, or nobody could ever reach the page that clears the flag.
   */
  if (mustChangePassword && location.pathname !== "/force-password-change") {
    return <Navigate to="/force-password-change" replace />;
  }

  /*
   * Second step of the same first sign-in: having chosen a password proves
   * they can pick one, not that they own the mailbox the temporary password
   * was sent to. Checked after the password gate so the two always run in
   * order, and excluded from its own redirect for the same reason as above.
   *
   * `!mustChangePassword` is what stops the two gates deadlocking. With both
   * flags set, the gate above sends /verify-otp to /force-password-change and
   * this one sent /force-password-change straight back to /verify-otp — an
   * endless ping-pong between the two, which the browser reports as "Maximum
   * update depth exceeded" and then throttles. The password gate owns the
   * person while its flag is set; this one waits its turn.
   */
  if (otpRequired && !mustChangePassword && location.pathname !== "/verify-otp") {
    return <Navigate to="/verify-otp" replace />;
  }

  /*
   * A user with a real tenant membership whose workspace isn't open yet
   * (unpaid, administratively blocked, or an expired trial) lands here from
   * every ordinary route — dashboard included — with nothing to do and no
   * indication why. Send them to the activation screen, which explains the
   * state and is where payment gets completed. Platform-admin accounts have
   * no tenant (tenantId is null for them), so they're never caught by this.
   */
  const workspaceGateExempt = WORKSPACE_GATE_EXEMPT_PREFIXES.some((prefix) =>
    location.pathname.startsWith(prefix),
  );

  /*
   * Signed in with no workspace at all.
   *
   * That is the state signup now leaves people in: the account exists, and
   * choosing a plan is what creates the workspace. Before this they landed on
   * an empty dashboard with every query returning nothing and no indication
   * why. Platform admins legitimately have no tenant, so they are excluded —
   * their own console is already exempt by prefix above.
   */
  const onPlatformConsole = location.pathname.startsWith("/platform-admin");

  if (!workspaceGateExempt && !onPlatformConsole && !tenantId && !isPlatformAdmin) {
    return <Navigate to="/onboarding/plan" replace />;
  }

  /*
   * A blocked workspace is no longer redirected anywhere.
   *
   * It used to be bounced to /activation — a full-screen page with no
   * navigation, from which billing, support and the person's own settings
   * were all unreachable. The app shell now renders as normal and swaps the
   * page area for an explanation (components/WorkspaceLocked.tsx), so the one
   * screen that fixes the problem is a click away in the menu.
   */
  return <>{children}</>;
}