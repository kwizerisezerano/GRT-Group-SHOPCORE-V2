import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  Infinity as InfinityIcon,
  Loader2,
  Minus,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { subscriptionApi, type SubscriptionPlan } from "@/lib/subscriptionApi";
import { cn } from "@/lib/utils";

/**
 * The pricing table, built from the live plan catalogue.
 *
 * The important word is live. This reads the same rows the platform console
 * writes, so a plan a super admin creates, reprices or takes off sale is on
 * the marketing site immediately — and the ceilings shown here ("3 team
 * members") are the exact numbers the server will hold the workspace to after
 * they sign up. A pricing page that promises one thing while the API enforces
 * another is a support ticket with a delay on it.
 */

type BillingCycle = "monthly" | "six_months" | "annual";

const CYCLES: { value: BillingCycle; label: string; note?: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "six_months", label: "6 months", note: "Save 10%" },
  { value: "annual", label: "Annual", note: "Save 20%" },
];

/** The ceilings worth comparing on a pricing card; the rest live in the table. */
const HEADLINE_LIMITS = ["users", "branches", "warehouses", "products"];

const money = (value: number, currency = "RWF") =>
  `${currency} ${Math.round(value).toLocaleString()}`;

function priceFor(plan: SubscriptionPlan, cycle: BillingCycle) {
  return plan.prices.find((price) => price.billing_cycle === cycle) ?? null;
}

function perMonth(plan: SubscriptionPlan, cycle: BillingCycle) {
  const price = priceFor(plan, cycle);
  if (!price) return null;
  return Math.round(price.final_price / Math.max(1, price.billing_months));
}

