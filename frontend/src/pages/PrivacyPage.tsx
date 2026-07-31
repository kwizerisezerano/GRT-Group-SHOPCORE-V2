import {
  CloudCog,
  Database,
  KeyRound,
  MonitorCheck,
  ShieldCheck,
  ShieldEllipsis,
} from "lucide-react";

import ComplianceFramework from "@/components/public-experience/ComplianceFramework";
import DataClassificationMatrix from "@/components/public-experience/DataClassificationMatrix";
import DataLifecycleMap from "@/components/public-experience/DataLifecycleMap";
import EnterpriseBlueprintCanvas from "@/components/public-experience/EnterpriseBlueprintCanvas";
import EnterpriseFAQ from "@/components/public-experience/EnterpriseFAQ";
import IdentityJourneyTimeline from "@/components/public-experience/IdentityJourneyTimeline";
import SecurityResponseCenter from "@/components/public-experience/SecurityResponseCenter";
import TenantBoundaryMap from "@/components/public-experience/TenantBoundaryMap";

import {
  PublicCard,
  PublicExperienceLayout,
  PublicSection,
} from "@/components/public-experience/PublicExperienceLayout";

const privacyPrinciples = [
  {
    icon: Database,
    title: "Business data stewardship",
    text: "Operational information is treated as a governed business asset. Tenant owners and authorized administrators remain responsible for access, accuracy, retention, use, and internal accountability within their workspace.",
  },
  {
    icon: ShieldCheck,
    title: "Tenant-scoped processing",
    text: "ShopCore processes information within the active organization, workspace, branch, warehouse, module, and authorized user context. Tenant boundaries form the default operating scope.",
  },
  {
    icon: KeyRound,
    title: "Identity-led access",
    text: "Access is evaluated through user identity, tenant membership, roles, permissions, session posture, device context, activation status, and applicable module entitlements.",
  },
  {
    icon: MonitorCheck,
    title: "Session and device governance",
    text: "Login sessions, trusted devices, desktop applications, support access, application versions, and security events may be reviewed to protect platform integrity and operational continuity.",
  },
  {
    icon: CloudCog,
    title: "Controlled offline continuity",
    text: "Offline workflows use cached access, local operational queues, validation controls, synchronization recovery, and conflict-aware processing to preserve business continuity responsibly.",
  },
  {
    icon: ShieldEllipsis,
    title: "Responsible operational intelligence",
    text: "AI-assisted proposals and insights are advisory. They do not replace user authorization, business verification, administrative approval, or professional legal, financial, accounting, and regulatory judgment.",
  },
];

const customerControls = [
  {
    title: "Identity administration",
    detail:
      "Manage users, invitations, memberships, roles, permissions, and module access.",
  },
  {
    title: "Workspace governance",
    detail:
      "Configure organization settings, branches, warehouses, operational modules, and business responsibilities.",
  },
  {
    title: "Session oversight",
    detail:
      "Review active sessions, trusted devices, desktop access, support activity, and security events where available.",
  },
  {
    title: "Data quality",
    detail:
      "Correct inaccurate business records through authorized workflows and administrative controls.",
  },
  {
    title: "Export and portability",
    detail:
      "Export supported operational information where the feature, subscription, and workspace policy permit it.",
  },
  {
    title: "Privacy assistance",
    detail:
      "Request eligible access review, correction, restriction, export, deletion, or governance support through authorized channels.",
  },
];

const privacyFAQ = [
  {
    question: "Who controls information stored inside a ShopCore workspace?",
    answer:
      "Tenant owners and authorized administrators govern users, roles, permissions, modules, workspace configuration, billing responsibility, support access, devices, and operational records within their organization.",
  },
  {
    question: "Does ShopCore sell tenant, customer, or employee information?",
    answer:
      "No. ShopCore is designed as a business operating platform rather than an advertising network. Information is processed to provide, secure, maintain, support, and improve the platform and its contracted services.",
  },
  {
    question: "What categories of information may ShopCore process?",
    answer:
      "Depending on the enabled services, ShopCore may process identity data, tenant configuration, products, inventory, sales, purchases, customers, suppliers, staff records, billing activity, support cases, device sessions, synchronization records, audit events, and infrastructure diagnostics.",
  },
  {
    question: "How is information separated between organizations?",
    answer:
      "ShopCore uses tenant context, workspace membership, authorization rules, role permissions, module entitlements, administrative controls, and database-level access policies to prevent uncontrolled cross-tenant access.",
  },
  {
    question: "How does offline operation affect privacy?",
    answer:
      "Offline execution may temporarily store authorized business records and session information on an approved device. Organizations remain responsible for physical device protection, authorized access, workstation security, and prompt reporting of lost or compromised devices.",
  },
  {
    question: "Can ShopCore support personnel access a tenant workspace?",
    answer:
      "Sensitive support should use an authorized, limited, temporary, and auditable support-access process. Customers should not share passwords or grant unrestricted database and administrator access.",
  },
  {
    question: "How are AI-assisted workflows governed?",
    answer:
      "AI-assisted outputs are intended to support authorized users. Proposed purchases, stock adjustments, summaries, and operational recommendations should be reviewed and approved before they affect business records or decisions.",
  },
  {
    question: "Can an organization request correction or deletion?",
    answer:
      "Eligible requests may be submitted through the authorized administrator or support channel. Fulfilment can depend on contractual obligations, legal retention requirements, security needs, backup cycles, technical capability, and the organization's authority over the information.",
  },
];

