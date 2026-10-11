import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, LinkIcon, LockKeyhole, ShieldCheck } from "lucide-react";

/** Setting the new password. */
const RESET_ASIDE: AuthAside = {
  icon: KeyRound,
  eyebrow: "Reset your password",
  title: "Choose a new password",
  description:
    "Pick something you have not used here before. Every other device is signed out once you set it, so a forgotten password cannot leave a session open somewhere else.",
  points: [
    "Your workspace and data are untouched",
    "This link works once and then expires",
  ],
};

/** The dead-link case, which is a different message entirely. */
const EXPIRED_ASIDE: AuthAside = {
  icon: LinkIcon,
  eyebrow: "Link expired",
  title: "This link has already been used",
  description:
    "Reset links are good for one hour and one use — that is what stops an old email in somebody's inbox from becoming a way in. Ask for a fresh one and it will arrive in a moment.",
};
import {
  AuthField,
  AuthHeading,
  AuthShell,
  type AuthAside,
} from "@/components/auth/AuthShell";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");

  const validatePassword = (pwd: string): string => {
    if (pwd.length < 8) {
      return "Password must be at least 8 characters";
    }
    if (!/[A-Z]/.test(pwd)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/[a-z]/.test(pwd)) {
      return "Password must contain at least one lowercase letter";
    }
    if (!/[0-9]/.test(pwd)) {
      return "Password must contain at least one number";
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) {
      return "Password must contain at least one special character";
    }
    return "";
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setPasswordError(validatePassword(value));
    if (confirmPassword && value !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match");
    } else if (confirmPassword && value === confirmPassword) {
      setConfirmPasswordError("");
    }
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    if (value && value !== password) {
      setConfirmPasswordError("Passwords do not match");
    } else {
      setConfirmPasswordError("");
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const pwdError = validatePassword(password);
    if (pwdError) {
      toast.error(pwdError);
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await authApi.completePasswordReset(token, password);
      toast.success("Password updated successfully! Please log in.");
      navigate("/auth", { replace: true });
    } catch (error: any) {
      toast.error(error?.message || "Password reset failed");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthShell aside={EXPIRED_ASIDE}>
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Link no longer valid</h2>
          <p className="mt-3 text-sm font-medium leading-6 text-muted-foreground">
            This password reset link has expired or has already been used. Reset links are good for
            one hour and one use — ask for a fresh one from the sign-in page.
          </p>
          <Button
            onClick={() => navigate("/auth")}
            className="mt-8 h-11 w-full rounded-xl text-[15px] font-semibold"
          >
            Back to sign in
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell aside={RESET_ASIDE}>
      <AuthHeading
        title="Set a new password"
        description="Choose the password you will sign in with from now on. Every other device stays signed out until it is used."
      />

      <form onSubmit={handleReset} className="mt-8 space-y-5">
        <AuthField
          id="new-password"
          label="New password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={password}
          onChange={handlePasswordChange}
          placeholder="Min 8 characters, upper, lower, number, symbol"
          icon={<LockKeyhole className="h-4 w-4" />}
          required
          right={
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />
        {passwordError && <p className="text-xs font-semibold text-rose-600">{passwordError}</p>}

        <AuthField
          id="confirm-password"
          label="Confirm password"
          type={showConfirmPassword ? "text" : "password"}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={handleConfirmPasswordChange}
          placeholder="Re-enter your new password"
          icon={<LockKeyhole className="h-4 w-4" />}
          required
          right={
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />
        {confirmPasswordError && (
          <p className="text-xs font-semibold text-rose-600">{confirmPasswordError}</p>
        )}

        <Button
          type="submit"
          disabled={loading || !!passwordError || !!confirmPasswordError}
          className="h-11 w-full rounded-xl text-[15px] font-semibold"
        >
          <ShieldCheck className="mr-2 h-4 w-4" />
          {loading ? "Updating..." : "Update password"}
        </Button>

        <Link
          to="/auth"
          className="block text-center text-xs font-bold text-muted-foreground transition hover:text-foreground"
        >
          Back to sign in
        </Link>
      </form>
    </AuthShell>
  );
}