import {
  Activity,
  BadgeCheck,
  Building2,
  CloudCog,
  FileCheck2,
  Headphones,
  LifeBuoy,
  MessageSquare,
  MonitorCheck,
  ReceiptText,
  ServerCog,
  ShieldAlert,
  ShieldCheck,
  UsersRound,
  Warehouse,
} from "lucide-react";

import ComplianceFramework from "@/components/public-experience/ComplianceFramework";
import EnterpriseBlueprintCanvas from "@/components/public-experience/EnterpriseBlueprintCanvas";
import EnterpriseFAQ from "@/components/public-experience/EnterpriseFAQ";
import IdentityJourneyTimeline from "@/components/public-experience/IdentityJourneyTimeline";
import SecurityResponseCenter from "@/components/public-experience/SecurityResponseCenter";

import {
  PublicCard,
  PublicExperienceLayout,
  PublicSection,
} from "@/components/public-experience/PublicExperienceLayout";

const successTracks = [
  {
    icon: LifeBuoy,
    title: "Business operations support",
    text: "Guidance for tenant setup, subscriptions, billing, users, roles, permissions, reports, workspace administration, and operational continuity.",
  },
  {
    icon: ServerCog,
    title: "Technical readiness",
    text: "Support for desktop installation, offline login, synchronization, connectivity, storage, realtime services, infrastructure signals, and deployment troubleshooting.",
  },
  {
    icon: ShieldAlert,
    title: "Security assistance",
    text: "Structured handling for suspicious sessions, unauthorized access, device risk, support-access governance, payment abuse, and permission misconfiguration.",
  },
  {
    icon: MessageSquare,
    title: "Implementation guidance",
    text: "Practical support for POS rollout, inventory configuration, EBM readiness, procurement, branches, warehouses, reporting, and staff onboarding.",
  },
];

const deploymentStages = [
  {
    title: "Discover",
    detail:
      "Understand the organization, operating model, branches, warehouses, users, products, fiscal requirements, devices, and business objectives.",
  },
  {
    title: "Design",
    detail:
      "Define tenant structure, roles, permissions, module scope, subscription model, reporting needs, and implementation responsibilities.",
  },
  {
    title: "Configure",
    detail:
      "Prepare workspace settings, product catalogs, inventory rules, pricing, tax configuration, staff access, integrations, and desktop requirements.",
  },
  {
    title: "Validate",
    detail:
      "Test workflows, permissions, receipts, purchases, stock movement, reporting, offline operation, synchronization, and administrative access.",
  },
  {
    title: "Deploy",
    detail:
      "Activate users, workstations, branches, warehouses, subscriptions, support channels, fiscal settings, and operational procedures.",
  },
  {
    title: "Optimize",
    detail:
      "Review adoption, incidents, reporting, audit visibility, process quality, user feedback, performance, and future growth requirements.",
  },
];

const supportCoverage = [
  {
    title: "Identity and access",
    detail:
      "Login, activation, offline authentication, invitations, tenant membership, roles, permissions, account recovery, and workspace access.",
  },
  {
    title: "Sales and checkout",
    detail:
      "POS, receipts, quotations, sales approval, payment methods, returns, customer transactions, cashier access, and printing.",
  },
  {
    title: "Inventory operations",
    detail:
      "Products, categories, pricing, warehouses, branches, stock counts, transfers, adjustments, movements, and synchronization.",
  },
  {
    title: "Procurement and finance",
    detail:
      "Suppliers, purchases, purchase orders, expenses, invoices, billing, subscriptions, payment attempts, and reporting.",
  },
  {
    title: "People and collaboration",
    detail:
      "Staff, payroll workflows, workspace chat, meetings, notifications, user administration, and operational responsibilities.",
  },
  {
    title: "Platform administration",
    detail:
      "Tenants, support access, devices, audit logs, infrastructure, storage, monitoring, roles, permissions, and automation.",
  },
];

