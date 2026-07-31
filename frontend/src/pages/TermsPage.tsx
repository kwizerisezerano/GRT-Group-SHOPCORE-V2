import {
  Activity,
  Banknote,
  Building2,
  CloudCog,
  FileCheck2,
  KeyRound,
  LockKeyhole,
  ReceiptText,
  Scale,
  ShieldCheck,
  UserCheck,
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

const legalPrinciples = [
  {
    icon: Building2,
    title: "Tenant accountability",
    text: "Each organization remains responsible for its workspace, users, permissions, business records, tax configuration, billing obligations, regulatory duties, and internal operating approvals.",
  },
  {
    icon: ShieldCheck,
    title: "Authorized business use",
    text: "ShopCore is provided for legitimate business operations. It must not be used to compromise accounts, tenants, payment activity, infrastructure, subscriptions, records, or another organization’s workspace.",
  },
  {
    icon: KeyRound,
    title: "Identity responsibility",
    text: "Users and administrators are responsible for protecting credentials, devices, offline access, desktop sessions, API credentials, support sessions, and delegated administrative authority.",
  },
  {
    icon: Banknote,
    title: "Commercial responsibility",
    text: "Trials, plans, invoices, payments, payment attempts, licenses, module entitlements, renewals, and subscription changes remain subject to the selected plan and applicable commercial agreement.",
  },
];

const coveredServices = [
  {
    title: "Public and authentication services",
    detail:
      "The ShopCore website, account registration, sign-in, tenant activation, onboarding, invitations, and workspace access.",
  },
  {
    title: "Business operating modules",
    detail:
      "POS, sales, purchases, inventory, customers, suppliers, expenses, staff, loyalty, reporting, settings, and collaboration.",
  },
  {
    title: "Desktop and offline services",
    detail:
      "Desktop installation, cached authentication, local operational records, synchronization queues, recovery, and conflict handling.",
  },
  {
    title: "Platform administration",
    detail:
      "Tenant management, subscriptions, billing, support access, devices, monitoring, audit, roles, permissions, and automation.",
  },
  {
    title: "Commercial services",
    detail:
      "Trials, subscriptions, invoices, payments, payment attempts, licenses, module entitlements, and workspace provisioning.",
  },
  {
    title: "Operational intelligence",
    detail:
      "AI-assisted proposals, summaries, purchase recommendations, stock suggestions, administrative guidance, and business insights.",
  },
];

const customerResponsibilities = [
  {
    title: "Access governance",
    detail:
      "Assign roles, permissions, administrative privileges, and module access only to authorized personnel.",
  },
  {
    title: "Record verification",
    detail:
      "Review sales, inventory, purchasing, tax, billing, reporting, and AI-assisted outputs before relying on or approving them.",
  },
  {
    title: "Legal compliance",
    detail:
      "Maintain applicable accounting, tax, labor, privacy, fiscal, regulatory, licensing, and industry-specific compliance.",
  },
  {
    title: "Fiscal configuration",
    detail:
      "Use Rwanda EBM/VSDC functionality only where properly configured, certified, authorized, tested, and operationally verified.",
  },
  {
    title: "Security protection",
    detail:
      "Protect credentials, devices, offline sessions, API keys, webhooks, exports, support access, and administrator accounts.",
  },
  {
    title: "Incident reporting",
    detail:
      "Report suspicious sessions, unauthorized access, payment concerns, device compromise, data issues, or support-access misuse promptly.",
  },
];

const prohibitedActivities = [
  {
    title: "Unauthorized access",
    detail:
      "Attempting to enter another account, tenant, workspace, device, database, support session, API, or restricted platform function.",
  },
  {
    title: "Fraudulent records",
    detail:
      "Creating deceptive transactions, false invoices, manipulated tax records, misleading reports, payment abuse, or inaccurate business entries.",
  },
  {
    title: "Infrastructure abuse",
    detail:
      "Misusing APIs, webhooks, storage, realtime services, edge functions, synchronization services, or platform infrastructure.",
  },
  {
    title: "Malicious content",
    detail:
      "Uploading unlawful, harmful, infringing, deceptive, malicious, security-compromising, or operationally disruptive material.",
  },
  {
    title: "Control circumvention",
    detail:
      "Bypassing subscription limits, licensing rules, payment obligations, role controls, tenant boundaries, or activation requirements.",
  },
  {
    title: "Unreviewed professional reliance",
    detail:
      "Treating platform or AI-assisted outputs as final legal, tax, accounting, financial, medical, regulatory, or professional advice.",
  },
];

const commercialTerms = [
  {
    icon: Banknote,
    title: "Subscription access",
    text: "Workspace access, modules, users, storage, licenses, support levels, and usage allowances may depend on the active subscription.",
  },
  {
    icon: ReceiptText,
    title: "Invoices and payments",
    text: "Charges, invoices, payment attempts, taxes, credits, and renewal activity are governed by the selected plan or commercial agreement.",
  },
  {
    icon: FileCheck2,
    title: "Plan changes",
    text: "Upgrades, downgrades, renewals, suspensions, cancellations, and entitlement changes may affect available features and workspace access.",
  },
  {
    icon: LockKeyhole,
    title: "Non-payment controls",
    text: "Where permitted by the agreement, overdue balances may result in reminders, restricted functionality, suspension, or termination.",
  },
];

const platformCommitments = [
  {
    title: "Service evolution",
    detail:
      "Modules, workflows, interfaces, infrastructure, and administrative capabilities may change as ShopCore improves.",
  },
  {
    title: "Security maintenance",
    detail:
      "ShopCore may apply security patches, access-control changes, infrastructure updates, and operational protections.",
  },
  {
    title: "Availability management",
    detail:
      "Maintenance, incidents, third-party dependencies, connectivity, or customer configuration may affect service availability.",
  },
  {
    title: "Desktop and synchronization updates",
    detail:
      "Desktop releases, cached access rules, synchronization logic, queue validation, and recovery behavior may be revised.",
  },
  {
    title: "Commercial updates",
    detail:
      "Plans, pricing, entitlements, license allocation, support levels, and usage limits may be updated with appropriate notice where required.",
  },
  {
    title: "Responsible intelligence",
    detail:
      "AI-assisted capabilities may be adjusted, restricted, improved, or withdrawn to protect quality, safety, and operational accountability.",
  },
];

const agreementStages = [
  {
    title: "Account creation",
    detail:
      "A user registers, receives an invitation, or is provisioned for a legitimate organizational role.",
  },
  {
    title: "Tenant activation",
    detail:
      "The organization completes onboarding, configuration, trial, subscription, billing, or administrative activation.",
  },
  {
    title: "Workspace operation",
    detail:
      "Authorized users operate approved modules, records, workflows, reports, devices, and collaboration tools.",
  },
  {
    title: "Ongoing governance",
    detail:
      "The tenant maintains access controls, record accuracy, payment obligations, legal compliance, and operational oversight.",
  },
  {
    title: "Change or renewal",
    detail:
      "Plans, licenses, modules, commercial terms, or operating requirements may change during the service relationship.",
  },
  {
    title: "Suspension or termination",
    detail:
      "Access may end through cancellation, expiry, non-payment, security action, breach, or another permitted contractual event.",
  },
];

const legalFAQ = [
  {
    question: "Who is authorized to accept these terms for an organization?",
    answer:
      "A person creating, activating, purchasing, administering, or accepting an invitation for a workspace must have authority to act for themselves or the relevant organization.",
  },
  {
    question: "Do these terms apply to desktop and offline operation?",
    answer:
      "Yes. They apply to web access, desktop applications, cached authentication, locally stored operational records, offline queues, synchronization, and recovery workflows.",
  },
  {
    question: "Who is responsible for tax and regulatory compliance?",
    answer:
      "The customer remains responsible for determining and meeting applicable tax, accounting, labor, privacy, licensing, fiscal, retention, and industry-specific obligations.",
  },
  {
    question: "Does EBM/VSDC availability guarantee regulatory compliance?",
    answer:
      "No. Customers remain responsible for certification, correct configuration, approved use, accurate fiscal information, connectivity, testing, and compliance with the applicable RRA requirements.",
  },
  {
    question: "Are AI-assisted outputs legally binding or automatically applied?",
    answer:
      "No. AI-assisted outputs are advisory unless an authorized user reviews and approves them through an applicable workflow. Users remain responsible for final decisions and records.",
  },
  {
    question: "Can ShopCore change or discontinue platform features?",
    answer:
      "ShopCore may improve, replace, restrict, retire, or modify services to address security, quality, legal, commercial, technical, or operational requirements, subject to applicable agreements.",
  },
  {
    question: "What happens when a subscription expires or is cancelled?",
    answer:
      "Access, modules, licenses, support, data availability, and export options may be limited according to the subscription, applicable agreement, retention rules, payment status, and technical capability.",
  },
  {
    question: "Can an account be suspended for security reasons?",
    answer:
      "Yes. Access may be restricted or suspended where necessary to protect users, tenants, payments, records, infrastructure, or the integrity of the platform.",
  },
];

export default function TermsPage() {
  return (
    <PublicExperienceLayout
      center="legal"
      eyebrow="ShopCore Legal Center"
      title="Operating terms for organizations using the ShopCore Business Operating System."
      description="These terms define the responsibilities, acceptable-use requirements, commercial conditions, access rules, operational limitations, and governance expectations that apply across ShopCore cloud, desktop, offline, support, billing, and Platform Admin services."
    >
      <PublicSection
        eyebrow="Legal operating principles"
        title="Clear responsibilities support secure, dependable business operations."
        description="Every organization using ShopCore should understand how authority, access, record accuracy, commercial obligations, regulatory responsibility, and platform use are governed."
      >
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {legalPrinciples.map((principle) => (
            <PublicCard
              key={principle.title}
              icon={principle.icon}
              title={principle.title}
              text={principle.text}
              tone="violet"
            />
          ))}
        </div>
      </PublicSection>

      <EnterpriseBlueprintCanvas
        tone="legal"
        title="The legal operating model governs the full lifecycle of every ShopCore workspace."
        description="From account creation and tenant activation through subscriptions, workspace operation, support access, offline execution, AI-assisted workflows, and termination, every stage carries defined responsibilities."
      />

      <PublicSection
        eyebrow="Service scope"
        title="The agreement applies across the complete ShopCore operating environment."
        description="The applicable terms cover public services, authentication, tenant workspaces, ERP modules, Platform Admin, desktop applications, offline operation, billing, support, and operational intelligence."
      >
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          {coveredServices.map((service, index) => (
            <div
              key={service.title}
              className={[
                "grid gap-3 px-5 py-5 md:grid-cols-[0.42fr_1.58fr]",
                index > 0 ? "border-t border-slate-200 dark:border-slate-600" : "",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[10px] font-black text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <h3 className="text-sm font-black text-slate-950 dark:text-white">
                  {service.title}
                </h3>
              </div>

              <p className="text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                {service.detail}
              </p>
            </div>
          ))}
        </div>
      </PublicSection>

      <PublicSection
        eyebrow="Customer responsibilities"
        title="Organizations remain accountable for how ShopCore is configured and operated."
        description="ShopCore provides business infrastructure and operating tools. Customers remain responsible for authorized access, record quality, business decisions, device security, regulatory compliance, and internal approval."
      >
        <div className="grid gap-5 md:grid-cols-2">
          {customerResponsibilities.map((responsibility, index) => (
            <article
              key={responsibility.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-xs font-black text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                  {index + 1}
                </span>

                <div>
                  <h3 className="text-base font-black text-slate-950 dark:text-white">
                    {responsibility.title}
                  </h3>
                  <p className="mt-2 text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                    {responsibility.detail}
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
              Acceptable use
            </p>

            <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              Platform access must not compromise another user, tenant, record,
              transaction, or service.
            </h2>

            <p className="mt-4 text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
              Prohibited activity includes unauthorized access, fraudulent
              records, infrastructure abuse, malicious content, control
              circumvention, and irresponsible reliance on unverified outputs.
            </p>

            <div className="mt-7 rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-800 dark:bg-blue-900/30">
              <div className="flex gap-3">
                <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-blue-700 dark:text-blue-200" />
                <p className="text-sm font-semibold leading-7 text-blue-950 dark:text-blue-100">
                  ShopCore may investigate, restrict, suspend, or terminate
                  activity reasonably believed to threaten platform integrity,
                  another tenant, payment security, or lawful business operation.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {prohibitedActivities.map((item, index) => (
              <article
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-[#f4f6f9] p-5 dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="flex items-center justify-between">
                  <LockKeyhole className="h-5 w-5 text-blue-700 dark:text-blue-200" />
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    Rule {String(index + 1).padStart(2, "0")}
                  </span>
                </div>

                <h3 className="mt-4 text-sm font-black text-slate-950 dark:text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
                  {item.detail}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <PublicSection
        eyebrow="Subscriptions and billing"
        title="Commercial access follows the active plan and applicable agreement."
        description="Available workspaces, modules, users, licenses, support levels, storage, and operational entitlements may change with the subscription lifecycle."
      >
        <div className="grid gap-5 md:grid-cols-2">
          {commercialTerms.map((item) => (
            <PublicCard
              key={item.title}
              icon={item.icon}
              title={item.title}
              text={item.text}
              tone="violet"
            />
          ))}
        </div>
      </PublicSection>

      <PublicSection
        eyebrow="Platform changes"
        title="ShopCore may evolve to maintain security, reliability, and enterprise readiness."
        description="The platform may be updated in response to customer needs, technical requirements, legal obligations, security risks, commercial changes, and improvements to operational quality."
      >
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          {platformCommitments.map((commitment, index) => (
            <div
              key={commitment.title}
              className={[
                "grid gap-3 px-5 py-5 md:grid-cols-[0.42fr_1.58fr]",
                index > 0 ? "border-t border-slate-200 dark:border-slate-600" : "",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <CloudCog className="mt-0.5 h-5 w-5 shrink-0 text-blue-700 dark:text-blue-200" />
                <h3 className="text-sm font-black text-slate-950 dark:text-white">
                  {commitment.title}
                </h3>
              </div>

              <p className="text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                {commitment.detail}
              </p>
            </div>
          ))}
        </div>
      </PublicSection>

      <section className="border-b border-slate-200 bg-[#f4f6f9] px-5 py-10 sm:px-6 lg:py-14 dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-2">
          <article className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <ReceiptText className="h-7 w-7 text-blue-700 dark:text-blue-200" />

            <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Regulatory responsibility
            </p>

            <h2 className="mt-3 text-xl font-black text-slate-950 dark:text-white">
              Business compliance remains the customer’s responsibility.
            </h2>

            <p className="mt-4 text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
              Customers remain responsible for applicable tax, invoicing,
              accounting, labor, privacy, retention, fiscal, licensing, and
              industry obligations. Rwanda EBM/VSDC use also requires correct
              certification, configuration, testing, and fiscal operation.
            </p>
          </article>

          <article className="rounded-[24px] bg-gradient-to-br from-blue-50 to-slate-100 p-6 text-slate-950 shadow-sm dark:from-[#1F1B2E] dark:via-[#161B26] dark:to-[#090B12] dark:text-white">
            <Activity className="h-7 w-7 text-blue-700 dark:text-blue-300" />

            <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-white/45">
              Operational intelligence
            </p>

            <h2 className="mt-3 text-xl font-black text-slate-950 dark:text-white">
              AI-assisted workflows require human review and approval.
            </h2>

            <p className="mt-4 text-sm font-medium leading-7 text-slate-600 dark:text-white/65">
              Purchase proposals, stock suggestions, summaries, reports, and
              operational recommendations are advisory. Authorized users must
              verify accuracy and suitability before applying them to business
              records, transactions, compliance decisions, or customer activity.
            </p>
          </article>
        </div>
      </section>

      <IdentityJourneyTimeline
        tone="legal"
        title="The agreement follows the user and access lifecycle."
        description="Authority, authentication, tenant membership, role permissions, device posture, module access, session monitoring, audit visibility, and revocation remain relevant throughout platform use."
      />

      <PublicSection
        eyebrow="Agreement lifecycle"
        title="Terms apply from first access through operation, renewal, and termination."
        description="The relationship changes as users register, tenants activate, subscriptions evolve, modules are operated, and access is eventually renewed, suspended, cancelled, or terminated."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agreementStages.map((stage, index) => (
            <article
              key={stage.title}
              className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-700 dark:text-blue-200">
                Stage {String(index + 1).padStart(2, "0")}
              </span>

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

      <ComplianceFramework
        tone="legal"
        title="A legal-governance foundation for accountable platform use."
        description="ShopCore is developed around documented responsibility, controlled access, subscription governance, operational traceability, tenant administration, support accountability, and secure service evolution."
      />

      <EnterpriseFAQ
        tone="legal"
        title="Terms, subscriptions, and operating-responsibility questions"
        description="Clear guidance for business owners, tenant administrators, employees, implementation teams, and platform operators."
        items={legalFAQ}
      />

      <SecurityResponseCenter
        tone="legal"
        title="Legal, access, and service-response center"
        description="A structured path for reporting suspected misuse, account compromise, payment disputes, unauthorized access, contractual concerns, platform abuse, and serious operational incidents."
      />
    </PublicExperienceLayout>
  );
}