import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileCheck2,
  PackageSearch,
  RefreshCcw,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
  Zap,
} from "lucide-react";
import WindowFrame from "./WindowFrame";
import StatCard from "./StatCard";
import { useLandingExperience } from "@/contexts/LandingExperienceContext";

const workflowMap = {
  pos: {
    title: "Checkout to business update flow",
    status: "POS workflow",
    flows: [
      {
        title: "Sale completed",
        detail: "Cashier confirms payment and receipt.",
        icon: ShoppingCart,
        tone: "blue",
      },
      {
        title: "Stock deducted",
        detail: "Inventory quantity updates immediately.",
        icon: PackageSearch,
        tone: "blue",
      },
      {
        title: "Customer history updated",
        detail: "CRM profile receives purchase activity.",
        icon: Users,
        tone: "blue",
      },
      {
        title: "Fiscal queue prepared",
        detail: "EBM workflow activates when configured.",
        icon: FileCheck2,
        tone: "blue",
      },
      {
        title: "Reports refreshed",
        detail: "Revenue and margin KPIs update.",
        icon: RefreshCcw,
        tone: "blue",
      },
    ],
  },
  inventory: {
    title: "Stock alert to replenishment flow",
    status: "Inventory workflow",
    flows: [
      {
        title: "Low stock detected",
        detail: "Rice 25kg reached reorder threshold.",
        icon: PackageSearch,
        tone: "blue",
      },
      {
        title: "Purchase review",
        detail: "Supplier and quantity recommendation prepared.",
        icon: ClipboardCheck,
        tone: "blue",
      },
      {
        title: "Warehouse receiving",
        detail: "Incoming stock updates batches and valuation.",
        icon: Warehouse,
        tone: "blue",
      },
      {
        title: "Branch transfer",
        detail: "Stock moved to high-demand branch.",
        icon: Truck,
        tone: "blue",
      },
      {
        title: "POS availability updated",
        detail: "Cashiers sell from refreshed inventory.",
        icon: ShoppingCart,
        tone: "blue",
      },
    ],
  },
  warehouse: {
    title: "Receiving to branch transfer flow",
    status: "Warehouse workflow",
    flows: [
      {
        title: "Goods received",
        detail: "Warehouse team confirms incoming stock.",
        icon: Warehouse,
        tone: "blue",
      },
      {
        title: "Batch valuation updated",
        detail: "Cost and quantity layers are recorded.",
        icon: Database,
        tone: "blue",
      },
      {
        title: "Capacity reviewed",
        detail: "Warehouse load is checked by location.",
        icon: PackageSearch,
        tone: "blue",
      },
      {
        title: "Transfer approved",
        detail: "Branch stock movement is authorized.",
        icon: ClipboardCheck,
        tone: "blue",
      },
      {
        title: "Branch stock updated",
        detail: "Destination branch receives availability.",
        icon: Truck,
        tone: "blue",
      },
    ],
  },
  crm: {
    title: "Customer loyalty to repeat sale flow",
    status: "CRM workflow",
    flows: [
      {
        title: "Customer identified",
        detail: "POS links sale to customer profile.",
        icon: Users,
        tone: "blue",
      },
      {
        title: "Loyalty applied",
        detail: "Points and customer tier update.",
        icon: CheckCircle2,
        tone: "blue",
      },
      {
        title: "Credit reviewed",
        detail: "Customer balance and credit rules checked.",
        icon: ClipboardCheck,
        tone: "blue",
      },
      {
        title: "Retention signal",
        detail: "Repeat purchase opportunity is flagged.",
        icon: BellRing,
        tone: "blue",
      },
      {
        title: "Customer report updated",
        detail: "CRM analytics refresh automatically.",
        icon: RefreshCcw,
        tone: "blue",
      },
    ],
  },
  procurement: {
    title: "Purchase order to receiving flow",
    status: "Procurement workflow",
    flows: [
      {
        title: "Demand signal created",
        detail: "Inventory and sales trends trigger purchase review.",
        icon: PackageSearch,
        tone: "blue",
      },
      {
        title: "Supplier selected",
        detail: "Preferred supplier and cost history reviewed.",
        icon: Truck,
        tone: "blue",
      },
      {
        title: "Purchase order prepared",
        detail: "Items, quantities and expected costs organized.",
        icon: ClipboardCheck,
        tone: "blue",
      },
      {
        title: "Receiving completed",
        detail: "Warehouse confirms delivered items.",
        icon: Warehouse,
        tone: "blue",
      },
      {
        title: "Stock valuation updated",
        detail: "Inventory value and reports refresh.",
        icon: Database,
        tone: "blue",
      },
    ],
  },
  finance: {
    title: "Cash session to margin report flow",
    status: "Finance workflow",
    flows: [
      {
        title: "Cash session closed",
        detail: "Sales and payments are summarized.",
        icon: ClipboardCheck,
        tone: "blue",
      },
      {
        title: "Expenses recorded",
        detail: "Operational costs are added to finance.",
        icon: Database,
        tone: "blue",
      },
      {
        title: "Margins calculated",
        detail: "Revenue, costs and stock value are connected.",
        icon: RefreshCcw,
        tone: "blue",
      },
      {
        title: "Branch result reviewed",
        detail: "Profitability by location becomes visible.",
        icon: Warehouse,
        tone: "blue",
      },
      {
        title: "Executive report ready",
        detail: "Finance KPIs reach management dashboards.",
        icon: FileCheck2,
        tone: "blue",
      },
    ],
  },
  analytics: {
    title: "Operations to executive KPI flow",
    status: "Analytics workflow",
    flows: [
      {
        title: "Sales data captured",
        detail: "POS transactions feed the reporting layer.",
        icon: ShoppingCart,
        tone: "blue",
      },
      {
        title: "Inventory data merged",
        detail: "Stock movement updates valuation and availability.",
        icon: PackageSearch,
        tone: "blue",
      },
      {
        title: "Customer data linked",
        detail: "CRM and loyalty signals enrich reports.",
        icon: Users,
        tone: "blue",
      },
      {
        title: "Branch comparison",
        detail: "Performance is compared across locations.",
        icon: Warehouse,
        tone: "blue",
      },
      {
        title: "Management KPI refreshed",
        detail: "Executive dashboard receives the final signal.",
        icon: RefreshCcw,
        tone: "blue",
      },
    ],
  },
  offline: {
    title: "Offline queue to secure sync flow",
    status: "Continuity workflow",
    flows: [
      {
        title: "Network unavailable",
        detail: "POS and stock operations continue locally.",
        icon: Database,
        tone: "blue",
      },
      {
        title: "Record queued",
        detail: "Sale or stock record is stored safely.",
        icon: ClipboardCheck,
        tone: "blue",
      },
      {
        title: "Secure login restored",
        detail: "User returns with valid online session.",
        icon: ShieldCheck,
        tone: "blue",
      },
      {
        title: "Sync processed",
        detail: "Pending records post to Supabase.",
        icon: RefreshCcw,
        tone: "blue",
      },
      {
        title: "Reports updated",
        detail: "Business dashboards reflect final data.",
        icon: FileCheck2,
        tone: "blue",
      },
    ],
  },
  ebm: {
    title: "Sale to fiscal receipt flow",
    status: "Fiscal workflow",
    flows: [
      {
        title: "Sale completed",
        detail: "POS saves receipt and business record.",
        icon: ShoppingCart,
        tone: "blue",
      },
      {
        title: "Tenant config checked",
        detail: "EBM credentials are verified per business.",
        icon: ShieldCheck,
        tone: "blue",
      },
      {
        title: "Fiscal submission",
        detail: "Configured tenants submit through fiscal workflow.",
        icon: FileCheck2,
        tone: "blue",
      },
      {
        title: "Retry queue available",
        detail: "Failed submissions can be reviewed.",
        icon: RefreshCcw,
        tone: "blue",
      },
      {
        title: "Receipt updated",
        detail: "Fiscal fields attach to the sale record.",
        icon: ClipboardCheck,
        tone: "blue",
      },
    ],
  },
  security: {
    title: "Role permission to audit trail flow",
    status: "Security workflow",
    flows: [
      {
        title: "User signs in",
        detail: "Authentication validates account access.",
        icon: ShieldCheck,
        tone: "blue",
      },
      {
        title: "Role checked",
        detail: "Module permission is verified.",
        icon: ClipboardCheck,
        tone: "blue",
      },
      {
        title: "Branch access applied",
        detail: "User sees allowed operational scope.",
        icon: Warehouse,
        tone: "blue",
      },
      {
        title: "Action completed",
        detail: "Business event is processed safely.",
        icon: CheckCircle2,
        tone: "blue",
      },
      {
        title: "Audit trail updated",
        detail: "Activity remains visible for governance.",
        icon: Database,
        tone: "blue",
      },
    ],
  },
};