const requestChecklist = [
  {
    title: "Tenant context",
    detail:
      "Business name, tenant name, affected workspace, branch, warehouse, and user role.",
  },
  {
    title: "Issue details",
    detail:
      "Affected module, exact error message, screenshot, timestamp, expected result, and observed result.",
  },
  {
    title: "Environment",
    detail:
      "Web or desktop, application version, device type, operating system, browser, and connectivity state.",
  },
  {
    title: "Operational scope",
    detail:
      "Whether the issue affects one user, one device, one branch, several workspaces, or the full organization.",
  },
  {
    title: "Recent changes",
    detail:
      "Permission updates, deployments, imports, billing changes, configuration changes, desktop installation, or synchronization activity.",
  },
  {
    title: "Reproduction steps",
    detail:
      "The exact sequence that caused the issue and whether it can be reproduced consistently.",
  },
];

const supportPriorities = [
  {
    code: "P1",
    title: "Critical continuity",
    detail:
      "Tenant-wide access failure, confirmed security incident, POS unavailable, payment blockage, active data exposure, or major operational outage.",
    treatment: "Immediate triage",
    tone: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
  },
  {
    code: "P2",
    title: "Major business impact",
    detail:
      "Multi-user workflow failure, synchronization disruption, inventory blockage, billing failure, or major branch-level interruption.",
    treatment: "Priority investigation",
    tone: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
  },
  {
    code: "P3",
    title: "Standard operational issue",
    detail:
      "Configuration errors, module behavior, reporting concerns, permission issues, desktop problems, or workflow questions.",
    treatment: "Business support queue",
    tone: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
  },
  {
    code: "P4",
    title: "Advisory and enablement",
    detail:
      "Implementation planning, migration preparation, training, process design, workflow review, or best-practice guidance.",
    treatment: "Success advisory",
    tone: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
  },
];

const secureSupportControls = [
  {
    title: "Explicit authorization",
    detail:
      "Sensitive access should be approved by the tenant owner or an authorized administrator.",
  },
  {
    title: "Limited scope",
    detail:
      "Support access should be restricted to the affected tenant, module, data domain, and required duration.",
  },
  {
    title: "Temporary access",
    detail:
      "Support privileges should expire or be revoked after investigation and validation are complete.",
  },
  {
    title: "Audit visibility",
    detail:
      "Support sessions, impersonation activity, administrative actions, and access changes should remain reviewable.",
  },
  {
    title: "Credential protection",
    detail:
      "Users should not share passwords, unrestricted database credentials, secret keys, or uncontrolled administrator access.",
  },
  {
    title: "Resolution documentation",
    detail:
      "The issue, investigation, changes, validation, and closure outcome should be clearly documented.",
  },
];

const knowledgeAreas = [
  {
    icon: ReceiptText,
    title: "POS and sales",
    detail:
      "Checkout, receipts, payments, returns, cashier access, quotations, and sales workflows.",
  },
  {
    icon: Warehouse,
    title: "Inventory and warehousing",
    detail:
      "Products, stock, counts, adjustments, transfers, branches, warehouses, and movement history.",
  },
  {
    icon: Building2,
    title: "Tenant administration",
    detail:
      "Workspace setup, users, roles, permissions, plans, billing, licenses, and organization settings.",
  },
  {
    icon: CloudCog,
    title: "Desktop and offline",
    detail:
      "Installation, cached login, local data, pending queues, synchronization, recovery, and updates.",
  },
  {
    icon: ShieldCheck,
    title: "Security and governance",
    detail:
      "Sessions, devices, support access, audit logs, suspicious activity, and administrative controls.",
  },
  {
    icon: UsersRound,
    title: "People and collaboration",
    detail:
      "Staff, workspace chat, meetings, notifications, roles, and team operating workflows.",
  },
];

