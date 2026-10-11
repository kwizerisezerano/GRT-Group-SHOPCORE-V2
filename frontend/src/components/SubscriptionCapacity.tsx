import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowUpRight, Infinity as InfinityIcon, Loader2 } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { subscriptionApi, type CapacityReport } from "@/lib/subscriptionApi";
import { cn } from "@/lib/utils";

/**
 * How much of the subscription this workspace has left.
 *
 * Read live rather than from the session snapshot: the whole point is to be
 * right immediately after the user creates something, and a value cached at
 * sign-in is wrong the moment they do. The server refuses anything past the
 * ceiling regardless (backend lib/planLimits.ts) — what this adds is that the
 * person finds out before they have filled in a form, not after.
 */
export function useCapacity(limitKey: string) {
  const { tenantId } = useAuth();

  const query = useQuery({
    queryKey: ["subscription", "usage", tenantId],
    queryFn: () => subscriptionApi.usage(),
    enabled: Boolean(tenantId),
    staleTime: 15 * 1000,
  });

  const capacity =
    query.data?.find((entry) => entry.limit_key === limitKey) ?? null;

  return {
    ...query,
    capacity,
    /** Unknown ceilings are permissive — see the backend's own layer-3 rule. */
    atLimit: capacity?.at_limit ?? false,
    remaining: capacity?.remaining ?? null,
    limit: capacity?.limit ?? null,
    usage: capacity?.usage ?? 0,
    unlimited: capacity?.is_unlimited ?? true,
  };
}

/** The query key the usage table is cached under, for invalidation after a create. */
export const capacityQueryKey = (tenantId: string | null) => [
  "subscription",
  "usage",
  tenantId,
];

/**
 * A one-line "3 of 5 team members used" strip, with an upgrade link once the
 * ceiling is in sight.
 */
export function CapacityMeter({
  limitKey,
  label,
  className,
  upgradeTo = "/billing",
}: {
  limitKey: string;
  label?: string;
  className?: string;
  upgradeTo?: string;
}) {
  const { capacity, isLoading } = useCapacity(limitKey);

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2 text-xs font-semibold text-muted-foreground", className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Checking your plan…
      </div>
    );
  }

  if (!capacity) return null;

  const name = label ?? capacity.name;

  if (capacity.is_unlimited) {
    return (
      <div className={cn("flex items-center gap-2 text-xs font-semibold text-muted-foreground", className)}>
        <InfinityIcon className="h-3.5 w-3.5" />
        <span>
          {capacity.usage} {name.toLowerCase()} · unlimited on your plan
        </span>
      </div>
    );
  }

  const percent = Math.min(100, Math.round((capacity.usage / Math.max(1, capacity.limit ?? 1)) * 100));
  const tight = percent >= 80;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-bold text-foreground">
          <span className="font-data">
            {capacity.usage} of {capacity.limit}
          </span>{" "}
          <span className="font-semibold text-muted-foreground">{name.toLowerCase()} used</span>
        </p>

        {capacity.at_limit ? (
          <Link
            to={upgradeTo}
            className="inline-flex items-center gap-1 text-xs font-black text-primary hover:underline"
          >
            Upgrade plan
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        ) : (
          <p
            className={cn(
              "text-xs font-bold",
              tight ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
            )}
          >
            {capacity.remaining} left
          </p>
        )}
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            capacity.at_limit ? "bg-rose-500" : tight ? "bg-amber-500" : "bg-emerald-500"
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/**
 * The block that appears in a create form once the plan is full.
 *
 * Deliberately explicit about the numbers and about what to do next. "Limit
 * reached" on its own leaves somebody clicking the button again; naming the
 * ceiling and linking to the upgrade is the difference between a dead end and
 * a decision.
 */
export function CapacityBlockedNotice({
  capacity,
  noun,
  upgradeTo = "/billing",
  className,
}: {
  capacity: CapacityReport | null;
  /** What is being created, in plural — "team members", "branches". */
  noun: string;
  upgradeTo?: string;
  className?: string;
}) {
  if (!capacity || !capacity.at_limit) return null;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4",
        className
      )}
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />

      <div className="min-w-0">
        <p className="text-sm font-black text-rose-800 dark:text-rose-200">
          Your plan is full at {capacity.limit} {noun}
        </p>
        <p className="mt-1 text-xs font-semibold leading-5 text-rose-700 dark:text-rose-300">
          All {capacity.limit} are in use. Free one up by removing someone who no longer needs
          access, or move to a plan with more room.
        </p>

        <Link
          to={upgradeTo}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-black text-white transition hover:bg-rose-700"
        >
          See plans
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
