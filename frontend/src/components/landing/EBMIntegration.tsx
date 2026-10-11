import {
  Building2,
  CheckCircle2,
  FileCheck2,
  KeyRound,
  ReceiptText,
  RefreshCcw,
  ServerCog,
  ShieldCheck,
} from "lucide-react";
import { useLandingExperience } from "@/contexts/LandingExperienceContext";
import { demoBusiness } from "@/data/landingDemoData";
import WindowFrame from "./WindowFrame";
import StatCard from "./StatCard";
import AnimatedCounter from "./live/AnimatedCounter";

type Tone = "blue" | "emerald" | "orange" | "rose" | "violet" | "cyan";

const baseFiscalRows = [
  { label: "Tenant credentials", value: "Per business", tone: "violet" },
  { label: "Sale without setup", value: "Allowed", tone: "emerald" },
  { label: "Receipt submission", value: "Optional", tone: "blue" },
  { label: "Retry queue", value: "Supported", tone: "cyan" },
] satisfies Array<{
  label: string;
  value: string;
  tone: Tone;
}>;

const moduleFiscalText: Record<string, string> = {
  pos: "POS sales can continue safely while fiscal submission remains tenant-controlled and retry-ready.",
  finance: "Finance can track receipt status, fiscal retry states and configured tenant submission behavior.",
  ebm: "EBM submission is configured per tenant, remains optional by setup and does not block daily selling.",
  offline: "Fiscal receipt retries can wait safely in the synchronization layer until connectivity returns.",
  security: "Tenant credentials stay isolated by business and protected through controlled access.",
};

const toneMap: Record<Tone, string> = {
  emerald: "bg-blue-500",
  blue: "bg-blue-500",
  cyan: "bg-blue-500",
  violet: "bg-blue-500",
  orange: "bg-blue-500",
  rose: "bg-blue-500",
};

const badgeMap: Record<Tone, string> = {
  emerald: "border-border bg-muted text-foreground",
  blue: "border-border bg-muted text-foreground",
  cyan: "border-border bg-muted text-foreground",
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

export default function EBMIntegration() {
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

  const fiscalSignals =
    activityFeed.filter(
      (event) =>
        event.module === "ebm" ||
        event.title.toLowerCase().includes("receipt") ||
        event.detail.toLowerCase().includes("receipt") ||
        event.detail.toLowerCase().includes("fiscal"),
    ).length || metrics.receipts;

  const fiscalRows = baseFiscalRows.map((item) => {
    if (selectedModule === "ebm" && item.label === "Receipt submission") {
      return { ...item, value: "Active view" };
    }

    if (selectedModule === "offline" && item.label === "Retry queue") {
      return { ...item, value: `${metrics.offlineQueue} queued` };
    }

    if (selectedModule === "pos" && item.label === "Sale without setup") {
      return { ...item, value: "Non-blocking" };
    }

    return item;
  });

  const fiscalText =
    moduleFiscalText[String(selectedModule)] ??
    "ShopCore allows sales to continue while fiscal configuration remains controlled by each tenant.";

  return (
    <section id="ebm" className="relative overflow-hidden bg-background py-20 sm:py-28">

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600 dark:text-blue-200">
              Fiscal integration
            </p>

            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900 dark:!text-blue-100 sm:text-5xl">
              EBM-ready by tenant, optional by configuration.
            </h2>

            <p className="mt-5 max-w-2xl text-base font-medium leading-8 text-slate-700 dark:!text-slate-200">
              {fiscalText} {branchName} stays aligned with receipt readiness,
              retry workflow and secure tenant-owned credentials.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {[
                "Tenant-owned credentials",
                "Sale completion without blocking",
                "Fiscal receipt fields supported",
                "Submission retry workflow",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-950 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100"
                >
                  <CheckCircle2 className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <WindowFrame
            title="Fiscal Operations Layer"
            eyebrow={`${branchName} · EBM and receipt workflow`}
            icon={ReceiptText}
            status={demoMode ? "Live fiscal view" : "Tenant controlled"}
            statusTone="blue"
            bodyClassName="bg-muted/70 p-4"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                label="Configuration"
                value="Tenant"
                icon={Building2}
                trend="Private"
                trendDirection="neutral"
                caption="One setup per business"
              />

              <StatCard
                label="Receipts"
                value={metrics.receipts}
                icon={ShieldCheck}
                trend="Non-blocking"
                trendDirection="up"
                caption="Fiscal workflow supported"
              />

              <StatCard
                label="Retry queue"
                value={metrics.offlineQueue}
                icon={RefreshCcw}
                trend="Queued"
                trendDirection="neutral"
                caption="Retry workflow"
              />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      Fiscal workflow
                    </p>
                    <h4 className="mt-1 text-sm font-black text-foreground">
                      Receipt submission states
                    </h4>
                  </div>

                  <FileCheck2 className="h-5 w-5 text-muted-foreground" />
                </div>

                <div className="space-y-2.5">
                  {fiscalRows.map((item) => (
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
                <div className="rounded-2xl border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950 p-4">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 items-center justify-center text-foreground">
                      <KeyRound className="h-4 w-4" />
                    </div>

                    <div>
                      <p className="text-sm font-black text-blue-950 dark:text-blue-100">
                        Credentials belong to each tenant
                      </p>
                      <p className="mt-1 text-xs font-medium leading-relaxed text-blue-700 dark:text-blue-200">
                        Every business stores its own fiscal configuration
                        instead of sharing one global credential.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-muted p-4">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 items-center justify-center text-foreground">
                      <ServerCog className="h-4 w-4" />
                    </div>

                    <div>
                      <p className="text-sm font-black text-blue-950 dark:text-blue-100">
                        Edge function integration point
                      </p>
                      <p className="mt-1 text-xs font-medium leading-relaxed text-blue-700 dark:text-blue-300">
                        Receipt submission can be routed through the fiscal Edge
                        Function after the tenant setup is available.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950 p-4">
                  <p className="text-sm font-black text-blue-950 dark:text-blue-100">
                    Fiscal activity monitored
                  </p>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-blue-700 dark:text-blue-200">
                    <AnimatedCounter value={fiscalSignals} /> fiscal signal
                    {fiscalSignals === 1 ? "" : "s"} are currently visible in
                    the live operating engine.
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