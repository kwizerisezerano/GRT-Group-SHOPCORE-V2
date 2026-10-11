import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Lock,
  ShieldCheck,
  Smartphone,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  AuthField,
  AuthHeading,
  AuthShell,
  type AuthAside,
} from "@/components/auth/AuthShell";
import { StepDots } from "@/components/onboarding/StepDots";
import { PaymentBrandMark, brandFor } from "@/components/payments/PaymentBrandMark";
import { FormSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { workspaceApi } from "@/lib/apiClient";
import {
  paymentsApi,
  subscriptionApi,
  type PaymentMethodOption,
} from "@/lib/subscriptionApi";
import {
  clearOnboardingBusiness,
  clearPlanChoice,
  clearSignedContract,
  readOnboardingBusiness,
  readPlanChoice,
  readSignedContract,
  rememberSignupOutcome,
} from "@/lib/onboardingDraft";
import { cn } from "@/lib/utils";

/**
 * Step four: paying.
 *
 * Creating the workspace and charging for it are one request
 * (POST /workspace/pending), so a customer cannot end up with a workspace
 * nobody ever tried to charge for. What happens next depends on the rail:
 * mobile money leaves them here watching for the prompt they just approved,
 * card sends them to the gateway's own page, bank transfer says we will be in
 * touch.
 *
 * Nothing on this screen claims the workspace is open. That is decided by the
 * gateway's callback and read back by polling the payment's status.
 */

type Phase = "choosing" | "starting" | "waiting" | "paid" | "failed" | "manual";

const money = (value: number, currency = "RWF") =>
  `${currency} ${Math.round(value).toLocaleString()}`;

/** Paying. The reassurance here is about safety, not features. */
const PAY_ASIDE: AuthAside = {
  icon: ShieldCheck,
  eyebrow: "Secure payment",
  title: "Pay the way you already pay",
  description:
    "Mobile money settles in seconds — you approve a prompt on your phone. Card payments go through the gateway's own secure page.",
  points: [
    "We never see your PIN or card number",
    "Your workspace opens the moment payment clears",
    "Bank transfer is confirmed by our team",
  ],
};

/** Waiting on the gateway is its own state, and reads differently. */
const WAITING_ASIDE: AuthAside = {
  icon: Smartphone,
  eyebrow: "Almost there",
  title: "One approval away",
  description:
    "We have asked your provider for the payment. As soon as they confirm it, this page lets you straight into your workspace.",
};

const CYCLE_LABEL: Record<string, string> = {
  monthly: "Monthly",
  six_months: "Every 6 months",
  annual: "Annual",
};

export default function Checkout() {
  const { user, loading, tenantId, signOut } = useAuth();
  const navigate = useNavigate();

  const choice = readPlanChoice();
  const business = readOnboardingBusiness();
  /*
   * Scoped to the signed-in account. The draft outlives a sign-out now, and a
   * signature left behind on a shared laptop must never be spent under the
   * next person's name.
   */
  const contract = readSignedContract(user?.id);

  const [methodCode, setMethodCode] = useState("");
  const [payerPhone, setPayerPhone] = useState(business?.businessPhone ?? "");
  const [phase, setPhase] = useState<Phase>("choosing");
  /** Set only when the card tab was blocked, so the page can offer a link. */
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [failureMessage, setFailureMessage] = useState("");

  const plansQuery = useQuery({
    queryKey: ["onboarding", "plans"],
    queryFn: () => subscriptionApi.plans(),
    staleTime: 5 * 60 * 1000,
  });

  const methodsQuery = useQuery({
    queryKey: ["onboarding", "payment-methods"],
    queryFn: () => subscriptionApi.paymentMethods(),
    staleTime: 5 * 60 * 1000,
  });

  const methods = methodsQuery.data ?? [];
  const plan = plansQuery.data?.find((entry) => entry.code === choice?.planCode) ?? null;
  const price =
    plan?.prices.find((entry) => entry.billing_cycle === choice?.billingCycle) ?? null;

  useEffect(() => {
    if (!methodCode && methods.length > 0) setMethodCode(methods[0].code);
  }, [methods, methodCode]);

  const selectedMethod = methods.find((method) => method.code === methodCode) ?? null;

  /*
   * Poll while the charge is in flight. The gateway's callback is what
   * actually settles it; this is how the browser finds out. Stops the moment
   * the payment resolves, and gives up after roughly three minutes — longer
   * than a mobile money prompt stays alive.
   */
  useEffect(() => {
    if (phase !== "waiting" || !reference) return;

    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;

      try {
        const transaction = await paymentsApi.status(reference);
        if (cancelled) return;

        if (transaction.status === "success") {
          setPhase("paid");
          clearPlanChoice();
          clearOnboardingBusiness();
          clearSignedContract();

          /*
           * Signing up ends here, at the sign-in screen.
           *
           * The session that carried them through the four steps was minted
           * before there was a workspace or a paid subscription to attach to
           * it. Ending it and asking them to sign in properly means the first
           * session that ever reaches the workspace is one issued *after* the
           * payment cleared — and it makes the boundary obvious to the person
           * too: the account is set up, now log in and use it.
           *
           * Signing out is what actually gets them there: /auth bounces an
           * already-signed-in visitor straight to the dashboard, so navigating
           * without clearing the session would land them exactly where this is
           * meant to avoid.
           */
          rememberSignupOutcome("paid");

          setTimeout(async () => {
            await signOut();
            navigate("/auth", { replace: true });
          }, 1800);

          return;
        }

        if (transaction.status === "failed" || transaction.status === "cancelled") {
          setPhase("failed");
          setFailureMessage(transaction.status_detail ?? "The payment was not completed.");
          return;
        }
      } catch {
        // A single missed poll means nothing; the next one answers.
      }

      if (!cancelled && attempts < 60) setTimeout(poll, 3000);
      else if (!cancelled) {
        setPhase("failed");
        /*
         * The browser gives up at three minutes; the server keeps asking the
         * gateway for six (lib/payments/settlementPoller.ts). So this is "we
         * stopped watching", not "you did not pay" — and the workspace can
         * still open by itself after this screen is shown. Saying a person
         * will look into it was true before the poller existed and would now
         * send someone to support for something already handled.
         */
        setFailureMessage(
          "The prompt was not approved in time. If you did approve it, your workspace will open on its own within a few minutes — sign in and check.",
        );
      }
    };

    const timer = setTimeout(poll, 2500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phase, reference, navigate, signOut]);

  /*
   * The unauthenticated guard stands down once a charge has been started.
   *
   * The success path deliberately signs the onboarding session out and sends
   * the person to /auth?welcome=paid. Without the phase check, clearing the
   * session re-renders this component, the guard fires first and redirects to
   * a bare /auth — losing the parameter that tells the sign-in screen what
   * just happened.
   */
  if (!loading && !user && phase === "choosing") return <Navigate to="/auth" replace />;
  if (!loading && tenantId && phase === "choosing") return <Navigate to="/billing" replace />;
  if (!choice) return <Navigate to="/onboarding/plan" replace />;
  /*
   * No signature, no payment screen. Reaching here without one means the
   * signing step was skipped or its session storage was lost, and charging for
   * an agreement nobody signed is the failure this ordering exists to prevent.
   */
  if (!contract && phase === "choosing") return <Navigate to="/onboarding/contract" replace />;

  const needsPhone = selectedMethod?.requires_phone ?? false;
  const ready = Boolean(selectedMethod) && (!needsPhone || payerPhone.trim().length >= 9);
  const busy = phase === "starting";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready || busy || !selectedMethod) return;

    /*
     * The card tab is opened here, in the click itself, and pointed at the
     * gateway later.
     *
     * Every browser blocks `window.open` that is not a direct result of a user
     * gesture, and we only learn the gateway's URL after an await — by which
     * point the gesture has expired and the popup is silently swallowed. So we
     * claim the tab now, while the click is still on the stack, and set its
     * location once the URL arrives. If it comes back null the blocker won, and
     * `cardUrl` gives the waiting screen a real link to offer instead.
     */
    const cardTab =
      !selectedMethod.is_manual && !selectedMethod.requires_phone
        ? window.open("", "_blank")
        : null;

    /*
     * Sever the link by hand rather than passing "noopener".
     *
     * `window.open(..., "noopener")` returns **null** by specification — the
     * whole point is to hand back no reference — so the tab opened and then
     * sat blank forever, because there was no handle to point at the gateway.
     * Nulling `opener` on the still-same-origin blank page achieves the same
     * protection (the gateway cannot reach back through `window.opener`) while
     * leaving us the handle we need.
     */
    if (cardTab) cardTab.opener = null;

    setPhase("starting");

    try {
      const result = await workspaceApi.createPending({
        business_name: business?.businessName ?? "My business",
        business_phone: business?.businessPhone || undefined,
        business_location: business?.businessLocation || undefined,
        business_type: business?.businessType || undefined,
        team_size: business?.teamSize || undefined,
        tin_number: business?.tinNumber || undefined,
        plan_code: choice.planCode,
        billing_cycle: choice.billingCycle,
        payment_method: selectedMethod.code,
        payer_phone: payerPhone.trim() || undefined,
        contract: contract
          ? {
              templateId: contract.templateId,
              signatureImage: contract.signatureImage,
              stampImage: contract.stampImage ?? undefined,
              signerName: contract.signerName,
            }
          : undefined,
      });

      if (selectedMethod.is_manual) {
        setPhase("manual");
        clearPlanChoice();
        toast.success("Workspace reserved", {
          description: "We have emailed you the bank transfer details.",
        });
        return;
      }

      const payment = result.payment;

      if (!payment) {
        setPhase("failed");
        setFailureMessage(
          "Your workspace was created, but the payment could not be started. You can pay from the billing screen.",
        );
        return;
      }

      /*
       * Card payers finish on the gateway's own page, in a second tab.
       *
       * It used to replace this tab, which threw away the onboarding session
       * mid-payment: coming back meant a fresh load with no plan, no business
       * details and nothing polling. Keeping this tab alive means it sits on
       * the waiting screen and lets them in the moment the payment clears,
       * whether they come back to it or not.
       */
      if (payment.redirect_url) {
        setReference(payment.reference_id);
        setPhase("waiting");

        if (cardTab && !cardTab.closed) {
          cardTab.location.href = payment.redirect_url;
          toast.success("Card page opened", {
            description: "Finish paying in the new tab — this page updates on its own.",
          });
        } else {
          // Popup blocked. Offer it as a link the waiting screen can show.
          setCardUrl(payment.redirect_url);
          toast.warning("Your browser blocked the new tab", {
            description: "Use the button on this page to open the card payment.",
            duration: 10000,
          });
        }
        return;
      }

      setReference(payment.reference_id);
      setPhase("waiting");

      toast.success("Prompt sent", {
        description: `Approve the payment on ${payerPhone.trim() || "your phone"} to finish.`,
      });
    } catch (error: any) {
      // Do not leave a blank tab sitting there after a failure.
      cardTab?.close();
      setPhase("choosing");
      toast.error("The payment could not be started", {
        description: error?.message ?? "Please try again, or choose another method.",
      });
    }
  };

  if (phase === "waiting" || phase === "paid" || phase === "failed" || phase === "manual") {
    return (
      <AuthShell aside={WAITING_ASIDE}>
        <PaymentOutcome
          cardUrl={cardUrl}
          phase={phase}
          method={selectedMethod}
          amount={price?.final_price ?? 0}
          currency={price?.currency ?? "RWF"}
          reference={reference}
          message={failureMessage}
          onRetry={() => {
            setPhase("choosing");
            setReference(null);
            setFailureMessage("");
          }}
          onGoToBilling={() => navigate("/billing", { replace: true })}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell aside={PAY_ASIDE}>
      <div className="space-y-7">
        <div>
          <StepDots current={5} total={5} />
          <div className="mt-5">
            <AuthHeading
              title="How would you like to pay?"
              description="Mobile money settles in seconds. Card and bank transfer are here too."
            />
          </div>
        </div>

        {plan && price && (
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Your plan
                </p>
                <p className="mt-1 font-semibold text-foreground">
                  {plan.name} · {CYCLE_LABEL[choice.billingCycle]}
                </p>
              </div>

              <Link
                to="/onboarding/plan"
                className="shrink-0 text-[13px] font-semibold text-primary hover:underline"
              >
                Change
              </Link>
            </div>

            <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
              <span className="text-[13px] text-muted-foreground">Due today</span>
              <span className="text-lg font-bold tracking-tight text-foreground">
                {money(price.final_price, price.currency)}
              </span>
            </div>

            {/*
              The gateway adds its own processing fee on top of what we ask
              for, on a banded schedule we do not control and they do not
              publish — RWF 35,000 arrives on the handset as 36,400. Saying so
              here is the difference between an expected charge and a customer
              stopping mid-payment because the number on their phone is not
              the number they agreed to. We deliberately do not print a
              computed total: the bands are theirs to change, and a wrong
              figure would be worse than an honest warning.
            */}
            {!selectedMethod?.is_manual && (
              <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                Your payment provider adds a processing fee, so the amount you approve will be a
                little higher than this.
              </p>
            )}
          </div>
        )}

        <form className="space-y-5" onSubmit={submit}>
          {methodsQuery.isLoading ? (
            <FormSkeleton fields={3} />
          ) : (
            <div className="space-y-2.5" role="radiogroup" aria-label="Payment method">
              {methods.map((method) => (
                <MethodOption
                  key={method.code}
                  method={method}
                  selected={method.code === methodCode}
                  disabled={busy}
                  onSelect={() => setMethodCode(method.code)}
                />
              ))}
            </div>
          )}

          {needsPhone && (
            <AuthField
              id="checkout-phone"
              label={`${selectedMethod?.name} number`}
              type="tel"
              autoComplete="tel"
              value={payerPhone}
              onChange={setPayerPhone}
              placeholder="+250 78 000 0000"
              icon={<Smartphone className="h-4 w-4" />}
              hint="We will send the payment prompt to this number."
              required
              disabled={busy}
            />
          )}

          {selectedMethod?.is_manual && (
            <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/30 p-3.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                We will email you the transfer details. Your workspace opens once we have confirmed
                the money arrived — usually the same working day.
              </p>
            </div>
          )}

          <div className="flex gap-2.5">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              className="h-11 rounded-xl px-4 font-semibold"
              onClick={() => navigate("/onboarding/plan")}
              aria-label="Back to plans"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <Button
              type="submit"
              disabled={!ready || busy}
              className="h-11 flex-1 rounded-xl text-[15px] font-semibold"
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {/*
                    Names what is happening rather than "Please wait", and
                    names it per rail. The gateway holds our request open while
                    it pushes the prompt, so this sits on screen for several
                    seconds — during which the customer's phone is already
                    asking them to approve. "Sending the prompt" tells them to
                    look at it; a card payer is about to be redirected instead
                    and should be told that, not told to check a phone.
                  */}
                  {needsPhone
                    ? "Sending the prompt…"
                    : selectedMethod?.is_manual
                      ? "Creating your workspace…"
                      : "Opening the card page…"}
                </>
              ) : selectedMethod?.is_manual ? (
                "Create my workspace"
              ) : (
                `Pay ${money(price?.final_price ?? 0, price?.currency)}`
              )}
            </Button>
          </div>

          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            Your payment is handled by the provider — we never see your PIN or card number.
          </p>
        </form>
      </div>
    </AuthShell>
  );
}

