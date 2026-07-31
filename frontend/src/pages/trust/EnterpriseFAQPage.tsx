import EnterpriseFAQ from "@/components/public-experience/EnterpriseFAQ";
import { PublicExperienceLayout } from "@/components/public-experience/PublicExperienceLayout";

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

export default function EnterpriseFAQPage() {
  return (
    <PublicExperienceLayout
      center="trust"
      eyebrow="FAQ"
      title="Privacy and data-governance questions"
      description="Practical guidance for business owners, administrators, implementation teams, employees, and platform operators using ShopCore."
    >
      <EnterpriseFAQ
        tone="trust"
        title="Privacy and data-governance questions"
        description="Practical guidance for business owners, administrators, implementation teams, employees, and platform operators using ShopCore."
        items={privacyFAQ}
      />
    </PublicExperienceLayout>
  );
}
