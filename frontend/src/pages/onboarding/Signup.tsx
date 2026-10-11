import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  Receipt,
  Store,
  User,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import {
  AuthField,
  AuthHeading,
  AuthShell,
  type AuthAside,
} from "@/components/auth/AuthShell";
import { AcceptedPayments } from "@/components/payments/PaymentBrandMark";
import { StepDots } from "@/components/onboarding/StepDots";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { authApi } from "@/lib/apiClient";
import { rememberOnboardingBusiness } from "@/lib/onboardingDraft";
import { cn } from "@/lib/utils";

/**
 * Creating the account.
 *
 * Two short steps and nothing else: who you are, and what your shop is called.
 * Choosing a plan and paying happen on their own screens afterwards
 * (/onboarding/plan, /onboarding/checkout), because asking somebody to commit
 * to a price before they even have an account is the step people abandon on —
 * and because a four-step form on a phone is a wall.
 *
 * The account exists the moment this succeeds. If they close the tab on the
 * plan screen they can sign in again and pick up where they left off, which
 * was not true when signup and payment were one transaction.
 */

const BUSINESS_TYPES = [
  { value: "retail", label: "Retail shop" },
  { value: "supermarket", label: "Supermarket" },
  { value: "wholesale", label: "Wholesale" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "restaurant", label: "Restaurant / bar" },
  { value: "hardware", label: "Hardware" },
  { value: "electronics", label: "Electronics" },
  { value: "other", label: "Something else" },
];

const TEAM_SIZES = ["Just me", "2-5", "6-10", "11-25", "26-50", "50+"];

/** Step one: the account. */
const ACCOUNT_ASIDE: AuthAside = {
  icon: UserPlus,
  eyebrow: "Create an account",
  title: "Start selling in a few minutes",
  description:
    "Set up the account first. You pick a plan and pay on the next screens, so nothing is charged yet.",
  points: [
    "No installation and no contract",
    "Pay by MTN, Airtel, card or bank transfer",
    "Free trial on most plans",
  ],
};

/** Step two: the shop it belongs to. */
const BUSINESS_ASIDE: AuthAside = {
  icon: Store,
  eyebrow: "Your business",
  title: "Tell us about the shop",
  description:
    "This is the name your team sees inside the workspace and the one printed on your receipts. You can change it later.",
  points: [
    "One workspace can run several branches",
    "Your staff are invited after setup",
  ],
};

