import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { authApi } from "@/lib/apiClient";
import { clearCachedOfflineAuth, disableOfflineMode } from "@/lib/offlineAuth";
import { useAuth } from "@/contexts/AuthContext";
import {
  AuthField,
  AuthHeading,
  AuthShell,
  type AuthAside,
} from "@/components/auth/AuthShell";

/** A member signing in for the first time on a generated password. */
const FIRST_SIGN_IN_ASIDE: AuthAside = {
  icon: ShieldCheck,
  eyebrow: "First sign-in",
  title: "Set a password only you know",
  description:
    "The password you were emailed is meant to be used once. Replacing it now means the invitation, wherever it has been forwarded or archived, stops being a way into this workspace.",
  points: [
    "Nobody else can see what you choose",
    "You will confirm a code next",
  ],
};
import { Button } from "@/components/ui/button";

/**
 * Forced first-login gate for a member created with a generated password
 * (see usersApi.createUser / platformApi.createTenantUser). The temporary
 * password they were emailed is meant to be used exactly once — this page
 * is the only place reachable until they choose one of their own.
 *
 * ProtectedRoute redirects here whenever `mustChangePassword` is set; on
 * success it clears server-side (backend/src/modules/auth/auth.service.ts
 * changePassword()) and this page refreshes the auth session before
 * navigating on, so the redirect does not immediately fire again.
 */
export default function ForcePasswordChange() {
  const navigate = useNavigate();
  const { user, refreshTenant, signOut } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function validate(): string {
    if (!currentPassword) return "Enter the temporary password you were emailed.";
    if (newPassword.length < 8) return "Password must be at least 8 characters";
    if (!/[a-z]/.test(newPassword)) return "Password must contain a lowercase letter";
    if (!/[A-Z]/.test(newPassword)) return "Password must contain an uppercase letter";
    if (!/[0-9]/.test(newPassword)) return "Password must contain a number";
    if (!/[^A-Za-z0-9]/.test(newPassword)) return "Password must contain a symbol";
    if (newPassword !== confirmPassword) return "Passwords do not match.";
    return "";
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setLoading(true);
    try {
      const result = await authApi.changePassword(currentPassword, newPassword);

      /*
       * Drop the cached session before re-reading it.
       *
       * refreshTenant() falls back to the offline cache whenever offline mode
       * is set or the network read throws — and that cache was written during
       * the temp-password sign-in, so it still says `mustChangePassword`.
       * Restoring it puts the gate back that this request just cleared, and
       * ProtectedRoute sends the person straight back to this form: the toast
       * says "password updated" and nothing else appears to happen.
       *
       * The cache is stale in the literal sense too — offline sign-in checks
       * against the old password — so clearing it here is correct regardless.
       */
      disableOfflineMode();
      clearCachedOfflineAuth();

      // Re-read the session: it carries the second-factor flag the route
      // guard checks, and navigating before it lands would bounce.
      await refreshTenant({ authoritative: true });

      /*
       * A password change always ends at the verification step now. The
       * server raises the second factor and emails the code in the same call,
       * so the workspace is never reached on the strength of the change
       * alone — and if this was not the account holder, they get a code they
       * never asked for.
       */
      toast.success(
        result?.otp?.sentTo
          ? `Password updated. We sent a verification code to ${result.otp.sentTo}.`
          : "Password updated. We sent you a verification code."
      );
      navigate("/verify-otp", { replace: true });
    } catch (err: any) {
      setError(err?.message || "Could not update your password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell aside={FIRST_SIGN_IN_ASIDE}>
      <AuthHeading
        title="Choose your password"
        description={
          <>
            Your account was created with a temporary password sent by email. Enter it below with
            the password you want to use from now on.
            {user?.email ? (
              <>
                {" "}
                Signed in as <span className="font-bold text-foreground">{user.email}</span>.
              </>
            ) : null}
          </>
        }
      />

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <AuthField
          id="current-password"
          label="Temporary password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={setCurrentPassword}
          placeholder="From your welcome email"
          icon={<KeyRound className="h-4 w-4" />}
          required
        />

        <AuthField
          id="new-password"
          label="New password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={setNewPassword}
          placeholder="Min 8 characters, upper, lower, number, symbol"
          icon={<LockKeyhole className="h-4 w-4" />}
          required
        />

        <AuthField
          id="confirm-password"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Re-enter your new password"
          icon={<LockKeyhole className="h-4 w-4" />}
          required
        />

        {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}

        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-xl text-[15px] font-semibold"
        >
          <ShieldCheck className="mr-2 h-4 w-4" />
          {loading ? "Updating..." : "Update password and continue"}
        </Button>

        <button
          type="button"
          onClick={() => void signOut()}
          className="w-full text-xs font-bold text-muted-foreground transition hover:text-foreground"
        >
          Sign out instead
        </button>
      </form>
    </AuthShell>
  );
}