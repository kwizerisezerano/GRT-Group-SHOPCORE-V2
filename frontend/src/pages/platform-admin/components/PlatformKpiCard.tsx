import type { ReactNode } from "react";

import { toneCardClass, toneIconClass, type Tone } from "@/components/patterns";
import { cn } from "@/lib/utils";

/**
 * A KPI card for the platform console, drawn from the workspace's own tokens.
 *
 * ## Why this exists
 *
 * Tenants, Subscriptions and Trial Management each carried a private `KpiCard`
 * — three copies of the same component, all frozen at an older version of the
 * workspace card (a circular tinted badge, a truncating label). So the console
 * and the workspace drifted apart, and a change to the house card style
 * reached one of them and not the other.
 *
 * The look is not redefined here. `toneIconClass` and `toneCardClass` are
 * imported from `components/patterns`, so this is the same filled tile and the
 * same left bar as every workspace KPI, and a future change to either lands in
 * both places at once.
 *
 * ## Why it is not just `StatCard`
 *
 * `StatCard` takes `icon` as a component (`icon={Users}`); every console call
 * site passes an element (`icon={<Users className="h-5 w-5" />}`). Accepting a
 * node here keeps twenty call sites unchanged, which is the difference between
 * a styling fix and a refactor of three large pages.
 */

/** The console's own tone names, mapped onto the design system's. */
const TONE_ALIAS = {
  blue: "indigo",
  indigo: "indigo",
  emerald: "emerald",
  orange: "amber",
  amber: "amber",
  violet: "violet",
  rose: "rose",
  cyan: "cyan",
  sky: "sky",
  teal: "teal",
  neutral: "neutral",
} as const satisfies Record<string, Tone>;

export type PlatformTone = keyof typeof TONE_ALIAS;

export function PlatformKpiCard({
  icon,
  label,
  value,
  helper,
  tone = "blue",
  className,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  helper?: string;
  tone?: PlatformTone;
  className?: string;
}) {
  const resolved: Tone = TONE_ALIAS[tone] ?? "neutral";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card py-4 pl-5 pr-4 text-left shadow-sm",
        className,
      )}
    >
      {/* The tone bar, clipped to the card's corners by `overflow-hidden`. */}
      <span
        aria-hidden="true"
        className={cn("absolute inset-y-0 left-0 w-1.5", toneCardClass[resolved])}
      />

      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm",
            toneIconClass[resolved],
          )}
        >
          {icon}
        </span>

        <span className="min-w-0">
          {/* Wraps rather than truncates — see StatCard for the reasoning. */}
          <span className="block text-xs font-medium leading-tight text-muted-foreground">
            {label}
          </span>
          <span className="mt-0.5 block truncate font-data text-xl font-bold text-foreground">
            {value}
          </span>
          {helper ? (
            <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">
              {helper}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}
