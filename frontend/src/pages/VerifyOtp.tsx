import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, Loader2, MailCheck, RefreshCcw, ShieldCheck } from "lucide-react";
import { ApiError, authApi } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import {
  AuthHeading,
  AuthShell,
  type AuthAside,
} from "@/components/auth/AuthShell";

/**
 * The second factor.
 *
 * Worth explaining rather than just demanding: somebody who has just set a
 * password and is immediately asked for a code assumes something has gone
 * wrong. Saying why turns an obstacle into a reassurance.
 */
const OTP_ASIDE: AuthAside = {
  icon: MailCheck,
  eyebrow: "One more step",
  title: "We sent you a code",
  description:
    "Choosing a password proves you can pick one. This proves the account is yours — so nobody who intercepted the invitation email can use it.",
  points: [
    "Sent to your email and by text",
    "Valid for a few minutes, then it expires",
    "You will not be asked again on this device",
  ],
};
import { Button } from "@/components/ui/button";

/**
 * The second factor, asked on every sign-in.
 *
 * The password proves knowledge; the code proves the person also controls the
 * mailbox, so a shared or leaked password alone does not reach the workspace.
 * ProtectedRoute keeps every other route out of reach until the flag clears
 * (backend/src/modules/auth/auth.service.ts verifyLoginOtp).
 *
 * A code that has run out is a dead end unless the screen says so and offers
 * the way forward in the same breath — so an expired or burnt-out code
 * switches this screen into a state whose only action is "send me a new one",
 * rather than leaving a disabled button and a countdown the person has to
 * wait out for a code that will never work.
 */

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;

/** Codes the backend raises when the outstanding code can no longer be spent. */
const DEAD_CODE_ERRORS = new Set(["otp_expired", "otp_attempts_exceeded"]);

export default function VerifyOtp() {
  const navigate = useNavigate();
  const { user, refreshTenant, signOut } = useAuth();

  const [digits, setDigits] = useState<string[]>(() => Array(CODE_LENGTH).fill(""));
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [needsNewCode, setNeedsNewCode] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const code = digits.join("");
  const complete = code.length === CODE_LENGTH;

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  // Counts down to zero once, rather than restarting on every render — the
  // interval clears as soon as it reaches the floor.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((seconds) => (seconds <= 1 ? 0 : seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  function resetBoxes() {
    setDigits(Array(CODE_LENGTH).fill(""));
    inputsRef.current[0]?.focus();
  }

  function writeDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setDigits((current) => {
      const next = [...current];
      next[index] = digit;
      return next;
    });
    setError("");
    if (digit && index < CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      // Deleting an empty box steps back rather than doing nothing, which is
      // what every other code field on the web does.
      event.preventDefault();
      inputsRef.current[index - 1]?.focus();
      setDigits((current) => {
        const next = [...current];
        next[index - 1] = "";
        return next;
      });
    }
    if (event.key === "ArrowLeft" && index > 0) inputsRef.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < CODE_LENGTH - 1) inputsRef.current[index + 1]?.focus();
  }

  /** A code pasted whole should fill the row, not land in one box. */
  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    event.preventDefault();
    const next = Array(CODE_LENGTH).fill("");
    pasted.split("").forEach((digit, i) => (next[i] = digit));
    setDigits(next);
    setError("");
    inputsRef.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!complete || verifying || needsNewCode) return;

    setError("");
    setVerifying(true);
    try {
      await authApi.verifyOtp(code);
      toast.success("Verification complete. Welcome to ShopCore.");
      // Re-reads /auth/me so the cleared flag is in context before the
      // redirect; otherwise ProtectedRoute would bounce straight back here.
      await refreshTenant({ authoritative: true });
      // A platform admin has no tenant dashboard — send them to their own
      // console instead, the same split the login page makes.
      const me = await authApi.me().catch(() => null);
      /*
       * Where verification leads depends on how far through signing up they
       * are. A brand-new account has no workspace — the plan screen is what
       * creates one — and sending them to an empty dashboard instead is the
       * dead end this whole flow exists to avoid.
       */
      if (me?.isPlatformAdmin) {
        navigate("/platform-admin", { replace: true });
      } else if (!me?.tenant?.id) {
        const plan = new URLSearchParams(window.location.search).get("plan");
        navigate(plan ? `/onboarding/plan?plan=${plan}` : "/onboarding/plan", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (err: unknown) {
      const dead = err instanceof ApiError && DEAD_CODE_ERRORS.has(err.code);

      if (dead) {
        // Nothing the person types will work now, so stop asking them to type
        // and let them ask for a fresh code immediately.
        setNeedsNewCode(true);
        setCooldown(0);
      }

      setError(
        err instanceof Error ? err.message : "Could not verify that code.",
      );
      resetBoxes();
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    if ((cooldown > 0 && !needsNewCode) || resending) return;
    setResending(true);
    setError("");
    try {
      const result = await authApi.requestOtp();
      setSentTo(result.sentTo);
      setNeedsNewCode(false);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      resetBoxes();
      toast.success(
        result.sentTo ? `A new code is on its way to ${result.sentTo}.` : "A new code has been sent.",
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not send a new code.");
    } finally {
      setResending(false);
    }
  }

  const destination = sentTo ?? user?.email ?? "your email";

  return (
    <AuthShell aside={OTP_ASIDE}>
      <AuthHeading
        title="Verify it's you"
        description={
          <>
            We sent a {CODE_LENGTH}-digit code to{" "}
            <span className="font-bold text-foreground">{destination}</span>. Enter it below to
            finish signing in.
          </>
        }
      />

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div className="flex items-center justify-between gap-2">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(element) => (inputsRef.current[index] = element)}
              value={digit}
              onChange={(event) => writeDigit(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              onPaste={handlePaste}
              inputMode="numeric"
              disabled={needsNewCode}
              autoComplete={index === 0 ? "one-time-code" : "off"}
              aria-label={`Digit ${index + 1} of ${CODE_LENGTH}`}
              maxLength={1}
              className="h-14 w-full rounded-lg border border-border bg-card text-center font-data text-2xl font-bold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-40"
            />
          ))}
        </div>

        {needsNewCode ? (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-xs font-medium leading-5 text-amber-700 dark:text-amber-300">
              {error || "That code is no longer valid."} Send yourself a new one to continue.
            </p>
          </div>
        ) : error ? (
          <p className="text-xs font-semibold text-rose-600">{error}</p>
        ) : null}

        {needsNewCode ? (
          <Button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="h-11 w-full rounded-xl text-[15px] font-semibold"
          >
            {resending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending a new code...
              </>
            ) : (
              <>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Send me a new code
              </>
            )}
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={!complete || verifying}
            className="h-11 w-full rounded-xl text-[15px] font-semibold"
          >
            {verifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Verify and continue
              </>
            )}
          </Button>
        )}

        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={handleResend}
            disabled={(cooldown > 0 && !needsNewCode) || resending}
            className="font-bold text-primary transition hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
          >
            {resending
              ? "Sending..."
              : cooldown > 0 && !needsNewCode
                ? `Resend code in ${cooldown}s`
                : "Send a new code"}
          </button>

          <button
            type="button"
            onClick={() => void signOut()}
            className="font-bold text-muted-foreground transition hover:text-foreground"
          >
            Sign out
          </button>
        </div>

        <p className="flex items-start gap-2 border-t border-border pt-5 text-[11px] leading-5 text-muted-foreground">
          <MailCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          The code expires shortly after it is sent. If it has run out, send yourself a new one —
          only the newest code works.
        </p>
      </form>
    </AuthShell>
  );
}
