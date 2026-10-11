import {
  BadgePercent,
  CalendarClock,
  CreditCard,
  HeartHandshake,
  MessageSquareText,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { useLandingExperience } from "@/contexts/LandingExperienceContext";
import { demoBusiness } from "@/data/landingDemoData";
import WindowFrame from "./WindowFrame";
import StatCard from "./StatCard";
import AnimatedCounter from "./live/AnimatedCounter";

type Tone = "blue" | "emerald" | "orange" | "rose" | "violet" | "cyan";

const toneMap: Record<Tone, string> = {
  emerald: "bg-blue-500",
  blue: "bg-blue-500",
  orange: "bg-blue-500",
  rose: "bg-blue-500",
  violet: "bg-blue-500",
  cyan: "bg-blue-500",
};

const badgeMap: Record<Tone, string> = {
  emerald: "border-border bg-muted text-foreground",
  blue: "border-border bg-muted text-foreground",
  orange: "border-border bg-muted text-foreground",
  rose: "border-border bg-muted text-foreground",
  violet: "border-border bg-muted text-foreground",
  cyan: "border-border bg-muted text-foreground",
};

const moduleCrmText: Record<string, string> = {
  pos: "Customer purchase history is updated directly from checkout activity.",
  inventory: "Product availability supports customer retention and repeat purchasing.",
  warehouse: "Branch replenishment helps keep customer demand fulfilled across the network.",
  crm: "Customer profiles, loyalty, credit and engagement activity operate from one CRM layer.",
  procurement: "Procurement decisions can respond to customer demand and recurring purchase behavior.",
  finance: "Customer credit exposure and repeat revenue remain connected to financial visibility.",
  analytics: "Customer segments contribute to executive reporting and growth intelligence.",
  offline: "Customer-linked sales can remain available during offline checkout and synchronize later.",
  ebm: "Fiscal receipt activity stays connected to customer sales history where applicable.",
  security: "Customer records, credit controls and loyalty operations remain permission-protected.",
};

const getText = (source: unknown, keys: string[], fallback: string) => {
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record?.[key];

    if (typeof value === "string" && value.trim()) return value;
  }

  return fallback;
};

const getArray = (source: unknown, keys: string[]) => {
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record?.[key];

    if (Array.isArray(value)) return value;
  }

  return [];
};

