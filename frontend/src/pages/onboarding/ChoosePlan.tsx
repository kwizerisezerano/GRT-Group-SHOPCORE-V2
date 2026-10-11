import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Infinity as InfinityIcon,
  Layers3,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { AuthHeading, AuthShell } from "@/components/auth/AuthShell";
import { StepDots } from "@/components/onboarding/StepDots";
import { CardGridSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { workspaceApi } from "@/lib/apiClient";
import { subscriptionApi, type SubscriptionPlan } from "@/lib/subscriptionApi";
import {
  clearOnboardingBusiness,
  clearPlanChoice,
  hasSignedContract,
  readOnboardingBusiness,
  readPlanChoice,
  rememberPlanChoice,
  rememberSignupOutcome,
} from "@/lib/onboardingDraft";
import { cn } from "@/lib/utils";

/**
 * Step three: what the customer is buying. (HMR trigger)
 *
 * Each card shows the price for the chosen cycle, the ceilings the plan
 * imposes, and what it opens up — because those three things together are the
 * decision, and a pricing card that shows only a number makes somebody guess.
 * The ceilings shown here are the same rows the server enforces after signup,
 * so nothing on this screen can promise more than the workspace will allow.
 */

type BillingCycle = "monthly" | "six_months" | "annual";

const CYCLES: { value: BillingCycle; label: string; note?: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "six_months", label: "6 months", note: "Save 10%" },
  { value: "annual", label: "Annual", note: "Save 20%" },
];

/** The ceilings that fit on a card. The rest are behind "see everything". */
const HEADLINE_LIMITS = ["users", "branches", "warehouses", "products"];

const money = (value: number, currency = "RWF") =>
  `${currency} ${Math.round(value).toLocaleString()}`;

const priceFor = (plan: SubscriptionPlan, cycle: BillingCycle) =>
  plan.prices.find((price) => price.billing_cycle === cycle) ?? null;

function perMonth(plan: SubscriptionPlan, cycle: BillingCycle) {
  const price = priceFor(plan, cycle);
  if (!price) return null;
  return Math.round(price.final_price / Math.max(1, price.billing_months));
}