const rulesByModule: Record<string, { label: string; value: string; tone: string }[]> = {
  pos: [
    { label: "Checkout controls", value: "Active", tone: "blue" },
    { label: "Receipt workflow", value: "Ready", tone: "blue" },
    { label: "Stock deduction", value: "Automatic", tone: "blue" },
    { label: "Payment capture", value: "Controlled", tone: "blue" },
  ],
  inventory: [
    { label: "Reorder rules", value: "Active", tone: "blue" },
    { label: "Transfer approvals", value: "Controlled", tone: "blue" },
    { label: "Stock valuation", value: "Updated", tone: "blue" },
    { label: "Alerts", value: "Live", tone: "blue" },
  ],
  warehouse: [
    { label: "Receiving rules", value: "Active", tone: "blue" },
    { label: "Capacity review", value: "Enabled", tone: "blue" },
    { label: "Transfers", value: "Controlled", tone: "blue" },
    { label: "Stock counts", value: "Supported", tone: "blue" },
  ],
  crm: [
    { label: "Loyalty rules", value: "Enabled", tone: "blue" },
    { label: "Credit control", value: "Managed", tone: "blue" },
    { label: "Segments", value: "Active", tone: "blue" },
    { label: "Purchase history", value: "Tracked", tone: "blue" },
  ],
  default: [
    { label: "Approval rules", value: "Controlled", tone: "blue" },
    { label: "Data updates", value: "Live", tone: "blue" },
    { label: "Audit events", value: "Tracked", tone: "blue" },
    { label: "Operational alerts", value: "Active", tone: "blue" },
  ],
};

