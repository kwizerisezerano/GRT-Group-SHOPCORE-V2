import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { authApi } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertTriangle,
  ArrowLeft,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  Mail,
  MailCheck,
  PartyPopper,
} from "lucide-react";
import {
  clearSignupOutcome,
  hasSignedContract,
  peekSignupOutcome,
  readPlanChoice,
} from "@/lib/onboardingDraft";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  AuthField,
  AuthHeading,
  AuthShell,
  type AuthAside,
} from "@/components/auth/AuthShell";

/** Signing in. */
const SIGN_IN_ASIDE: AuthAside = {
  icon: LayoutDashboard,
  eyebrow: "Welcome back",
  title: "Sign in to access your workspace",
  description:
    "Your till, your stock and your books are exactly where you left them.",
  points: [
    "Your team's permissions travel with them",
    "Sign-in codes arrive by email and by text",
    "One workspace, every branch",
  ],
};

/**
 * Arriving straight from signup.
 *
 * The panel has to acknowledge what just happened, or a person who has this
 * second finished paying reads a generic "welcome back" and wonders whether
 * their payment registered at all.
 */
const WELCOME_ASIDE: Record<"paid" | "trial", AuthAside> = {
  paid: {
    icon: PartyPopper,
    eyebrow: "You are all set",
    title: "Your workspace is ready",
    description:
      "The payment cleared and the workspace is open. Sign in with the email and password you just chose to start using it.",
    points: [
      "Everything you set up is already there",
      "Invite your team once you are inside",
      "Your subscription is visible under Billing",
    ],
  },
  trial: {
    icon: PartyPopper,
    eyebrow: "Trial started",
    title: "Your free trial is running",
    description:
      "The workspace is open for the length of the trial. Sign in with the email and password you just chose to start using it.",
    points: [
      "Nothing has been charged",
      "You can pay at any point from Billing",
      "Your data stays if you decide to continue",
    ],
  },
};

/** The forgot-password detour, which is a different errand entirely. */
const RESET_ASIDE: AuthAside = {
  icon: KeyRound,
  eyebrow: "Account recovery",
  title: "We will email you a reset link",
  description:
    "Enter the address you sign in with. The link is valid for a short time and can only be used once.",
  points: [
    "Your workspace and data are untouched",
    "Nobody else is told the link was requested",
  ],
};