export default function CRMWindow() {
  const {
    selectedModule,
    activeBranch,
    metrics,
    activityFeed,
  } = useLandingExperience();

  const branches = getArray(demoBusiness, ["branches"]);

  const branch =
    branches.find((item) => getText(item, ["id", "key"], "") === activeBranch) ??
    branches[0];

  const branchName = getText(branch, ["name", "label", "title"], "Active branch");

  const customerBase = metrics.customers;
  const loyaltyValue = Math.round(metrics.revenue * 5);
  const creditExposure = Math.round(metrics.cashCollected * 3.1);

  const customerSegments = [
    {
      label: "VIP customers",
      value: Math.max(1, Math.round(customerBase * 0.15)),
      percent: 34,
      tone: "emerald",
    },
    {
      label: "Active accounts",
      value: Math.max(1, Math.round(customerBase * 0.6)),
      percent: 61,
      tone: "blue",
    },
    {
      label: "Credit customers",
      value: Math.max(1, Math.round(customerBase * 0.06)),
      percent: 18,
      tone: "orange",
    },
    {
      label: "Dormant customers",
      value: Math.max(1, Math.round(customerBase * 0.04)),
      percent: 7,
      tone: "rose",
    },
  ] satisfies Array<{
    label: string;
    value: number;
    percent: number;
    tone: Tone;
  }>;

  const engagementRows =
    activityFeed.length > 0
      ? activityFeed.slice(0, 3).map((event, index) => ({
          title: event.title,
          meta: event.detail,
          tone: index === 0 ? "emerald" : index === 1 ? "orange" : "violet",
        }))
      : [
          {
            title: "Loyalty points issued",
            meta: "RWF 12.8M linked sales · today",
            tone: "emerald",
          },
          {
            title: "Customer credit review",
            meta: "18 accounts require approval",
            tone: "orange",
          },
          {
            title: "Birthday campaign scheduled",
            meta: "420 customers · next 7 days",
            tone: "violet",
          },
        ];

  const crmText = moduleCrmText[String(selectedModule)] ?? moduleCrmText.crm;

  return (
    <WindowFrame
      title="Customer Relationship Workspace"
      eyebrow={`${branchName} · CRM and loyalty`}
      icon={Users}
      status={`${customerBase.toLocaleString()} profiles`}
      bodyClassName="bg-muted/70 p-4"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Customer base"
          value={customerBase}
          icon={UserCheck}
          trend="+4.8%"
          trendDirection="up"
          caption="Verified profiles"
        />

        <StatCard
          label="Loyalty value"
          value={loyaltyValue}
          valuePrefix="RWF "
          compactValue
          valueDecimals={1}
          icon={HeartHandshake}
          trend="+19.2%"
          trendDirection="up"
          caption="Repeat revenue"
        />

        <StatCard
          label="Credit exposure"
          value={creditExposure}
          valuePrefix="RWF "
          compactValue
          valueDecimals={1}
          icon={CreditCard}
          trend="Review"
          trendDirection="neutral"
          caption="Managed accounts"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Customer segments
              </p>
              <h4 className="mt-1 text-sm font-black text-foreground">
                Loyalty and credit visibility
              </h4>
            </div>

            <BadgePercent className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="space-y-3">
            {customerSegments.map((segment) => (
              <div
                key={segment.label}
                className="rounded-xl border border-border bg-muted/80 p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-foreground">
                      {segment.label}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                      <AnimatedCounter value={segment.value} /> customers
                    </p>
                  </div>

                  <span
                    className={[
                      "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                      badgeMap[segment.tone],
                    ].join(" ")}
                  >
                    <AnimatedCounter value={segment.percent} suffix="%" />
                  </span>
                </div>

                <div className="h-2.5 overflow-hidden rounded-full bg-border">
                  <div
                    className={[
                      "h-full rounded-full transition-all duration-700",
                      toneMap[segment.tone],
                    ].join(" ")}
                    style={{ width: `${segment.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Engagement board
                </p>
                <h4 className="mt-1 text-sm font-black text-foreground">
                  Customer actions
                </h4>
              </div>

              <MessageSquareText className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="space-y-3">
              {engagementRows.map((item, index) => (
                <div key={`${item.title}-${item.meta}-${index}`} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={[
                        "mt-1 h-2.5 w-2.5 rounded-full",
                        toneMap[item.tone as Tone],
                      ].join(" ")}
                    />
                    <span className="mt-1 h-full w-px bg-border" />
                  </div>

                  <div className="pb-2">
                    <p className="text-sm font-bold text-slate-900 dark:!text-blue-100">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.meta}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-muted p-4">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 items-center justify-center text-foreground">
                <TrendingUp className="h-4 w-4" />
              </div>

              <div>
                <p className="text-sm font-black text-blue-950 dark:text-blue-100">
                  Repeat purchases increasing
                </p>
                <p className="mt-1 text-xs font-medium leading-relaxed text-blue-700 dark:text-blue-300">
                  {crmText}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950 p-4">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 items-center justify-center text-foreground">
                <CalendarClock className="h-4 w-4" />
              </div>

              <div>
                <p className="text-sm font-black text-blue-950 dark:text-blue-100">
                  Campaign calendar prepared
                </p>
                <p className="mt-1 text-xs font-medium leading-relaxed text-blue-700 dark:text-blue-200">
                  Customer segments support retention campaigns, credit
                  follow-ups and loyalty rewards.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </WindowFrame>
  );
}