const toneIcon: Record<string, string> = {
  emerald: "border-border bg-muted text-foreground",
  blue: "border-border bg-muted text-foreground",
  cyan: "border-border bg-muted text-foreground",
  orange: "border-border bg-muted text-foreground",
  violet: "border-border bg-muted text-foreground",
};

const toneDot: Record<string, string> = {
  emerald: "bg-blue-500",
  blue: "bg-blue-500",
  cyan: "bg-blue-500",
  orange: "bg-blue-500",
  violet: "bg-blue-500",
};

const toneBadge: Record<string, string> = {
  emerald: "border-border bg-muted text-foreground",
  blue: "border-border bg-muted text-foreground",
  cyan: "border-border bg-muted text-foreground",
  orange: "border-border bg-muted text-foreground",
  violet: "border-border bg-muted text-foreground",
};

export default function RetailAutomationEngine() {
  const { selectedModule, highlightedWorkflow, demoMode } =
    useLandingExperience();

  const workflow = workflowMap[selectedModule] ?? workflowMap.inventory;
  const rules = rulesByModule[selectedModule] ?? rulesByModule.default;

  return (
    <section className="relative overflow-hidden bg-card py-20 sm:py-28">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.08),transparent_30%),radial-gradient(circle_at_90%_20%,rgba(37,99,235,0.08),transparent_28%)]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600 dark:text-blue-200">
            Retail automation engine
          </p>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900 dark:!text-blue-100 sm:text-5xl">
            Turn daily retail events into controlled business workflows.
          </h2>

          <p className="mt-5 text-base font-medium leading-8 text-slate-700 dark:!text-slate-200">
            ShopCore connects alerts, approvals, replenishment, warehouse
            receiving, stock transfers, POS availability and reporting into
            structured operating flows.
          </p>
        </div>

        <WindowFrame
          title="Automation Workflow Composer"
          eyebrow={highlightedWorkflow.split("-").join(" ")}
          icon={Zap}
          status={demoMode ? "Demo cycling" : workflow.status}
          statusTone="blue"
          bodyClassName="bg-muted/70 p-4 sm:p-5"
        >
          <div className="grid gap-4 lg:grid-cols-4">
            <StatCard
              label="Selected module"
              value={selectedModule.toUpperCase()}
              icon={RefreshCcw}
              trend={workflow.status}
              trendDirection="neutral"
              caption="Shared experience state"
            />

            <StatCard
              label="Events handled"
              value="318"
              icon={BellRing}
              trend="+21%"
              trendDirection="up"
              caption="This month"
            />

            <StatCard
              label="Workflow readiness"
              value="96%"
              icon={ClipboardCheck}
              trend="Prepared"
              trendDirection="up"
              caption="Operational controls"
            />

            <StatCard
              label="Data updates"
              value="Live"
              icon={Database}
              trend="Synchronized"
              trendDirection="up"
              caption="Across modules"
            />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
            <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                    Workflow chain
                  </p>
                  <h3 className="mt-1 text-lg font-black text-slate-900 dark:!text-blue-100">
                    {workflow.title}
                  </h3>
                </div>

                <FileCheck2 className="h-5 w-5 text-muted-foreground" />
              </div>

              <div className="grid gap-3 xl:grid-cols-5">
                {workflow.flows.map((flow, index) => {
                  const Icon = flow.icon;
                  const stepState = index === 0 ? "Completed" : index === 1 ? "Completed" : index === 2 ? "Active" : "Waiting";
                  
                  const getStepDescription = (state: string, baseDetail: string) => {
                    if (state === "Active") return `${baseDetail} · In progress`;
                    if (state === "Completed") return `${baseDetail} · Done`;
                    return `${baseDetail} · Pending`;
                  };

                  return (
                    <div key={flow.title} className="relative">
                      <div className={[
                        "h-full rounded-2xl border p-4 transition-all",
                        stepState === "Active" ? "border-blue-300 bg-blue-50 dark:border-blue-500 dark:bg-blue-900" : "border-border bg-muted dark:bg-slate-800",
                      ].join(" ")}>
                        <div
                          className={[
                            "mb-4 flex h-11 w-11 items-center justify-center text-slate-900 dark:!text-blue-300",
                          ].join(" ")}
                        >
                          <Icon className="h-5 w-5" />
                        </div>

                        <p className="text-sm font-black text-slate-900 dark:!text-white">
                          {flow.title}
                        </p>

                        <p className="mt-2 text-xs font-medium leading-5 text-slate-700 dark:!text-slate-300">
                          {getStepDescription(stepState, flow.detail)}
                        </p>

                        <div className="mt-4 flex items-center justify-between">
                          <p className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:!text-slate-300">
                            Step {index + 1}
                          </p>
                          <span className={[
                            "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                            stepState === "Active" ? "border-blue-500 bg-blue-500 text-white dark:border-blue-400 dark:bg-blue-500 dark:text-white" : 
                            stepState === "Completed" ? "border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-600 dark:bg-blue-800 dark:!text-blue-200" : 
                            "border-border bg-muted text-slate-500 dark:border-slate-600 dark:bg-slate-700 dark:!text-slate-200"
                          ].join(" ")}>
                            {stepState}
                          </span>
                        </div>
                      </div>

                      {index < workflow.flows.length - 1 ? (
                        <div className="absolute right-[-14px] top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground xl:flex">
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                  Control rules
                </p>

                <div className="mt-4 space-y-3">
                  {rules.map((rule) => (
                    <div
                      key={rule.label}
                      className="flex items-center justify-between rounded-2xl border border-border bg-muted/80 px-3 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={[
                            "h-2.5 w-2.5 rounded-full",
                            toneDot[rule.tone],
                          ].join(" ")}
                        />
                        <span className="text-sm font-black text-slate-900 dark:!text-blue-100">
                          {rule.label}
                        </span>
                      </div>

                      <span
                        className={[
                          "rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide",
                          toneBadge[rule.tone],
                        ].join(" ")}
                      >
                        {rule.value}
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
                    <p className="text-sm font-black text-slate-900 dark:!text-blue-100">
                      Human-controlled automation
                    </p>
                    <p className="mt-1 text-xs font-medium leading-6 text-blue-700">
                      ShopCore supports structured workflows where business
                      managers stay in control of approvals, stock movement and
                      replenishment actions.
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