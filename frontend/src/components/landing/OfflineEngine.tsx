import {
  CheckCircle2,
  Cloud,
  Database,
  HardDrive,
  LockKeyhole,
  RefreshCcw,
  Server,
  WifiOff,
} from "lucide-react";
import { useLandingExperience } from "@/contexts/LandingExperienceContext";
import { demoBusiness } from "@/data/landingDemoData";
import WindowFrame from "./WindowFrame";
import StatCard from "./StatCard";
import AnimatedCounter from "./live/AnimatedCounter";

type Tone = "blue" | "emerald" | "orange" | "rose" | "violet" | "cyan";

const baseQueueItems = [
  { label: "Offline sales", value: "Synced", tone: "emerald" },
  { label: "Stock movements", value: "Queued safely", tone: "cyan" },
  { label: "Purchase records", value: "Protected", tone: "blue" },
  { label: "Receipts", value: "Available", tone: "violet" },
] satisfies Array<{
  label: string;
  value: string;
  tone: Tone;
}>;

const moduleQueueText: Record<string, string> = {
  pos: "POS transactions, receipts and payment records remain available when connectivity is unstable.",
  inventory: "Stock updates and product changes are held safely until synchronization is available.",
  warehouse: "Transfers, counts and movement records remain protected through the local queue.",
  procurement: "Purchase orders and receiving records can be protected for later synchronization.",
  finance: "Cash, expenses and margin-impacting records remain connected to the operating model.",
  crm: "Customer records and sales history remain available for continuity at the counter.",
  analytics: "Reports refresh from synchronized operating records when the connection is restored.",
  offline: "The continuity engine protects sales, stock, receipts and sync-ready business records.",
  ebm: "Fiscal submission can retry after connectivity returns without blocking sales operations.",
  security: "Secure online validation protects synchronization and tenant-controlled business data.",
};

const toneMap: Record<Tone, string> = {
  emerald: "bg-blue-500",
  cyan: "bg-blue-500",
  blue: "bg-blue-500",
  violet: "bg-blue-500",
  orange: "bg-blue-500",
  rose: "bg-blue-500",
};

const badgeMap: Record<Tone, string> = {
  emerald: "border-border bg-muted text-foreground",
  cyan: "border-border bg-muted text-foreground",
  blue: "border-border bg-muted text-foreground",
  violet: "border-border bg-muted text-foreground",
  orange: "border-border bg-muted text-foreground",
  rose: "border-border bg-muted text-foreground",
};

const getText = (source: unknown, keys: string[], fallback: string) => {
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record?.[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return fallback;
};

const getArray = (source: unknown, keys: string[]) => {
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record?.[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
};

export default function OfflineEngine() {
  const {
    selectedModule,
    activeBranch,
    demoMode,
    metrics,
    activityFeed,
  } = useLandingExperience();

  const branches = getArray(demoBusiness, ["branches"]);

  const branch =
    branches.find((item) => getText(item, ["id", "key"], "") === activeBranch) ??
    branches[0];

  const branchName = getText(branch, ["name", "label", "title"], "Active branch");

  const pendingSignals = activityFeed.length || metrics.offlineQueue;

  const queueItems = baseQueueItems.map((item) => {
    if (selectedModule === "offline" && item.label === "Stock movements") {
      return { ...item, value: `${metrics.offlineQueue} queued` };
    }

    if (selectedModule === "pos" && item.label === "Offline sales") {
      return { ...item, value: "Counter-ready" };
    }

    if (selectedModule === "ebm" && item.label === "Receipts") {
      return { ...item, value: "Retry-ready" };
    }

    return item;
  });

  const continuityText =
    moduleQueueText[String(selectedModule)] ?? moduleQueueText.offline;

  return (
    <section
      id="offline"
      className="relative overflow-hidden bg-background py-20 sm:py-28"
    >

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600 dark:text-blue-200">
              Offline-first engine
            </p>

            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900 dark:!text-blue-100 sm:text-5xl">
              Never miss a sale. Continue processing transactions smoothly, even when the internet is completely off.
            </h2>

            <p className="mt-5 max-w-2xl text-base font-medium leading-8 text-slate-700 dark:!text-slate-200">
              {continuityText} {branchName} stays protected through local queues
              and secure synchronization.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {[
                "Offline POS transactions",
                "Local receipt availability",
                "Pending synchronization queue",
                "Secure online sync validation",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 rounded-2xl border border-border bg-muted/70 px-4 py-3 text-sm font-bold text-slate-900 dark:!text-blue-100"
                >
                  <CheckCircle2 className="h-4 w-4 text-blue-700 dark:text-blue-200" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <WindowFrame
            title="Synchronization Control"
            eyebrow={`${branchName} · Local queue and cloud sync`}
            icon={RefreshCcw}
            status={demoMode ? "Live queue" : "Healthy"}
            statusTone="blue"
            bodyClassName="bg-muted/70 p-4"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                label="Queue state"
                value={metrics.offlineQueue}
                icon={Database}
                trend={demoMode ? "signals" : "0 pending"}
                trendDirection="up"
                caption="Ready for operations"
              />

              <StatCard
                label="Local cache"
                value="Active"
                icon={HardDrive}
                trend="Protected"
                trendDirection="neutral"
                caption="Products and records"
              />

              <StatCard
                label="Live signals"
                value={pendingSignals}
                icon={Cloud}
                trend="Verified"
                trendDirection="up"
                caption="Secure session required"
              />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      Queue protection
                    </p>
                    <h4 className="mt-1 text-sm font-black text-foreground">
                      Business records protected locally
                    </h4>
                  </div>

                  <WifiOff className="h-5 w-5 text-muted-foreground" />
                </div>

                <div className="space-y-2.5">
                  {queueItems.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-xl border border-border bg-muted/80 px-3 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={[
                            "h-2.5 w-2.5 rounded-full",
                            toneMap[item.tone],
                          ].join(" ")}
                        />
                        <span className="text-sm font-bold text-slate-900 dark:!text-blue-100">
                          {item.label}
                        </span>
                      </div>

                      <span
                        className={[
                          "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                          badgeMap[item.tone],
                        ].join(" ")}
                      >
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-2xl border border-border bg-muted p-4">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 items-center justify-center text-foreground">
                      <LockKeyhole className="h-4 w-4" />
                    </div>

                    <div>
                      <p className="text-sm font-black text-blue-950 dark:text-blue-100">
                        Sync requires secure login
                      </p>
                      <p className="mt-1 text-xs font-medium leading-relaxed text-blue-700 dark:text-blue-200">
                        Pending records wait safely until the user reconnects
                        with a valid online session.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-muted p-4">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 items-center justify-center text-foreground">
                      <Server className="h-4 w-4" />
                    </div>

                    <div>
                      <p className="text-sm font-black text-blue-950 dark:text-blue-100">
                        Cloud database stays authoritative
                      </p>
                      <p className="mt-1 text-xs font-medium leading-relaxed text-blue-700 dark:text-blue-200">
                        Offline records synchronize into the same Supabase
                        business schema used by online operations.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-muted p-4">
                  <p className="text-sm font-black text-foreground">
                    Current queue depth
                  </p>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-blue-700">
                    <AnimatedCounter value={metrics.offlineQueue} /> pending
                    record{metrics.offlineQueue === 1 ? "" : "s"} monitored by
                    the live business engine.
                  </p>
                </div>
              </div>
            </div>
          </WindowFrame>
        </div>
      </div>
    </section>
  );
}