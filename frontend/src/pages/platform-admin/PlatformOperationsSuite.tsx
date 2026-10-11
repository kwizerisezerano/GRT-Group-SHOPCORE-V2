import { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function money(value: number, currency = "RWF") {
  return `${currency} ${Math.round(value || 0).toLocaleString()}`;
}

export function dateTime(value?: string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleString();
}

export function statusClass(status?: string) {
  const value = String(status || "").toLowerCase();

  if (["active", "approved", "completed", "paid", "operational"].includes(value)) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
  }

  if (["pending", "in_review", "trial", "maintenance"].includes(value)) {
    return "border-orange-500/25 bg-orange-500/10 text-orange-700";
  }

  if (["failed", "rejected", "revoked", "blocked", "incident"].includes(value)) {
    return "border-rose-500/25 bg-rose-500/10 text-rose-700";
  }

  return "border-blue-500/25 bg-blue-500/10 text-primary";
}

export function StatusPill({ status }: { status?: string }) {
  return (
    <span
      className={[
        "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
        statusClass(status),
      ].join(" ")}
    >
      {String(status || "active").replace(/_/g, " ")}
    </span>
  );
}

export function PageShell({
  eyebrow,
  title,
  description,
  icon,
  children,
  onRefresh,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
  onRefresh?: () => void;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-blue-500/25 bg-blue-500/10 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/25 bg-white text-primary">
              {icon}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                {eyebrow}
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-950">
                {title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-primary dark:text-blue-300">
                {description}
              </p>
            </div>
          </div>

          {onRefresh && (
            <Button
              variant="outline"
              className="rounded-xl border-blue-500/25 bg-white font-semibold text-primary hover:bg-blue-100"
              onClick={onRefresh}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          )}
        </div>
      </section>

      {children}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  tone = "blue",
}: {
  label: string;
  value: ReactNode;
  tone?: "blue" | "emerald" | "orange" | "rose" | "violet" | "cyan";
}) {
  const tones: Record<string, string> = {
    blue: "border-blue-500/25 bg-blue-500/10 text-primary",
    emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700",
    orange: "border-orange-500/25 bg-orange-500/10 text-orange-700",
    rose: "border-rose-500/25 bg-rose-500/10 text-rose-700",
    violet: "border-violet-500/25 bg-violet-500/10 text-violet-700",
    cyan: "border-cyan-500/25 bg-cyan-500/10 text-cyan-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <div className={`mt-4 inline-flex rounded-xl border px-3 py-2 text-2xl font-semibold ${tones[tone]}`}>
        {value}
      </div>
    </div>
  );
}

export function DataPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">
      {text}
    </div>
  );
}

export function usePlatformQuery<T>({
  key,
  query,
}: {
  key: string | string[];
  query: () => Promise<T>;
}) {
  return useQuery({
    queryKey: Array.isArray(key) ? key : [key],
    queryFn: query,
    refetchInterval: 30000,
  });
}

export function useOperationsSummary() {
  return usePlatformQuery({
    key: "platform-operations-summary",
    query: async () => {
      const { data, error } = await (supabase as any)
        .from("platform_operations_summary")
        .select("*")
        .maybeSingle();

      if (error) throw error;
      return data ?? {};
    },
  });
}

export function buildCounts(items: any[] = [], field = "status") {
  return items.reduce((acc: Record<string, number>, item: any) => {
    const key = item?.[field] || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}
