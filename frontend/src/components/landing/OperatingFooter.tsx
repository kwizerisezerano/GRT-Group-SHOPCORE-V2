import { Link } from "react-router-dom";
import {
  BarChart3,
  Building2,
  CloudCog,
  Database,
  FileCheck2,
  Headphones,
  LockKeyhole,
  Package,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Warehouse,
} from "lucide-react";
import { useLandingExperience } from "@/contexts/LandingExperienceContext";

type Tone = "blue" | "emerald" | "cyan" | "violet";

type FooterLink = {
  label: string;
  href?: string;
  to?: string;
};

const footerSections: Array<{
  title: string;
  links: FooterLink[];
}> = [
  {
    title: "Product",
    links: [
      { label: "POS Workspace", href: "#modules" },
      { label: "Inventory Control", href: "#modules" },
      { label: "Warehouse Operations", href: "#modules" },
      { label: "Procurement", href: "#modules" },
      { label: "Reports & Analytics", href: "#modules" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Retail Stores", href: "#workspace" },
      { label: "Supermarkets", href: "#workspace" },
      { label: "Wholesale & Distribution", href: "#workspace" },
      { label: "Pharmacies", href: "#workspace" },
      { label: "Multi-branch Operations", href: "#workspace" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Support Center", to: "/support-center" },
      { label: "Implementation Guidance", to: "/support-center" },
      { label: "Offline Operations", href: "#offline" },
      { label: "Desktop Deployment", href: "#offline" },
      { label: "EBM Readiness", href: "#ebm" },
    ],
  },
  {
    title: "Trust & Legal",
    links: [
      { label: "Privacy & Data Governance", to: "/privacy" },
      { label: "Terms of Service", to: "/terms" },
      { label: "Security", href: "#security" },
      { label: "Compliance Readiness", to: "/privacy" },
      { label: "Secure Support", to: "/support-center" },
    ],
  },
  {
    title: "Get Started",
    links: [
      { label: "View Pricing", href: "#pricing" },
      { label: "Contact Sales", to: "/contact-sales" },
      { label: "Sign In", to: "/auth" },
      { label: "Create Workspace", to: "/auth" },
    ],
  },
];

const systemBadges = [
  { id: "pos", label: "POS", icon: ShoppingCart },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "warehouse", label: "Warehouse", icon: Warehouse },
  { id: "analytics", label: "Reports", icon: BarChart3 },
  { id: "offline", label: "Offline", icon: Database },
  { id: "ebm", label: "EBM", icon: ReceiptText },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "branches", label: "Branches", icon: Building2 },
];

const trustHighlights: Array<{
  label: string;
  detail: string;
  icon: typeof ShieldCheck;
  tone: Tone;
}> = [
  {
    label: "Tenant isolation",
    detail: "Every organization operates within its own governed workspace.",
    icon: Building2,
    tone: "cyan",
  },
  {
    label: "Role-based access",
    detail: "Users access only the modules and actions assigned to them.",
    icon: LockKeyhole,
    tone: "violet",
  },
  {
    label: "Offline continuity",
    detail: "Business workflows continue through controlled local operation.",
    icon: CloudCog,
    tone: "blue",
  },
  {
    label: "Audit visibility",
    detail: "Sensitive activity remains available for review and accountability.",
    icon: FileCheck2,
    tone: "emerald",
  },
];


function FooterItem({ link }: { link: FooterLink }) {
  const className =
    "block text-sm font-medium leading-6 text-muted-foreground transition hover:text-foreground";

  if (link.to) {
    return (
      <Link to={link.to} className={className}>
        {link.label}
      </Link>
    );
  }

  return (
    <a href={link.href ?? "/"} className={className}>
      {link.label}
    </a>
  );
}

export default function OperatingFooter() {
  const {
    selectedModule,
    demoMode,
    branchHealth,
  } = useLandingExperience();

  return (
    <footer className="border-t border-border bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-6">
        <div className="grid gap-10 border-b border-border pb-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <Link to="/" className="inline-flex items-center gap-3">
              <img
                src="/shopcore-icon.png"
                alt="ShopCore"
                className="h-12 w-12 object-contain"
              />

              <div>
                <p className="text-xl font-black tracking-tight text-slate-900 dark:!text-blue-100">
                  ShopCore
                </p>

                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Enterprise Business Operating System
                </p>
              </div>
            </Link>

            <p className="mt-5 max-w-xl text-sm font-medium leading-7 text-muted-foreground">
              One connected operating platform for point of sale, inventory,
              procurement, warehouses, customers, reporting, offline
              continuity, fiscal workflows, and multi-branch business
              operations.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {systemBadges.map((item) => {
                const Icon = item.icon;

                const active =
                  item.id === selectedModule ||
                  (item.id === "branches" && branchHealth.length > 0);

                return (
                  <span
                    key={item.label}
                    className={[
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition",
                      active
                        ? "border-border bg-muted text-foreground"
                        : "border-border bg-muted/[0.04] text-muted-foreground",
                    ].join(" ")}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </span>
                );
              })}
            </div>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-bold text-foreground">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              {demoMode
                ? "Interactive product experience active"
                : "Product experience ready"}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {trustHighlights.map((item) => {
              const Icon = item.icon;

              return (
                <article
                  key={item.label}
                  className="rounded-2xl border border-border bg-muted/[0.04] p-5"
                >
                  <div
                    className={[
                      "flex h-10 w-10 items-center justify-center text-foreground",
                    ].join(" ")}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <h2 className="mt-4 text-sm font-black text-foreground">
                    {item.label}
                  </h2>

                  <p className="mt-2 text-xs font-medium leading-5 text-muted-foreground">
                    {item.detail}
                  </p>
                </article>
              );
            })}
          </div>
        </div>

        <div className="grid gap-8 py-12 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {footerSections.map((section) => (
            <div key={section.title}>
              <h2 className="text-sm font-black text-foreground">
                {section.title}
              </h2>

              <div className="mt-4 space-y-3">
                {section.links.map((link) => (
                  <FooterItem key={link.label} link={link} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-[24px] border border-border bg-muted/[0.04] p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Headphones className="h-5 w-5 text-blue-600 dark:text-blue-200" />

                <p className="text-sm font-black text-foreground">
                  Need help choosing the right ShopCore setup?
                </p>
              </div>

              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-muted-foreground">
                Review implementation readiness, deployment requirements,
                secure support practices, desktop operation, and business
                continuity guidance in the ShopCore Success Center.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/support-center"
                className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-500"
              >
                Visit Success Center
              </Link>

              <Link
  to="/contact-sales"
  className="rounded-full border border-border bg-muted/50 px-5 py-2.5 text-sm font-bold text-slate-900 dark:!text-blue-100 transition hover:bg-muted"
>
  Contact Sales
</Link>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-border pt-6 text-xs font-medium text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} ShopCore. All rights reserved.
          </p>

          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/privacy" className="transition hover:text-foreground">
              Privacy
            </Link>

            <Link to="/terms" className="transition hover:text-foreground">
              Terms
            </Link>

            <Link
              to="/support-center"
              className="transition hover:text-foreground"
            >
              Support
            </Link>

            <a href="#security" className="transition hover:text-foreground">
              Security
            </a>

            <Link to="/auth" className="transition hover:text-foreground">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}