export default function Login() {
  const { user, loading, adoptSession } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  /*
   * Set by the last step of signing up (Checkout / ChoosePlan), which ends by
   * signing the onboarding session out and sending the person here. Read once
   * into state so the message survives the re-renders that sign-out causes and
   * does not reappear afterwards.
   */
  const [justSignedUp] = useState(peekSignupOutcome);

  /* Shown once: clear it after the first render so a refresh does not repeat it. */
  useEffect(() => clearSignupOutcome(), []);

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSentTo, setForgotSentTo] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState("");

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await authApi.login(loginEmail.trim(), loginPassword);

      // The subscription-approval workflow (is_platform_admin gating aside)
      // is deferred - new subscriptions are always created pre-approved by
      // the new backend, so there's no "pending approval" state to check
      // for here anymore.
      const me = await authApi.me();

      /*
       * Awaited rather than announced. The event this used to dispatch is
       * fire-and-forget, so the navigation below could reach a guarded route
       * before the provider had read the session back — the same race that
       * bounced a fresh signup to /auth.
       */
      await adoptSession();

      toast.success("Welcome back.");
      window.dispatchEvent(new Event("shopcore-online-login"));

      if (me.isPlatformAdmin) {
        navigate("/platform-admin", { replace: true });
        return;
      }

      /*
       * An account with no workspace has not finished signing up — choosing a
       * plan is what creates one. Sending them to the dashboard instead means
       * an empty screen with no explanation and nothing to click.
       *
       * If they left a saved plan and a signed contract from a previous
       * session (e.g. they signed but never paid), skip straight to checkout
       * rather than making them walk the whole flow again.
       */
      if (!me.tenant?.id) {
        const savedPlan = readPlanChoice();
        if (savedPlan && hasSignedContract(me.user.id)) {
          navigate("/onboarding/checkout", { replace: true });
        } else if (savedPlan) {
          navigate("/onboarding/contract", { replace: true });
        } else {
          navigate("/onboarding/plan", { replace: true });
        }
        return;
      }

      navigate("/dashboard", { replace: true });
    } catch (error: any) {
      toast.error(error?.message || t("login.loginFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Asks for a reset link.
   *
   * The server answers 202 with the same body whether or not the address has
   * an account — deliberately, so this endpoint cannot be used to find out
   * which addresses are registered. That means the screen genuinely cannot
   * say "no account found": it is never told. What it can do is stop
   * pretending the link definitely went somewhere, so the confirmation is
   * worded for both outcomes and says what to do if nothing arrives.
   *
   * A thrown error here is a real failure — offline, or the API is down — and
   * is the one case worth reporting as a failure.
   */
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const email = forgotEmail.trim();
    if (!email) return;

    setIsLoading(true);
    setForgotError("");

    try {
      // Language for the reset email is resolved server-side from the
      // account's stored profile.language, not passed on the link.
      await authApi.requestPasswordReset(email);
      setForgotSentTo(email);
      toast.success(t("login.resetSent"));
    } catch (error: unknown) {
      setForgotError(
        error instanceof Error && error.message ? error.message : t("login.resetFailed"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  /** Returns the forgot flow to its starting state. */
  const closeForgot = () => {
    setShowForgot(false);
    setForgotSentTo(null);
    setForgotError("");
  };

  return (
    <AuthShell
      aside={
        showForgot
          ? RESET_ASIDE
          : justSignedUp
            ? WELCOME_ASIDE[justSignedUp]
            : SIGN_IN_ASIDE
      }
    >
      {showForgot ? (
        <>
          <AuthHeading
            title={forgotSentTo ? t("login.resetSentTitle") : t("login.forgotPassword")}
            description={
              forgotSentTo
                ? t("login.resetSentBody", { email: forgotSentTo })
                : t("login.resetDescription")
            }
          />

          {forgotSentTo ? (
            /*
             * Sent. The server will not say whether that address has an
             * account, so this cannot claim the mail definitely went out —
             * it says what was attempted and what to do if nothing lands,
             * which is the honest version of "email not found".
             */
            <div className="mt-8 space-y-5">
              <div className="flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4">
                <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <p className="text-xs font-medium leading-5 text-emerald-700 dark:text-emerald-300">
                  {t("login.resetSent")}
                </p>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-xs font-medium leading-5 text-muted-foreground">
                  {t("login.resetSentNoAccount")}
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={isLoading}
                onClick={() => setForgotSentTo(null)}
                className="h-11 w-full rounded-xl text-[15px] font-semibold"
              >
                {t("login.resetSendAgain")}
              </Button>

              <Button
                type="button"
                onClick={closeForgot}
                className="h-11 w-full rounded-xl text-[15px] font-semibold"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("login.backToLogin")}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="mt-8 space-y-5">
              <AuthField
                id="forgot-email"
                label={t("login.email")}
                type="email"
                autoComplete="email"
                value={forgotEmail}
                onChange={(value) => {
                  setForgotEmail(value);
                  setForgotError("");
                }}
                placeholder={t("login.emailPlaceholder")}
                icon={<Mail className="h-4 w-4" />}
                required
              />

              {forgotError && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <p className="text-xs font-semibold leading-5 text-rose-700 dark:text-rose-300">
                    {forgotError}
                  </p>
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading || !forgotEmail.trim()}
                className="h-11 w-full rounded-xl text-[15px] font-semibold"
              >
                {isLoading ? t("login.sendingReset") : t("login.sendReset")}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-xl text-[15px] font-semibold"
                onClick={closeForgot}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("login.backToLogin")}
              </Button>
            </form>
          )}
        </>
      ) : (
        <>
          {justSignedUp && (
            <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3.5">
              <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p className="text-[13px] leading-relaxed text-emerald-800 dark:text-emerald-200">
                {justSignedUp === "paid"
                  ? "Payment received and your workspace is open. Sign in below to start using it."
                  : "Your free trial has started. Sign in below to start using your workspace."}
              </p>
            </div>
          )}

          <AuthHeading title={t("login.title")} description={t("login.description")} />

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <AuthField
              id="login-email"
              label={t("login.email")}
              type="email"
              autoComplete="email"
              value={loginEmail}
              onChange={setLoginEmail}
              placeholder={t("login.emailPlaceholder")}
              icon={<Mail className="h-4 w-4" />}
              required
            />

            <AuthField
              id="login-password"
              label={t("login.password")}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={loginPassword}
              onChange={setLoginPassword}
              placeholder={t("login.passwordPlaceholder")}
              icon={<LockKeyhole className="h-4 w-4" />}
              /*
               * Pasted credentials routinely carry a trailing space, and the
               * server — correctly — treats a space as part of the password,
               * so the attempt fails with "invalid email or password" and
               * nothing on screen explains why. The field is not trimmed
               * (spaces are legal characters and trimming would lock out
               * anyone whose password really ends in one); this just points
               * out what is there, from the browser, about the reader's own
               * input. Never rendered once they retype it.
               */
              hint={
                loginPassword !== loginPassword.trim()
                  ? "This has a space at the start or end — pasted credentials often do, and it will be treated as part of the password."
                  : undefined
              }
              required
              right={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />

            <button
              type="button"
              onClick={() => setShowForgot(true)}
              className="text-xs font-semibold text-primary transition hover:underline"
            >
              {t("login.forgotPassword")}
            </button>

            <Button
              type="submit"
              disabled={isLoading}
              className="h-11 w-full rounded-xl text-[15px] font-semibold"
            >
              {isLoading ? t("login.signingIn") : t("publicNav.login")}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl text-[15px] font-semibold"
              onClick={() => navigate("/signup")}
            >
              {t("login.signupPrompt")}
            </Button>
          </form>
        </>
      )}

      {/* The privacy/terms/support links live in the shell's footer now —
          they were rendered twice on this screen. */}
    </AuthShell>
  );
}