export default function PrivacyPage() {
  return (
    <PublicExperienceLayout
      center="trust"
      eyebrow="ShopCore Trust Center"
      title="Privacy, identity, and data governance for connected business operations."
      description="ShopCore is designed to protect tenant workspaces, user identities, operational records, device sessions, billing activity, support access, offline synchronization, and administrative controls across cloud and desktop environments."
    >
      <PublicSection
        eyebrow="Privacy operating principles"
        title="Privacy is implemented through governance, not presented only as a policy."
        description="ShopCore connects identity, tenant isolation, permission enforcement, operational purpose, offline continuity, support governance, and audit visibility throughout the information lifecycle."
      >
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {privacyPrinciples.map((principle) => (
            <PublicCard
              key={principle.title}
              icon={principle.icon}
              title={principle.title}
              text={principle.text}
              tone="blue"
            />
          ))}
        </div>
      </PublicSection>

      <EnterpriseBlueprintCanvas
        tone="trust"
        title="The ShopCore trust architecture connects identity, tenant governance, business operations, and platform oversight."
        description="Cloud services, Platform Admin, tenant boundaries, business workspaces, operating modules, offline continuity, and governance controls form one connected Business Operating System."
      />

      <DataLifecycleMap
        tone="trust"
        title="Business information moves through a controlled operating lifecycle."
        description="From collection and validation through processing, audit, retention, review, export, and eligible removal, each stage remains connected to tenant scope, operational purpose, and accountable administration."
      />

      <DataClassificationMatrix tone="trust" />

      <TenantBoundaryMap
        tone="trust"
        title="Every organization operates within an independently governed tenant boundary."
        description="Shared platform services support the ShopCore ecosystem, while user access, operational records, subscriptions, permissions, audit context, devices, and administrative responsibility remain tenant-scoped."
      />

      <IdentityJourneyTimeline
        tone="trust"
        title="Access is governed throughout the complete identity lifecycle."
        description="ShopCore evaluates identity, authentication, tenant association, permission scope, device posture, module access, session monitoring, audit visibility, and revocation as connected controls."
      />

      <PublicSection
        eyebrow="Customer authority"
        title="Organizations retain practical control over their operating environment."
        description="Available controls depend on the customer's subscription, enabled modules, administrative role, contractual arrangement, technical capability, and applicable legal obligations."
      >
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm dark:bg-slate-900">
          {customerControls.map((control, index) => (
            <div
              key={control.title}
              className={[
                "grid gap-3 px-5 py-5 md:grid-cols-[0.42fr_1.58fr] md:items-start",
                index > 0 ? "border-t border-border" : "",
              ].join(" ")}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[10px] font-black text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <h3 className="text-sm font-black text-slate-950 dark:text-slate-100">
                  {control.title}
                </h3>
              </div>

              <p className="text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                {control.detail}
              </p>
            </div>
          ))}
        </div>
      </PublicSection>

      <ComplianceFramework
        tone="trust"
        title="A governance foundation designed for accountable business operations."
        description="ShopCore is being developed around tenant isolation, identity control, operational traceability, secure administration, responsible support, resilient synchronization, and regional fiscal readiness where correctly configured."
      />

      <EnterpriseFAQ
        tone="trust"
        title="Privacy and data-governance questions"
        description="Practical guidance for business owners, administrators, implementation teams, employees, and platform operators using ShopCore."
        items={privacyFAQ}
      />

      <SecurityResponseCenter
        tone="trust"
        title="Privacy, security, and operational response"
        description="A structured reporting and escalation framework for suspected unauthorized access, tenant-data concerns, compromised devices, support-access risks, synchronization incidents, and critical operational disruption."
      />
    </PublicExperienceLayout>
  );
}