export function PricingTable({ compact = false }: { compact?: boolean }) {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  const plansQuery = useQuery({
    queryKey: ["public", "plans"],
    queryFn: () => subscriptionApi.plans(),
    staleTime: 5 * 60 * 1000,
  });

  const plans = plansQuery.data ?? [];

  /* Only offer a cycle at least one plan is actually priced for. */
  const availableCycles = useMemo(
    () => CYCLES.filter((entry) => plans.some((plan) => priceFor(plan, entry.value))),
    [plans]
  );

  useEffect(() => {
    if (availableCycles.length > 0 && !availableCycles.some((entry) => entry.value === cycle)) {
      setCycle(availableCycles[0].value);
    }
  }, [availableCycles, cycle]);

  if (plansQuery.isLoading) {
    return (
      <div className="flex items-center justify-center rounded-3xl border border-border bg-card p-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-3 text-sm font-bold text-muted-foreground">Loading plans…</span>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card p-16 text-center">
        <p className="text-lg font-bold text-foreground">Pricing is being updated</p>
        <p className="mx-auto mt-2 max-w-sm text-sm font-medium leading-6 text-muted-foreground">
          Nothing is on sale through the website right now.{" "}
          <Link to="/support-center" className="font-semibold text-primary hover:underline">
            Talk to our team
          </Link>{" "}
          and we will set your workspace up directly.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {availableCycles.length > 1 && (
        <div className="flex justify-center">
          <div className="inline-flex rounded-2xl border border-border bg-card p-1.5">
            {availableCycles.map((entry) => (
              <button
                key={entry.value}
                type="button"
                onClick={() => setCycle(entry.value)}
                className={cn(
                  "rounded-xl px-5 py-2.5 transition",
                  cycle === entry.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="block text-sm font-semibold">{entry.label}</span>
                {entry.note && (
                  <span
                    className={cn(
                      "mt-0.5 block text-[10px] font-bold",
                      cycle === entry.value ? "text-primary-foreground/75" : "text-emerald-600 dark:text-emerald-400"
                    )}
                  >
                    {entry.note}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => (
          <PricingCard key={plan.code} plan={plan} cycle={cycle} />
        ))}
      </div>

      {!compact && <LimitComparison plans={plans} />}
    </div>
  );
}

function PricingCard({ plan, cycle }: { plan: SubscriptionPlan; cycle: BillingCycle }) {
  const price = priceFor(plan, cycle);
  const monthly = perMonth(plan, cycle);

  const headline = HEADLINE_LIMITS.map((key) =>
    plan.limits.find((limit) => limit.limit_key === key)
  ).filter(Boolean) as SubscriptionPlan["limits"];

  const highlighted = plan.features.filter((feature) => feature.is_highlighted).slice(0, 3);

  return (
    <article
      className={cn(
        "relative flex flex-col rounded-3xl border p-6 transition",
        plan.is_popular
          ? "border-primary bg-card ring-1 ring-primary"
          : "border-border bg-card hover:border-primary/40"
      )}
    >
      {plan.is_popular && (
        <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
          <Sparkles className="h-3 w-3" />
          {plan.badge_text || "Most popular"}
        </span>
      )}

      <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>

      {plan.tagline && (
        <p className="mt-1.5 min-h-[2.5rem] text-xs font-semibold leading-5 text-muted-foreground">
          {plan.tagline}
        </p>
      )}

      <div className="mt-5">
        <p className="text-3xl font-bold tracking-tight text-foreground">
          {monthly === null ? "—" : money(monthly, price?.currency)}
        </p>
        <p className="mt-1 text-[11px] font-bold text-muted-foreground">
          per month
          {cycle !== "monthly" && price && ` · billed ${money(price.final_price, price.currency)}`}
        </p>
      </div>

      {plan.trial_days > 0 ? (
        <p className="mt-2 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
          Start with {plan.trial_days} days free
        </p>
      ) : (
        <p className="mt-2 text-[11px] font-bold text-muted-foreground">No trial on this plan</p>
      )}

      <Button asChild className="mt-5 h-11 w-full rounded-xl font-semibold">
        <Link to={`/signup?plan=${plan.code}`}>
          Choose {plan.name}
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Link>
      </Button>

      <ul className="mt-6 space-y-2.5 border-t border-border pt-5">
        {headline.map((limit) => (
          <li key={limit.limit_key} className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate font-semibold text-muted-foreground">{limit.name}</span>
            <span className="shrink-0 font-data font-semibold text-foreground">
              {limit.is_unlimited ? (
                <InfinityIcon className="h-3.5 w-3.5" />
              ) : (
                limit.value?.toLocaleString()
              )}
            </span>
          </li>
        ))}

        {headline.length === 0 && (
          <li className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <InfinityIcon className="h-4 w-4" />
            No limits at all
          </li>
        )}
      </ul>

      {highlighted.length > 0 && (
        <ul className="mt-5 space-y-2 border-t border-border pt-5">
          {highlighted.map((feature) => (
            <li key={feature.feature_key} className="flex items-start gap-2 text-xs">
              <Check
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                strokeWidth={3}
              />
              <span className="font-semibold text-foreground">{feature.name}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-auto pt-5 text-[11px] font-bold text-muted-foreground">
        {plan.features.length > 0 ? `${plan.features.length} modules included` : "Every module included"}
      </p>
    </article>
  );
}

/**
 * The full ceiling comparison.
 *
 * Assembled from whatever limit keys the plans actually carry rather than a
 * hard-coded row list, so a capacity a super admin adds in the console shows
 * up here without a code change.
 */
function LimitComparison({ plans }: { plans: SubscriptionPlan[] }) {
  const rows = useMemo(() => {
    const byKey = new Map<string, string>();

    for (const plan of plans) {
      for (const limit of plan.limits) {
        if (!byKey.has(limit.limit_key)) byKey.set(limit.limit_key, limit.name);
      }
    }

    return [...byKey.entries()].map(([key, name]) => ({ key, name }));
  }, [plans]);

  if (rows.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card">
      <div className="border-b border-border px-6 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
          Side by side
        </p>
        <h3 className="mt-1.5 text-lg font-semibold text-foreground">What each plan allows</h3>
        <p className="mt-1 text-xs font-semibold text-muted-foreground">
          These are enforced, not advisory — the system stops you at the number.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-border">
              <th className="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Limit
              </th>
              {plans.map((plan) => (
                <th
                  key={plan.code}
                  className="px-4 py-3 text-center text-[11px] font-semibold text-foreground"
                >
                  {plan.name}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-border/60 last:border-0">
                <td className="px-6 py-3 text-xs font-semibold text-muted-foreground">{row.name}</td>

                {plans.map((plan) => {
                  const limit = plan.limits.find((entry) => entry.limit_key === row.key);

                  return (
                    <td key={plan.code} className="px-4 py-3 text-center">
                      {!limit ? (
                        <Minus className="mx-auto h-3.5 w-3.5 text-muted-foreground/50" />
                      ) : limit.is_unlimited ? (
                        <InfinityIcon className="mx-auto h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <span className="font-data text-xs font-semibold text-foreground">
                          {limit.value?.toLocaleString()}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PricingTable;
