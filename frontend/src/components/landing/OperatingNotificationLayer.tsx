import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock3,
  CreditCard,
  Database,
  PackageSearch,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  ShoppingCart,
  Truck,
} from "lucide-react";
import WindowFrame from "./WindowFrame";
import StatCard from "./StatCard";
import { useLandingExperience } from "@/contexts/LandingExperienceContext";

type Tone = "blue" | "emerald" | "orange" | "rose" | "violet" | "cyan";

const iconMap = {
  pos: ShoppingCart,
  inventory: PackageSearch,
  warehouse: Truck,
  ebm: ReceiptText,
  offline: RefreshCcw,
  security: ShieldCheck,
  crm: CreditCard,
  procurement: Truck,
  finance: CreditCard,
  analytics: Database,
};

const toneIcon: Record<Tone, string> = {
  emerald: "border-border bg-muted text-foreground",
  blue: "border-border bg-muted text-foreground",
  cyan: "border-border bg-muted text-foreground",
  orange: "border-border bg-muted text-foreground",
  violet: "border-border bg-muted text-foreground",
  rose: "border-border bg-muted text-foreground",
};

const toneDot: Record<Tone, string> = {
  emerald: "bg-blue-500",
  blue: "bg-blue-500",
  cyan: "bg-blue-500",
  orange: "bg-blue-500",
  violet: "bg-blue-500",
  rose: "bg-blue-500",
};

const toneBadge: Record<Tone, string> = {
  emerald: "border-border bg-muted text-foreground",
  blue: "border-border bg-muted text-foreground",
  cyan: "border-border bg-muted text-foreground",
  orange: "border-border bg-muted text-foreground",
  violet: "border-border bg-muted text-foreground",
  rose: "border-border bg-muted text-foreground",
};

export default function OperatingNotificationLayer() {
  const {
    selectedModule,
    activeBranch,
    demoMode,
    metrics,
    notifications,
    activityFeed,
    branchHealth,
  } = useLandingExperience();

  const branch =
    branchHealth.find((item) => item.id === activeBranch) ?? branchHealth[0];

  const branchName = branch?.name ?? "Kigali Main";

  const notificationRows =
    notifications.length > 0
      ? notifications.slice(0, 5).map((item, index) => ({
          id: item.id,
          title: item.title,
          detail: item.message,
          module: item.module,
          tone: item.tone,
          priority: item.priority,
          time: index === 0 ? "now" : `${index + 1} min`,
        }))
      : activityFeed.slice(0, 5).map((item, index) => ({
          id: item.id,
          title: item.title,
          detail: item.detail,
          module: item.module,
          tone: item.tone,
          priority: item.module === selectedModule ? "high" : "medium",
          time: index === 0 ? "now" : `${index + 1} min`,
        }));

  const priorityRows = [
    {
      label: "Operational alerts",
      value: `${metrics.stockAlerts} active`,
      tone: "orange",
    },
    {
      label: "Completed events",
      value: `${activityFeed.length || 8} live`,
      tone: "emerald",
    },
    {
      label: "Sync notifications",
      value: `${metrics.offlineQueue} queued`,
      tone: "cyan",
    },
    {
      label: "Security notices",
      value: "Protected",
      tone: "violet",
    },
  ] satisfies Array<{
    label: string;
    value: string;
    tone: Tone;
  }>;

  return (
    <section className="relative overflow-hidden bg-background py-20 sm:py-28">

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600 dark:text-blue-200">
            Operating notification layer
          </p>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900 dark:!text-blue-100 sm:text-5xl">
            Every important business event reaches the right operator.
          </h2>

          <p className="mt-5 text-base font-medium leading-8 text-slate-700 dark:!text-slate-200">
            ShopCore turns sales, fiscal events, low stock, transfers, offline
            synchronization and security changes into clear operational signals.
          </p>
        </div>

        <WindowFrame
          title="Notification Control Layer"
          eyebrow={`${branchName} · ${selectedModule.toUpperCase()} signals`}
          icon={BellRing}
          status={demoMode ? "Live stream" : "Live events"}
          statusTone="blue"
          bodyClassName="bg-muted/70 p-4 sm:p-5"
        >
          <div className="grid gap-4 lg:grid-cols-4">
            <StatCard
              label="Events today"
              value={metrics.orders}
              icon={BellRing}
              trend="+21%"
              trendDirection="up"
              caption="Operational signals"
            />

            <StatCard
              label="Priority alerts"
              value={metrics.stockAlerts}
              icon={AlertTriangle}
              trend="Review"
              trendDirection="neutral"
              caption="Needs attention"
            />

            <StatCard
              label="Sync queue"
              value={metrics.offlineQueue}
              icon={Database}
              trend="Healthy"
              trendDirection="up"
              caption="Pending records"
            />

            <StatCard
              label="Selected module"
              value={selectedModule.toUpperCase()}
              icon={ShieldCheck}
              trend={branchName}
              trendDirection="up"
              caption="Shared experience state"
            />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
            <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                    Live notification stream
                  </p>
                  <h3 className="mt-1 text-lg font-black text-slate-900 dark:!text-blue-100">
                    Business events by module priority
                  </h3>
                </div>

                <Clock3 className="h-5 w-5 text-muted-foreground" />
              </div>

              <div className="space-y-3">
                {notificationRows.map((item) => {
                  const Icon = iconMap[item.module] ?? BellRing;
                  const isActive =
                    item.module === selectedModule || item.priority === "high";

                  return (
                    <div
                      key={item.id}
                      className={[
                        "rounded-2xl border p-4 transition-all duration-500",
                        isActive
                          ? "border-blue-300/60 bg-blue-50/60 dark:border-blue-900/60 dark:bg-blue-950/60 shadow-sm"
                          : "border-border/50 bg-muted/50",
                      ].join(" ")}
                    >
                      <div className="flex gap-3">
                        <div
                          className={[
                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
                            toneIcon[item.tone],
                          ].join(" ")}
                        >
                          <Icon className="h-5 w-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm font-black text-foreground">
                              {item.title}
                            </p>

                            <span
                              className={[
                                "w-fit rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide",
                                toneBadge[item.tone],
                              ].join(" ")}
                            >
                              {isActive ? "Active" : item.time}
                            </span>
                          </div>

                          <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">
                            {item.detail}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                  Notification categories
                </p>

                <div className="mt-4 space-y-3">
                  {priorityRows.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-2xl border border-border bg-muted/80 px-3 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={[
                            "h-2.5 w-2.5 rounded-full",
                            toneDot[item.tone],
                          ].join(" ")}
                        />
                        <span className="text-sm font-black text-foreground">
                          {item.label}
                        </span>
                      </div>

                      <span
                        className={[
                          "rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide",
                          toneBadge[item.tone],
                        ].join(" ")}
                      >
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-muted p-5">
                <div className="flex gap-3">
                  <div className="flex h-11 w-11 items-center justify-center text-foreground">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="text-sm font-black text-blue-950">
                      Operators see what matters
                    </p>
                    <p className="mt-1 text-xs font-medium leading-6 text-blue-700">
                      Notifications now follow the live business engine, selected
                      module and active branch.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-muted p-5">
                <div className="flex gap-3">
                  <div className="flex h-11 w-11 items-center justify-center text-foreground">
                    <CreditCard className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="text-sm font-black text-blue-950">
                      {branchName} is currently in focus
                    </p>
                    <p className="mt-1 text-xs font-medium leading-6 text-blue-700">
                      Branch, module and notification context are connected
                      through the ShopCore live operating engine.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </WindowFrame>
      </div>
    </section>
  );
}