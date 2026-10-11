import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CalendarClock,
  Gauge,
  Infinity as InfinityIcon,
  Sparkles,
} from "lucide-react";

import { SectionSkeleton } from "@/components/skeletons";
import { useAuth } from "@/contexts/AuthContext";
import { subscriptionApi, type CapacityReport } from "@/lib/subscriptionApi";
import { cn } from "@/lib/utils";

/**
 * What the subscription has left — the time on it, and the room in it.
 *
 * Two questions that both mean "how much of what I paid for have I used", and
 * a billing screen that answers only the second is the one people keep asking
 * support about. So: a bar for the term (9 of 30 days), then a bar for every
 * ceiling that is actually capped.
 *
 * The term bar is computed server-side (`/subscription/current` → `period`)
 * because a trial and a paid term measure from different dates, and getting
 * that wrong shows somebody the wrong number of days left on the one screen
 * where the number matters.
 */

export type SubscriptionPeriod = {
  state: string;
  is_open: boolean;
  is_trial: boolean;
  starts_at: string | null;
  ends_at: string | null;
  total_days: number | null;
  used_days: number | null;
  remaining_days: number | null;
  percent_used: number | null;
};

const longDate = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

export function useSubscriptionSummary() {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["subscription", "current", tenantId],
    queryFn: () => subscriptionApi.current(),
    enabled: Boolean(tenantId),
  });
}

/** The term: how many days of this period are gone, and what happens next. */
export function PeriodMeter({
  period,
  planName,
  className,
}: {
  period: SubscriptionPeriod | null;
  planName?: string | null;
  className?: string;
}) {
  if (!period || period.total_days === null || period.used_days === null) return null;

  const remaining = period.remaining_days ?? 0;
  const overdue = remaining < 0;
  const percent = Math.min(100, Math.max(0, period.percent_used ?? 0));

  /* Under a week left is worth flagging before it is a surprise. */
  const closing = !overdue && remaining <= 7;

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {period.is_trial ? <Sparkles className="h-3 w-3" /> : <CalendarClock className="h-3 w-3" />}
            {period.is_trial ? "Free trial" : "Current period"}
          </p>

          <p className="mt-1.5 text-lg font-bold tracking-tight text-foreground">
            {overdue
              ? `Ended ${Math.abs(remaining)} day${Math.abs(remaining) === 1 ? "" : "s"} ago`
              : `${remaining} day${remaining === 1 ? "" : "s"} left`}
          </p>

          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {period.used_days} of {period.total_days} days used
            {planName ? ` · ${planName}` : ""}
          </p>
        </div>

        {(overdue || closing) && (
          <Link
            to="/billing"
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition",
              overdue
                ? "bg-rose-500/10 text-rose-600 hover:bg-rose-500/15 dark:text-rose-400"
                : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/15 dark:text-amber-400",
            )}
          >
            {period.is_trial ? "Choose a plan" : "Renew now"}
          </Link>
        )}
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            overdue ? "bg-rose-500" : closing ? "bg-amber-500" : "bg-emerald-500",
          )}
          style={{ width: `${overdue ? 100 : percent}%` }}
        />
      </div>

      {period.ends_at && (
        <p className="mt-2.5 text-xs text-muted-foreground">
          {overdue
            ? `Ended on ${longDate(period.ends_at)}`
            : period.is_trial
              ? `Trial ends on ${longDate(period.ends_at)}`
              : `Renews on ${longDate(period.ends_at)}`}
        </p>
      )}
    </div>
  );
}

/** One capped resource: used, limit, and how close the two are. */
export function CapacityRow({ capacity }: { capacity: CapacityReport }) {
  const limit = capacity.limit ?? 0;
  const percent = Math.min(100, Math.round((capacity.usage / Math.max(1, limit)) * 100));
  const tight = percent >= 80;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          {capacity.name}
          {capacity.source === "override" && (
            <span className="rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
              custom
            </span>
          )}
        </span>

        <span
          className={cn(
            "text-[13px] font-semibold",
            capacity.at_limit
              ? "text-rose-600 dark:text-rose-400"
              : tight
                ? "text-amber-600 dark:text-amber-400"
                : "text-muted-foreground",
          )}
        >
          {capacity.usage} / {limit}
        </span>
      </div>

      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            capacity.at_limit ? "bg-rose-500" : tight ? "bg-amber-500" : "bg-emerald-500",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>

      {capacity.at_limit && (
        <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
          <AlertTriangle className="h-3 w-3" />
          Full — nothing new can be created until you upgrade
        </p>
      )}
    </div>
  );
}

/** Every capped resource, tightest first. Unlimited ones are not worth a bar. */
export function CapacityList({
  capacities,
  limit = 8,
  className,
}: {
  capacities: CapacityReport[];
  limit?: number;
  className?: string;
}) {
  const capped = capacities
    .filter((capacity) => !capacity.is_unlimited && capacity.limit !== null)
    .sort((a, b) => b.usage / (b.limit || 1) - a.usage / (a.limit || 1))
    .slice(0, limit);

  if (capped.length === 0) {
    return (
      <div className={cn("py-8 text-center", className)}>
        <InfinityIcon className="mx-auto h-6 w-6 text-emerald-600 dark:text-emerald-400" />
        <p className="mt-2.5 text-sm font-semibold text-foreground">No limits on your plan</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Add as many users, branches and products as you need.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {capped.map((capacity) => (
        <CapacityRow key={capacity.limit_key} capacity={capacity} />
      ))}
    </div>
  );
}

/**
 * The compact version: the term and the two tightest ceilings, for a sidebar
 * or a dashboard corner where the full table would not fit.
 */
export function SubscriptionUsageCard({ className }: { className?: string }) {
  const { tenantId } = useAuth();
  const summary = useSubscriptionSummary();

  const usage = useQuery({
    queryKey: ["subscription", "usage", tenantId],
    queryFn: () => subscriptionApi.usage(),
    enabled: Boolean(tenantId),
    staleTime: 30 * 1000,
  });

  if (summary.isLoading || usage.isLoading) {
    return <SectionSkeleton lines={3} className={className} />;
  }

  const period = summary.data?.period ?? null;
  const plan = summary.data?.plan ?? null;

  return (
    <div className={cn("space-y-4", className)}>
      <PeriodMeter period={period} planName={plan?.name ?? null} />

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Gauge className="h-3 w-3" />
          What you are using
        </p>

        <CapacityList capacities={usage.data ?? []} limit={4} className="mt-4" />
      </div>
    </div>
  );
}
