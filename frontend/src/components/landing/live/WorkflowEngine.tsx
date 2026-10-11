import {
  BarChart3,
  CheckCircle2,
  CreditCard,
  Database,
  Package,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import { motion } from "framer-motion";
import { useLandingExperience } from "@/contexts/LandingExperienceContext";
import { getDemoWorkflow } from "@/data/landingDemoData";

type Tone = "blue" | "emerald" | "orange" | "rose" | "violet" | "cyan";

type WorkflowEngineProps = {
  title?: string;
  subtitle?: string;
  compact?: boolean;
  className?: string;
};

const iconMap = {
  pos: ShoppingCart,
  inventory: Package,
  warehouse: Warehouse,
  crm: Users,
  procurement: Truck,
  finance: CreditCard,
  analytics: BarChart3,
  offline: Database,
  ebm: ReceiptText,
  security: ShieldCheck,
};

const toneMap: Record<Tone, string> = {
  blue: "border-border bg-muted text-foreground",
  emerald: "border-border bg-muted text-foreground",
  orange: "border-border bg-muted text-foreground",
  rose: "border-border bg-muted text-foreground",
  violet: "border-border bg-muted text-foreground",
  cyan: "border-border bg-muted text-foreground",
};

const dotMap: Record<Tone, string> = {
  blue: "bg-blue-500",
  emerald: "bg-blue-500",
  orange: "bg-blue-500",
  rose: "bg-blue-500",
  violet: "bg-blue-500",
  cyan: "bg-blue-500",
};

const moduleTone: Record<string, Tone> = {
  pos: "blue",
  inventory: "blue",
  warehouse: "blue",
  crm: "blue",
  procurement: "blue",
  finance: "blue",
  analytics: "blue",
  offline: "blue",
  ebm: "blue",
  security: "blue",
};

const defaultFlow = [
  "Sale captured",
  "Stock updated",
  "Customer record refreshed",
  "Finance posted",
  "Executive view updated",
];

const moduleSequence = [
  "pos",
  "inventory",
  "warehouse",
  "crm",
  "finance",
  "analytics",
] as const;

export default function WorkflowEngine({
  title = "Live workflow engine",
  subtitle = "Business actions move through one synchronized operating flow.",
  compact = false,
  className = "",
}: WorkflowEngineProps) {
  const { selectedModule, tick, activityFeed } = useLandingExperience();

  const workflow = getDemoWorkflow(selectedModule) as Record<string, unknown>;

  const workflowSteps = Array.isArray(workflow.steps)
    ? workflow.steps.map((item) => String(item)).slice(0, compact ? 4 : 6)
    : defaultFlow;

  const activeIndex = workflowSteps.length
    ? tick % workflowSteps.length
    : 0;

  return (
    <div
      className={[
        "rounded-3xl border border-border bg-card p-5 shadow-sm",
        className,
      ].join(" ")}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400 dark:!text-slate-300">
            {title}
          </p>
          <p className="mt-1 text-sm font-medium leading-6 text-slate-600 dark:!text-slate-200">
            {subtitle}
          </p>
        </div>

        <span className="hidden rounded-full border border-border bg-muted px-3 py-1 text-[10px] font-black uppercase tracking-wide text-blue-700 dark:text-blue-200 sm:inline-flex">
          {activityFeed[0]?.module ?? selectedModule}
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-6">
        {workflowSteps.map((step, index) => {
          const moduleId =
            moduleSequence[index % moduleSequence.length] ?? selectedModule;

          const Icon = iconMap[moduleId] ?? CheckCircle2;
          const tone = moduleTone[moduleId] ?? "blue";
          const active = index === activeIndex;
          const completed = index < activeIndex;

          return (
            <div key={`workflow-step-${selectedModule}-${index}`} className="relative">
              <motion.div
                animate={{
                  y: active ? -4 : 0,
                  scale: active ? 1.03 : 1,
                }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className={[
                  "h-full rounded-2xl border p-4 transition-all",
                  active
                    ? "border-blue-300 bg-blue-50 dark:border-blue-500 dark:bg-blue-900 shadow-[0_20px_60px_-42px_rgba(59,130,246,0.9)]"
                    : completed
                      ? "border-border bg-muted dark:bg-slate-800"
                      : "border-border bg-muted dark:bg-slate-800",
                ].join(" ")}
              >
                <div
                  className={[
                    "mb-4 flex h-11 w-11 items-center justify-center text-slate-900 dark:!text-blue-300",
                  ].join(" ")}
                >
                  <Icon className="h-5 w-5" />
                </div>

                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400 dark:!text-slate-300">
                  Step {index + 1}
                </p>

                <p className="mt-1 text-sm font-black leading-5 text-slate-950 dark:!text-white">
                  {step}
                </p>

                <div className="mt-4 flex items-center gap-2">
                  <span
                    className={[
                      "h-2 w-2 rounded-full",
                      active ? "bg-blue-500" : completed ? "bg-blue-500" : dotMap[tone],
                    ].join(" ")}
                  />
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-400 dark:!text-slate-300">
                    {active ? "Active" : completed ? "Completed" : "Waiting"}
                  </span>
                </div>
              </motion.div>

              {index < workflowSteps.length - 1 ? (
                <div className="absolute right-[-12px] top-1/2 z-10 hidden h-px w-6 bg-border lg:block">
                  <motion.span
                    animate={{ x: ["0%", "100%", "0%"] }}
                    transition={{
                      duration: 1.8,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="block h-px w-3 bg-blue-500"
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}