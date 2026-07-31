import {
  Activity,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  Server,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { useLandingExperience } from "@/contexts/LandingExperienceContext";
import { demoBusiness } from "@/data/landingDemoData";
import WindowFrame from "./WindowFrame";
import StatCard from "./StatCard";

type Tone = "blue" | "emerald" | "orange" | "rose" | "violet" | "cyan";

const baseSecurityRows = [
  { label: "Tenant isolation", value: "Enabled", tone: "blue" },
  { label: "Role permissions", value: "Controlled", tone: "blue" },
  { label: "Protected routes", value: "Active", tone: "blue" },
  { label: "Audit activity", value: "Tracked", tone: "blue" },
] satisfies Array<{
  label: string;
  value: string;
  tone: Tone;
}>;

const moduleSecurityText: Record<string, string> = {
  pos: "Cashier activity, payment access and receipt actions remain controlled by role and branch.",
  inventory: "Product changes, stock counts and adjustments stay protected through permission boundaries.",
  warehouse: "Transfers, receiving and warehouse records remain controlled by operational responsibility.",
  procurement: "Supplier records, purchase orders and receiving actions remain governed by user permissions.",
  finance: "Cash, expenses, margins and financial reporting stay protected for authorized teams.",
  crm: "Customer records, credit activity and loyalty controls remain available only to permitted roles.",
  analytics: "Executive reporting stays governed by role, branch and business-level visibility.",
  offline: "Synchronization requires secure validation before local records enter the cloud data model.",
  ebm: "Fiscal credentials and receipt submission remain tenant-controlled and permission-protected.",
  security: "Tenant isolation, RBAC, protected routes and audit visibility form the governance layer.",
};

const toneMap: Record<Tone, string> = {
  emerald: "bg-blue-500",
  blue: "bg-blue-500",
  violet: "bg-blue-500",
  cyan: "bg-blue-500",
  orange: "bg-blue-500",
  rose: "bg-blue-500",
};

const badgeMap: Record<Tone, string> = {
  emerald: "border-border bg-muted text-foreground",
  blue: "border-border bg-muted text-foreground",
  violet: "border-border bg-muted text-foreground",
  cyan: "border-border bg-muted text-foreground",
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

export default function SecurityCenter() {
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

  const governanceSignals =
    activityFeed.filter(
      (event) =>
        event.module === "security" ||
        event.title.toLowerCase().includes("access") ||
        event.title.toLowerCase().includes("control") ||
        event.detail.toLowerCase().includes("role") ||
        event.detail.toLowerCase().includes("protected"),
    ).length || activityFeed.length;

  const securityRows = baseSecurityRows.map((item) => {
    if (selectedModule === "security" && item.label === "Protected routes") {
      return { ...item, value: "Live" };
    }

    if (selectedModule === "finance" && item.label === "Role permissions") {
      return { ...item, value: "Strict" };
    }

    if (selectedModule === "ebm" && item.label === "Tenant isolation") {
      return { ...item, value: "Fiscal-safe" };
    }

    return item;
  });

  const securityText =
    moduleSecurityText[String(selectedModule)] ?? moduleSecurityText.security;

  return (
    <section
      id="security"
      className="relative overflow-hidden bg-background py-20 sm:py-28"
    >

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600 dark:text-blue-200">
              Enterprise security
            </p>

            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900 dark:!text-blue-100 sm:text-5xl">
              Built for controlled business operations.
            </h2>

            <p className="mt-5 max-w-2xl text-base font-medium leading-8 text-slate-700 dark:!text-slate-200">
              {securityText} {branchName} operates inside the same governance
              model for tenant isolation, role access and controlled activity.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {[
                "Role-based permissions",
                "Tenant data separation",
                "Branch access control",
                "Operational audit activity",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm font-bold text-slate-900 dark:!text-blue-100"
                >
                  <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-200" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <WindowFrame
            title="Security Control Center"
            eyebrow={`${branchName} · Access and governance`}
            icon={ShieldCheck}
            status={demoMode ? "Live controls" : "Protected"}
            statusTone="blue"
            bodyClassName="bg-muted/70 p-4"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                label="Access model"
                value="RBAC"
                icon={UserCog}
                trend="Controlled"
                trendDirection="neutral"
                caption="Per role and user"
              />

              <StatCard
                label="Protected actions"
                value={metrics.orders}
                icon={LockKeyhole}
                trend="Active"
                trendDirection="up"
                caption="Authenticated operations"
              />

              <StatCard
                label="Governance"
                value={governanceSignals}
                icon={Activity}
                trend={demoMode ? "signals" : "Live"}
                trendDirection="neutral"
                caption="Operational visibility"
              />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      Governance layer
                    </p>
                    <h4 className="mt-1 text-sm font-black text-slate-900 dark:!text-blue-100">
                      Security controls
                    </h4>
                  </div>

                  <Fingerprint className="h-5 w-5 text-muted-foreground" />
                </div>

                <div className="space-y-2.5">
                  {securityRows.map((item) => (
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
                      <KeyRound className="h-4 w-4" />
                    </div>

                    <div>
                      <p className="text-sm font-black text-slate-900 dark:!text-blue-100">
                        Permissions follow the business structure
                      </p>
                      <p className="mt-1 text-xs font-medium leading-relaxed text-blue-700 dark:text-blue-200">
                        Users can be controlled by role, branch, module and
                        operational responsibility.
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
                      <p className="text-sm font-black text-slate-900 dark:!text-blue-100">
                        Multi-tenant foundation
                      </p>
                      <p className="mt-1 text-xs font-medium leading-relaxed text-blue-700 dark:text-blue-200">
                        Each business workspace operates with its own data,
                        users and operational configuration.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </WindowFrame>
        </div>
      </div>
    </section>
  );
}