const successFAQ = [
  {
    question: "Why is the public Success Center separate from tenant support?",
    answer:
      "The public Success Center provides implementation guidance, readiness information, support preparation, escalation principles, and product education. Tenant-specific cases should be handled through the protected in-app support workflow.",
  },
  {
    question: "What information should be included in a support request?",
    answer:
      "Include the tenant, workspace, affected module, user role, device, application version, exact error, screenshots, connectivity state, time of occurrence, operational impact, and reproduction steps.",
  },
  {
    question: "How should a critical issue be classified?",
    answer:
      "Use the highest reasonable priority when the issue involves confirmed unauthorized access, data exposure, tenant-wide outage, inability to transact, payment compromise, or loss of essential business access.",
  },
  {
    question: "Can ShopCore assist with implementation?",
    answer:
      "Yes. Implementation guidance may cover tenant structure, branches, warehouses, users, roles, product import, POS setup, inventory workflows, desktop deployment, offline readiness, reporting, billing, and EBM preparation.",
  },
  {
    question: "How should sensitive support access be granted?",
    answer:
      "Use an approved, limited, temporary, and auditable support-access workflow. Avoid password sharing, unrestricted administrator access, or direct credential exchange.",
  },
  {
    question: "Can support recover lost or incorrect business records?",
    answer:
      "Recovery depends on the affected module, record state, audit history, synchronization state, available backups, customer configuration, and technical feasibility. Support should never fabricate missing records.",
  },
  {
    question: "Does ShopCore guarantee that every issue can be resolved remotely?",
    answer:
      "No. Some issues may require device access, internet restoration, printer configuration, database correction, software updates, customer approval, third-party assistance, or on-site operational review.",
  },
  {
    question: "What happens after a critical incident is resolved?",
    answer:
      "The tenant should validate normal operations, review affected records and access, revoke temporary privileges, confirm synchronization, document the resolution, and apply follow-up controls where appropriate.",
  },
];