export default function ChoosePlan() {
  const { user, loading, tenantId, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const remembered = readPlanChoice();

  const [planCode, setPlanCode] = useState(
    searchParams.get("plan") ?? remembered?.planCode ?? "",
  );
  const [cycle, setCycle] = useState<BillingCycle>(remembered?.billingCycle ?? "monthly");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [trialing, setTrialing] = useState(false);

  const plansQuery = useQuery({
    queryKey: ["onboarding", "plans"],
    queryFn: () => subscriptionApi.plans(),
    staleTime: 5 * 60 * 1000,
  });

  const plans = plansQuery.data ?? [];

  useEffect(() => {
    if (planCode || plans.length === 0) return;
    setPlanCode((plans.find((plan) => plan.is_popular) ?? plans[0]).code);
  }, [plans, planCode]);

  const selected = plans.find((plan) => plan.code === planCode) ?? null;

  /* Only offer a cycle the selected plan is actually priced for. */
  const availableCycles = useMemo(
    () => CYCLES.filter((entry) => plans.some((plan) => priceFor(plan, entry.value))),
    [plans],
  );

  useEffect(() => {
    if (availableCycles.length > 0 && !availableCycles.some((entry) => entry.value === cycle)) {
      setCycle(availableCycles[0].value);
    }
  }, [availableCycles, cycle]);

  /*
   * Both guards stand down while the trial is being started: that path ends by
   * signing the onboarding session out on purpose, and a guard firing on the
   * resulting re-render would redirect to a bare /auth and lose the parameter
   * that tells the sign-in screen a trial just began.
   */
  if (!loading && !user && !trialing) return <Navigate to="/auth" replace />;

  /* Already has a workspace — this step is behind them. */
  if (!loading && tenantId && !trialing) return <Navigate to="/dashboard" replace />;

  const selectedPrice = selected ? priceFor(selected, cycle) : null;

  const proceed = () => {
    if (!selected || !selectedPrice) return;
    rememberPlanChoice({ planCode: selected.code, billingCycle: cycle });

    /*
     * A returning user who already signed the contract should not be forced
     * back through the signing page just to press "continue". If the draft
     * in localStorage belongs to this account, jump straight to checkout;
     * otherwise show them the contract page so they can sign it.
     */
    if (hasSignedContract(user?.id)) {
      navigate("/onboarding/checkout");
    } else {
      navigate("/onboarding/contract");
    }
  };

  /**
   * Opens the workspace on the plan's free trial, charging nothing.
   *
   * The same request the checkout screen makes, minus a payment method — the
   * server reads that as "start the trial" (backend workspace.service.ts) and
   * opens the workspace with an end date on it. When that date passes the
   * subscription resolves to `trial_expired` and the workspace closes until
   * they pay, which is the whole point of offering it.
   */
  const startTrial = async () => {
    if (!selected || trialing) return;

    setTrialing(true);

    try {
      const business = readOnboardingBusiness();

      await workspaceApi.createPending({
        business_name: business?.businessName ?? "My business",
        business_phone: business?.businessPhone || undefined,
        business_location: business?.businessLocation || undefined,
        business_type: business?.businessType || undefined,
        team_size: business?.teamSize || undefined,
        plan_code: selected.code,
        billing_cycle: cycle,
        start_trial: true,
      });

      clearPlanChoice();
      clearOnboardingBusiness();

      toast.success(`Your ${selected.trial_days}-day trial has started. Sign in to open it.`);

      /*
       * Same ending as the paid path: signing up finishes at the sign-in
       * screen. Starting a trial completes onboarding just as paying does, and
       * having the two end differently would be the odd thing.
       */
      rememberSignupOutcome("trial");

      await signOut();
      navigate("/auth", { replace: true });
    } catch (error: any) {
      toast.error(error?.message ?? "The trial could not be started.");
      setTrialing(false);
    }
  };

  return (
    <AuthShell width="wide">
      <div className="space-y-8">
        <div className="flex flex-col gap-5">
          <StepDots current={3} total={5} />

          {/*
            The context the other steps get from the side panel. This step
            keeps the full width — four plan cards will not fit beside a
            paragraph — so it arrives as a banner instead of a column.
          */}
          <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Layers3 className="h-4 w-4" />
            </span>

            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                Choose a plan
              </p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                The limits on each card are enforced — your workspace will hold you to them, and
                nothing is billed on top for going over. You can change plan any time.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <AuthHeading
              title="Choose your plan"
              description="Every plan includes the till, stock and sales. What changes is how many people and shops it covers."
            />

            {availableCycles.length > 1 && (
              <div
                className="inline-flex shrink-0 self-start rounded-xl border border-border p-1 lg:self-auto"
                role="radiogroup"
                aria-label="Billing cycle"
              >
                {availableCycles.map((entry) => (
                  <button
                    key={entry.value}
                    type="button"
                    role="radio"
                    aria-checked={cycle === entry.value}
                    onClick={() => setCycle(entry.value)}
                    className={cn(
                      "rounded-lg px-3.5 py-2 text-[13px] font-semibold transition",
                      cycle === entry.value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {entry.label}
                    {entry.note && (
                      <span
                        className={cn(
                          "ml-1.5 text-[10px] font-bold",
                          cycle === entry.value
                            ? "text-primary-foreground/70"
                            : "text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {entry.note}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {plansQuery.isLoading ? (
          <CardGridSkeleton count={4} height="h-80" />
        ) : plans.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <p className="font-semibold text-foreground">No plans are on sale right now</p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Please contact our team and we will set your workspace up directly.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => (
              <PlanCard
                key={plan.code}
                plan={plan}
                cycle={cycle}
                selected={plan.code === planCode}
                expanded={expanded === plan.code}
                onSelect={() => setPlanCode(plan.code)}
                onToggleDetails={() =>
                  setExpanded((current) => (current === plan.code ? null : plan.code))
                }
              />
            ))}
          </div>
        )}

        {/*
          The summary bar. Sticky at the bottom so the amount and the button
          stay in view while somebody scrolls four cards on a phone — the
          alternative is scrolling back up to find out what they picked.
        */}
        <div className="sticky bottom-0 -mx-5 border-t border-border bg-background/95 px-5 py-4 backdrop-blur sm:-mx-8 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              {selected && selectedPrice ? (
                <>
                  <p className="text-[13px] text-muted-foreground">
                    <span className="font-semibold text-foreground">{selected.name}</span>
                    {" · "}
                    {CYCLES.find((entry) => entry.value === cycle)?.label}
                  </p>
                  <p className="mt-0.5 text-xl font-bold tracking-tight text-foreground">
                    {money(selectedPrice.final_price, selectedPrice.currency)}
                    <span className="ml-1.5 text-[13px] font-medium text-muted-foreground">
                      due today
                    </span>
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Pick a plan to continue</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/*
                Only offered where the plan actually grants one. A "start free"
                button on a plan with no trial days would open a workspace that
                closes again immediately.
              */}
              {selected && selected.trial_days > 0 && (
                <Button
                  variant="outline"
                  onClick={startTrial}
                  disabled={trialing}
                  className="h-11 rounded-xl px-5 text-[15px] font-semibold"
                >
                  {trialing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting…
                    </>
                  ) : (
                    `Start ${selected.trial_days} days free`
                  )}
                </Button>
              )}

              <Button
                onClick={proceed}
                disabled={!selected || !selectedPrice || trialing}
                className="h-11 rounded-xl px-6 text-[15px] font-semibold"
              >
                Review contract and sign
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              You will read and sign the service agreement before any payment is taken.
            </p>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}

function PlanCard({
  plan,
  cycle,
  selected,
  expanded,
  onSelect,
  onToggleDetails,
}: {
  plan: SubscriptionPlan;
  cycle: BillingCycle;
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggleDetails: () => void;
}) {
  const price = priceFor(plan, cycle);
  const monthly = perMonth(plan, cycle);

  const headline = HEADLINE_LIMITS.map((key) =>
    plan.limits.find((limit) => limit.limit_key === key),
  ).filter(Boolean) as SubscriptionPlan["limits"];

  const otherLimits = plan.limits.filter(
    (limit) => !HEADLINE_LIMITS.includes(limit.limit_key),
  );

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border bg-card transition",
        selected
          ? "border-primary ring-1 ring-primary"
          : "border-border hover:border-primary/40",
      )}
    >
      {plan.is_popular && (
        <span className="absolute -top-2.5 left-5 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
          <Sparkles className="h-3 w-3" />
          {plan.badge_text || "Popular"}
        </span>
      )}

      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex flex-1 flex-col p-5 text-left"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-bold text-foreground">{plan.name}</h3>
          <span
            className={cn(
              "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition",
              selected ? "border-primary bg-primary text-primary-foreground" : "border-border",
            )}
          >
            {selected && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
          </span>
        </div>

        {plan.tagline && (
          <p className="mt-1.5 min-h-[36px] text-[13px] leading-relaxed text-muted-foreground">
            {plan.tagline}
          </p>
        )}

        <div className="mt-4">
          <p className="text-2xl font-bold tracking-tight text-foreground">
            {monthly === null ? "—" : money(monthly, price?.currency)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            per month
            {cycle !== "monthly" && price && ` · ${money(price.final_price, price.currency)} billed`}
          </p>
        </div>

        {plan.trial_days > 0 && (
          <p className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {plan.trial_days} days free, then {money(price?.final_price ?? 0, price?.currency)}
          </p>
        )}

        <ul className="mt-4 space-y-2 border-t border-border pt-4">
          {headline.length > 0 ? (
            headline.map((limit) => (
              <li
                key={limit.limit_key}
                className="flex items-center justify-between gap-2 text-[13px]"
              >
                <span className="truncate text-muted-foreground">{limit.name}</span>
                <span className="shrink-0 font-semibold text-foreground">
                  {limit.is_unlimited ? (
                    <InfinityIcon className="h-3.5 w-3.5" />
                  ) : (
                    limit.value?.toLocaleString()
                  )}
                </span>
              </li>
            ))
          ) : (
            <li className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">
              <InfinityIcon className="h-4 w-4" />
              No limits
            </li>
          )}
        </ul>
      </button>

      {(plan.features.length > 0 || otherLimits.length > 0) && (
        <div className="border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onToggleDetails}
            aria-expanded={expanded}
            className="flex w-full items-center justify-between gap-2 text-[12px] font-semibold text-muted-foreground transition hover:text-foreground"
          >
            {expanded ? "Hide details" : `See what's included`}
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")}
            />
          </button>

          {expanded && (
            <div className="mt-3 space-y-3">
              {otherLimits.length > 0 && (
                <ul className="space-y-1.5">
                  {otherLimits.map((limit) => (
                    <li
                      key={limit.limit_key}
                      className="flex items-center justify-between gap-2 text-[12px]"
                    >
                      <span className="truncate text-muted-foreground">{limit.name}</span>
                      <span className="shrink-0 font-semibold text-foreground">
                        {limit.is_unlimited ? "Unlimited" : limit.value?.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {plan.features.length > 0 && (
                <ul className="space-y-1.5 border-t border-border pt-3">
                  {plan.features.map((feature) => (
                    <li key={feature.feature_key} className="flex items-start gap-1.5 text-[12px]">
                      <Check
                        className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400"
                        strokeWidth={3}
                      />
                      <span className="text-foreground">{feature.name}</span>
                      {feature.access_level !== "included" && (
                        <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {feature.access_level}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
