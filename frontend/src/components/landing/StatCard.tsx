import { type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import AnimatedCounter from "./live/AnimatedCounter";

type StatCardProps = {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: string;
  trendDirection?: "up" | "down" | "neutral";
  caption?: string;
  children?: ReactNode;
  className?: string;
  animateValue?: boolean;
  valuePrefix?: string;
  valueSuffix?: string;
  compactValue?: boolean;
  valueDecimals?: number;
} & Omit<HTMLMotionProps<"div">, "children">;


const trendMap = {
  up: "text-foreground bg-muted border-border",
  down: "text-blue-700 bg-blue-50 border-blue-200",
  neutral: "text-muted-foreground bg-muted border-border",
};

export default function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendDirection = "neutral",
  caption,
  children,
  className = "",
  animateValue = typeof value === "number",
  valuePrefix = "",
  valueSuffix = "",
  compactValue = false,
  valueDecimals = 0,
  ...motionProps
}: StatCardProps) {
  return (
    <motion.div
      className={[
        "relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-[0_22px_70px_-42px_rgba(15,23,42,0.45)]",
        className,
      ].join(" ")}
      {...motionProps}
    >
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-muted/70 blur-2xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground break-words leading-tight line-clamp-2">
            {label}
          </p>

          <p className="mt-2 break-words text-2xl font-black tracking-tight text-slate-900 dark:!text-blue-100 leading-tight line-clamp-2">
            {animateValue && typeof value === "number" ? (
              <AnimatedCounter
                value={value}
                prefix={valuePrefix}
                suffix={valueSuffix}
                compact={compactValue}
                decimals={valueDecimals}
              />
            ) : (
              value
            )}
          </p>

          {caption ? (
            <p className="mt-1 text-xs font-medium text-muted-foreground break-words leading-tight line-clamp-2">{caption}</p>
          ) : null}
        </div>

        {Icon ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center">
            <Icon className="h-4.5 w-4.5 text-foreground" />
          </div>
        ) : null}
      </div>

      {trend ? (
        <div className="relative mt-4 flex items-center justify-between gap-3">
          <span
            className={[
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold",
              trendMap[trendDirection],
            ].join(" ")}
          >
            {trendDirection === "up" ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : trendDirection === "down" ? (
              <ArrowDownRight className="h-3.5 w-3.5" />
            ) : null}

            {trend}
          </span>

          {children ? <div className="min-w-0 flex-1">{children}</div> : null}
        </div>
      ) : children ? (
        <div className="relative mt-4">{children}</div>
      ) : null}
    </motion.div>
  );
}