export default function SupportPage() {
  return (
    <PublicExperienceLayout
      center="success"
      eyebrow="ShopCore Success Center"
      title="Implementation, support, and operational continuity for growing businesses."
      description="The ShopCore Success Center helps organizations plan, configure, deploy, operate, secure, troubleshoot, and scale across cloud ERP, desktop workstations, offline workflows, Platform Admin, billing, and tenant governance."
    >
      <PublicSection
        eyebrow="Success services"
        title="Support is organized around business impact and operational readiness."
        description="ShopCore support should understand the tenant, affected workflow, user responsibility, business impact, device state, connectivity, and operational context before recommending a resolution."
      >
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {successTracks.map((track) => (
            <PublicCard
              key={track.title}
              icon={track.icon}
              title={track.title}
              text={track.text}
              tone="emerald"
            />
          ))}
        </div>
      </PublicSection>

      <EnterpriseBlueprintCanvas
        tone="success"
        title="The success architecture connects implementation, deployment, support, continuity, and business growth."
        description="Tenant preparation, user enablement, module configuration, desktop deployment, offline readiness, incident routing, secure assistance, monitoring, and optimization form one connected customer-success model."
      />

      <PublicSection
        eyebrow="Implementation lifecycle"
        title="Successful deployment begins before the first live transaction."
        description="The implementation journey should move through discovery, design, configuration, validation, deployment, and continuous optimization."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {deploymentStages.map((stage, index) => (
            <article
              key={stage.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-700 dark:text-blue-200">
                  Phase {String(index + 1).padStart(2, "0")}
                </span>

                <Activity className="h-4 w-4 text-blue-600 dark:text-blue-200" />
              </div>

              <h3 className="mt-4 text-base font-black text-slate-950 dark:text-white">
                {stage.title}
              </h3>

              <p className="mt-2 text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                {stage.detail}
              </p>
            </article>
          ))}
        </div>
      </PublicSection>

      <PublicSection
        eyebrow="Support coverage"
        title="Operational assistance across the complete ShopCore platform."
        description="Cases should be evaluated in the context of the affected business workflow rather than treated only as isolated technical errors."
      >
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          {supportCoverage.map((area, index) => (
            <div
              key={area.title}
              className={[
                "grid gap-3 px-5 py-5 md:grid-cols-[0.42fr_1.58fr]",
                index > 0 ? "border-t border-slate-200 dark:border-slate-600" : "",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <MonitorCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700 dark:text-blue-200" />

                <h3 className="text-sm font-black text-slate-950 dark:text-white">
                  {area.title}
                </h3>
              </div>

              <p className="text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                {area.detail}
              </p>
            </div>
          ))}
        </div>
      </PublicSection>

      <PublicSection
        eyebrow="Request preparation"
        title="A complete support request reduces investigation time and operational disruption."
        description="Support teams need accurate tenant, environment, error, and business-impact context before they can investigate responsibly."
      >
        <div className="grid gap-5 md:grid-cols-2">
          {requestChecklist.map((item, index) => (
            <article
              key={item.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-xs font-black text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                  {index + 1}
                </span>

                <div>
                  <h3 className="text-sm font-black text-slate-950 dark:text-white">
                    {item.title}
                  </h3>

                  <p className="mt-2 text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                    {item.detail}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </PublicSection>

      <section className="border-b border-slate-200 bg-white px-5 py-10 sm:px-6 lg:py-14 dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-700 dark:text-blue-200">
              Support priority
            </p>

            <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              Cases are classified by business impact, security risk, and
              affected scope.
            </h2>

            <p className="mt-4 text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
              Priority should reflect whether the issue affects revenue,
              security, user access, billing, synchronization, reporting,
              customer service, or the organization's ability to continue
              operating.
            </p>

            <div className="mt-7 rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-800 dark:bg-blue-900/30">
              <div className="flex gap-3">
                <Headphones className="mt-0.5 h-5 w-5 shrink-0 text-blue-700 dark:text-blue-200" />
                <p className="text-sm font-semibold leading-7 text-blue-950 dark:text-blue-100">
                  Assigning an unnecessarily high priority can slow the response
                  process for genuinely critical incidents. Classify cases
                  accurately and provide evidence of the operational impact.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {supportPriorities.map((priority) => (
              <article
                key={priority.code}
                className="rounded-2xl border border-slate-200 bg-[#f4f6f9] p-5 dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={[
                      "rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
                      priority.tone,
                    ].join(" ")}
                  >
                    {priority.code}
                  </span>

                  <BadgeCheck className="h-5 w-5 text-slate-400" />
                </div>

                <h3 className="mt-4 text-sm font-black text-slate-950 dark:text-white">
                  {priority.title}
                </h3>

                <p className="mt-2 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
                  {priority.detail}
                </p>

                <p className="mt-4 border-t border-slate-200 pt-3 text-xs font-black text-slate-700 dark:border-slate-600 dark:text-slate-300">
                  {priority.treatment}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <PublicSection
        eyebrow="Secure support access"
        title="Sensitive assistance must remain authorized, limited, temporary, and auditable."
        description="Structured support access protects tenant data, user trust, administrative responsibility, and platform security during investigation."
      >
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {secureSupportControls.map((control, index) => (
            <article
              key={control.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="flex items-center justify-between">
                <ShieldCheck className="h-5 w-5 text-blue-700 dark:text-blue-200" />

                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                  Control {String(index + 1).padStart(2, "0")}
                </span>
              </div>

              <h3 className="mt-4 text-sm font-black text-slate-950 dark:text-white">
                {control.title}
              </h3>

              <p className="mt-2 text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                {control.detail}
              </p>
            </article>
          ))}
        </div>
      </PublicSection>

      <IdentityJourneyTimeline
        tone="success"
        title="Support access follows a governed identity and authorization lifecycle."
        description="User identity, tenant association, permission scope, device posture, session monitoring, audit visibility, temporary access, and revocation remain connected throughout sensitive assistance."
      />

      <section className="border-b border-slate-200 bg-[#f4f6f9] px-5 py-10 sm:px-6 lg:py-14 dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-700 dark:text-blue-200">
              Knowledge and enablement
            </p>

            <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              Guidance organized around real business functions.
            </h2>

            <p className="mt-4 text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
              ShopCore knowledge should help users understand how business
              processes, permissions, devices, modules, and administrative
              controls work together.
            </p>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {knowledgeAreas.map((area) => {
              const Icon = area.icon;

              return (
                <article
                  key={area.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                    <Icon className="h-5 w-5" />
                  </div>

                  <h3 className="mt-5 text-base font-black text-slate-950 dark:text-white">
                    {area.title}
                  </h3>

                  <p className="mt-2 text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                    {area.detail}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <ComplianceFramework
        tone="success"
        title="Operational readiness supported by accountable governance."
        description="ShopCore Success services are built around documented implementation, controlled access, issue classification, secure support, deployment validation, audit visibility, and responsible business continuity."
      />

      <EnterpriseFAQ
        tone="success"
        title="Support, implementation, and continuity questions"
        description="Practical guidance for tenant owners, administrators, implementation teams, cashiers, inventory managers, support personnel, and technical operators."
        items={successFAQ}
      />

      <SecurityResponseCenter
        tone="success"
        title="Support escalation and operational response"
        description="A structured path for classifying, routing, authorizing, investigating, resolving, validating, and reviewing critical security and business-continuity incidents."
      />
    </PublicExperienceLayout>
  );
}