function MethodOption({
  method,
  selected,
  disabled,
  onSelect,
}: {
  method: PaymentMethodOption;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3.5 rounded-xl border p-3 text-left transition",
        selected
          ? "border-primary bg-primary/[0.04] ring-1 ring-primary"
          : "border-border hover:border-primary/40",
        disabled && "opacity-60",
      )}
    >
      <PaymentBrandMark brand={brandFor({ provider: method.provider, code: method.code })} />

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{method.name}</span>
        {method.description && (
          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
            {method.description}
          </span>
        )}
      </span>

      <span
        className={cn(
          "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition",
          selected ? "border-primary bg-primary" : "border-border",
        )}
      >
        {selected && (
          <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" aria-hidden="true" />
        )}
      </span>
    </button>
  );
}

/**
 * The screen between paying and being let in.
 *
 * Mobile money waits on a person finding their phone and typing a PIN, which
 * can take a minute — so this says what it is waiting for rather than showing
 * a spinner that looks broken.
 */
function PaymentOutcome({
  phase,
  method,
  amount,
  currency,
  reference,
  message,
  cardUrl,
  onRetry,
  onGoToBilling,
}: {
  phase: Phase;
  method: PaymentMethodOption | null;
  amount: number;
  currency: string;
  reference: string | null;
  message: string;
  /** Present only when the browser blocked the card tab we tried to open. */
  cardUrl: string | null;
  onRetry: () => void;
  onGoToBilling: () => void;
}) {
  /*
   * Mobile money and card wait for different things in different places, and
   * telling a card payer to "check your phone" is the kind of small wrongness
   * that makes someone abandon a payment. `requires_phone` is the same flag
   * the form uses to decide whether to ask for a number.
   */
  const onPhone = method?.requires_phone ?? false;

  const content = {
    waiting: {
      icon: <Loader2 className="h-6 w-6 animate-spin text-primary" />,
      tone: "bg-primary/10",
      title: onPhone ? "Check your phone" : "Confirming your payment",
      /*
       * Deliberately not "we have asked for {amount}". The gateway adds its
       * own fee, so the handset asks for more than the price we just showed —
       * quoting our figure here would have the customer comparing two numbers
       * that do not match at the exact moment they decide whether to trust it.
       */
      body: onPhone
        ? `We sent a prompt to ${method?.name ?? "your provider"}. Approve it with your PIN — the amount includes your provider's fee, so it will be slightly more than the price above. This page lets you in by itself.`
        : "Finish on your bank's card page if it is still open. As soon as the payment clears, this page lets you in by itself.",
    },
    paid: {
      icon: <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />,
      tone: "bg-emerald-500/10",
      title: "Payment received",
      body: "Your workspace is open. Taking you to the sign-in screen — use the email and password you just set up.",
    },
    failed: {
      icon: <XCircle className="h-6 w-6 text-rose-600 dark:text-rose-400" />,
      tone: "bg-rose-500/10",
      title: "The payment did not go through",
      body: message || "Nothing was charged. You can try again.",
    },
    manual: {
      icon: <CheckCircle2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />,
      tone: "bg-blue-500/10",
      title: "Your workspace is reserved",
      body: `We have emailed you the transfer details. As soon as we see the ${money(amount, currency)} arrive, we will open your workspace and let you know.`,
    },
  }[phase as "waiting" | "paid" | "failed" | "manual"];

  if (!content) return null;

  return (
    <div className="text-center">
      <div
        className={cn(
          "mx-auto flex h-14 w-14 items-center justify-center rounded-2xl",
          content.tone,
        )}
      >
        {content.icon}
      </div>

      <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground">{content.title}</h1>
      <p className="mx-auto mt-2.5 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
        {content.body}
      </p>

      {reference && (
        <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Reference
          </span>
          <span className="font-mono text-xs font-semibold text-foreground">{reference}</span>
        </div>
      )}

      <div className="mt-8 space-y-2.5">
        {phase === "failed" && (
          <Button onClick={onRetry} className="h-11 w-full rounded-xl font-semibold">
            Try another payment method
          </Button>
        )}

        {(phase === "failed" || phase === "manual") && (
          <Button
            variant="outline"
            onClick={onGoToBilling}
            className="h-11 w-full rounded-xl font-semibold"
          >
            Go to billing
          </Button>
        )}

        {/*
          Only rendered when the popup was blocked. A blocked card payer would
          otherwise sit on "confirming" forever, waiting on a page that never
          opened — so this is the one route left to the gateway, and it is a
          real click, which no blocker refuses.
        */}
        {phase === "waiting" && cardUrl && (
          <Button
            asChild
            className="h-11 w-full rounded-xl font-semibold"
          >
            <a href={cardUrl} target="_blank" rel="noopener noreferrer">
              Open the card payment page
            </a>
          </Button>
        )}

        {phase === "waiting" && (
          <p className="text-[13px] text-muted-foreground">
            {onPhone
              ? "Nothing to do here — leave this page open."
              : cardUrl
                ? "Your browser blocked the new tab. Use the button above to finish paying."
                : "Finish in the tab that just opened. Leave this page open."}
          </p>
        )}
      </div>
    </div>
  );
}
