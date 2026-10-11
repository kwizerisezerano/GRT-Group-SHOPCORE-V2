import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/hooks/useTranslation";

function normalize(value?: string | null) {
  return value?.trim().toLowerCase().replace(/\s+/g, "_") || "pending";
}

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export function PlatformStatusBadge({
  status,
  label: labelOverride,
}: {
  status?: string | null;
  /**
   * Wording for cases where the status decides the *colour* but not the
   * words. Platform Users is the one that needed it: an ordinary workspace
   * member is not an "active" or "suspended" operator, and calling them either
   * misstates what the row is.
   */
  label?: string;
}) {
  const { t, has } = useTranslation();
  const value = normalize(status);
  const key = `status.${value}`;
  const label = labelOverride ?? (has(key) ? t(key) : humanize(value));

  const good = ["active", "paid", "approved", "success", "successful", "verified", "completed", "converted", "operational"];
  const bad = ["suspended", "expired", "blocked", "failed", "rejected", "cancelled", "canceled", "terminated", "void"];
  const info = ["trial", "trial_active", "processing", "review", "reviewing", "new"];

  const classes = good.includes(value)
    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-300"
    : bad.includes(value)
      ? "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/35 dark:text-rose-300"
      : info.includes(value)
        ? "border-blue-500/25 bg-blue-500/10 text-primary dark:border-blue-900/60 dark:bg-blue-950/35 dark:text-blue-300"
        : "border-orange-500/25 bg-orange-500/10 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/35 dark:text-orange-300";

  return <Badge className={`rounded-full border hover:opacity-90 ${classes}`}>{label}</Badge>;
}