export default function Signup() {
  const { user, loading, adoptSession } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [businessName, setBusinessName] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessLocation, setBusinessLocation] = useState("");
  const [tinNumber, setTinNumber] = useState("");
  const [businessType, setBusinessType] = useState("retail");
  const [teamSize, setTeamSize] = useState("2-5");

  const passwordChecks = [
    { label: "8+ characters", ok: password.length >= 8 },
    { label: "Capital letter", ok: /[A-Z]/.test(password) },
    { label: "Lowercase letter", ok: /[a-z]/.test(password) },
    { label: "Number", ok: /[0-9]/.test(password) },
    { label: "Symbol", ok: /[^A-Za-z0-9]/.test(password) },
  ];

  const accountReady =
    fullName.trim().length > 1 &&
    /\S+@\S+\.\S+/.test(email) &&
    passwordChecks.every((check) => check.ok);

  const businessReady = businessName.trim().length > 1;

  if (!loading && user) {
    return <Navigate to="/onboarding/plan" replace />;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!businessReady || submitting) return;

    setSubmitting(true);

    try {
      await authApi.signup({
        email: email.trim(),
        password,
        displayName: fullName.trim(),
        businessName: businessName.trim(),
        businessPhone: businessPhone.trim() || undefined,
        businessLocation: businessLocation.trim() || undefined,
        businessType,
        teamSize,
      });

      /*
       * Held for the plan screen, which is what actually creates the
       * workspace these details belong to. See lib/onboardingDraft.ts.
       */
      rememberOnboardingBusiness({
        businessName: businessName.trim(),
        businessPhone: businessPhone.trim(),
        businessLocation: businessLocation.trim(),
        businessType,
        teamSize,
        tinNumber: tinNumber.trim(),
      });

      /*
       * `authApi.signup` writes the tokens itself, but this provider does not
       * know that yet — and /verify-otp is a guarded route. Without adopting
       * the session first, the guard sees "signed out" and bounces the brand
       * new account straight back to /auth.
       */
      await adoptSession();

      toast.success("Account created. Check your email for the code.");

      /*
       * Verification first, plan second.
       *
       * Signing up proves somebody can type an address, not that they own it,
       * and this account is about to carry a paid subscription and a
       * workspace of business data. The plan they picked on the way in is
       * carried through the code screen so they land back on it.
       */
      const preselected = searchParams.get("plan");
      navigate(preselected ? `/verify-otp?plan=${preselected}` : "/verify-otp", {
        replace: true,
      });
    } catch (error: any) {
      toast.error(error?.message ?? "We could not create your account.");
      setSubmitting(false);
    }
  };

  return (
    <AuthShell aside={step === 1 ? ACCOUNT_ASIDE : BUSINESS_ASIDE}>
      <div className="space-y-7">
        <div>
          <StepDots current={step} total={5} />

          <div className="mt-5">
            <AuthHeading
              title={step === 1 ? "Create your account" : "About your business"}
              description={
                step === 1
                  ? "You will be the owner of the workspace — the one person who can do everything in it."
                  : "This is the name your team and your receipts will show."
              }
            />
          </div>
        </div>

        {step === 1 ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (accountReady) setStep(2);
            }}
          >
            <AuthField
              id="signup-name"
              label="Full name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={setFullName}
              placeholder="Jean Bosco"
              icon={<User className="h-4 w-4" />}
              required
            />

            <AuthField
              id="signup-email"
              label="Work email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
              placeholder="you@yourbusiness.rw"
              icon={<Mail className="h-4 w-4" />}
              required
            />

            <div>
              <AuthField
                id="signup-password"
                label="Password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={setPassword}
                placeholder="Choose something strong"
                icon={<LockKeyhole className="h-4 w-4" />}
                required
                right={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground/70 transition hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />

              {password.length > 0 && (
                <ul className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1.5">
                  {passwordChecks.map((check) => (
                    <li
                      key={check.label}
                      className={cn(
                        "inline-flex items-center gap-1 text-[11px] font-medium transition",
                        check.ok
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground/60",
                      )}
                    >
                      <Check className={cn("h-3 w-3", !check.ok && "opacity-40")} strokeWidth={3} />
                      {check.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Button
              type="submit"
              disabled={!accountReady}
              className="h-11 w-full rounded-xl text-[15px] font-semibold"
            >
              Continue
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>

            <p className="pt-1 text-center text-sm text-muted-foreground">
              Already have a workspace?{" "}
              <Link to="/auth" className="font-semibold text-primary hover:underline">
                {t("publicNav.login")}
              </Link>
            </p>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={submit}>
            <AuthField
              id="signup-business"
              label="Business name"
              type="text"
              autoComplete="organization"
              value={businessName}
              onChange={setBusinessName}
              placeholder="Kigali Fresh Market"
              icon={<Store className="h-4 w-4" />}
              required
              disabled={submitting}
            />

            <AuthField
              id="signup-phone"
              label="Business phone"
              type="tel"
              autoComplete="tel"
              value={businessPhone}
              onChange={setBusinessPhone}
              placeholder="+250 78 000 0000"
              icon={<Phone className="h-4 w-4" />}
              disabled={submitting}
            />

            {/*
              The TIN goes on the contract and on every invoice. Asked for here
              rather than chased afterwards — an owner signing up has it to
              hand, and a contract with a blank tax number is a contract that
              has to be reissued.
            */}
            <AuthField
              id="signup-tin"
              label="TIN number"
              type="text"
              value={tinNumber}
              onChange={setTinNumber}
              placeholder="102345678"
              icon={<Receipt className="h-4 w-4" />}
              disabled={submitting}
            />

            <AuthField
              id="signup-location"
              label="Where you trade"
              type="text"
              value={businessLocation}
              onChange={setBusinessLocation}
              placeholder="Kigali, Nyarugenge"
              icon={<MapPin className="h-4 w-4" />}
              disabled={submitting}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[13px] font-semibold text-foreground">What you sell</Label>
                <Select value={businessType} onValueChange={setBusinessType} disabled={submitting}>
                  <SelectTrigger className="h-11 rounded-xl font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[13px] font-semibold text-foreground">Team size</Label>
                <Select value={teamSize} onValueChange={setTeamSize} disabled={submitting}>
                  <SelectTrigger className="h-11 rounded-xl font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAM_SIZES.map((size) => (
                      <SelectItem key={size} value={size}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2.5 pt-1">
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                className="h-11 rounded-xl px-4 font-semibold"
                onClick={() => setStep(1)}
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>

              <Button
                type="submit"
                disabled={!businessReady || submitting}
                className="h-11 flex-1 rounded-xl text-[15px] font-semibold"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating your account…
                  </>
                ) : (
                  <>
                    Create account
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>

            <div className="flex flex-col items-center gap-2.5 border-t border-border/70 pt-5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Pay however you already pay
              </p>
              <AcceptedPayments />
            </div>

            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              By continuing you agree to our{" "}
              <Link to="/terms" className="font-medium text-foreground hover:underline">
                terms
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="font-medium text-foreground hover:underline">
                privacy policy
              </Link>
              .
            </p>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
