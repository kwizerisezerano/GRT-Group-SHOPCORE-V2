import { useState } from "react";
import {
  ChevronDown,
  FileCheck2,
  Headphones,
  LockKeyhole,
  Scale,
  ShieldCheck,
} from "lucide-react";

type FAQTone = "trust" | "legal" | "success";

type FAQItem = {
  question: string;
  answer: string;
};

type EnterpriseFAQProps = {
  tone?: FAQTone;
  title?: string;
  description?: string;
  items?: FAQItem[];
};

const toneStyles = {
  trust: {
    accent: "text-blue-700 dark:text-blue-200",
    chip: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
    icon: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
    darkIcon: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-300/20 dark:bg-blue-300/10 dark:text-blue-200",
    panel: "from-blue-50 to-slate-100 dark:from-[#111827] dark:via-[#0B1220] dark:to-[#050816]",
    iconComponent: ShieldCheck,
  },
  legal: {
    accent: "text-blue-700 dark:text-blue-200",
    chip: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
    icon: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
    darkIcon: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-300/20 dark:bg-blue-300/10 dark:text-blue-200",
    panel: "from-blue-50 to-slate-100 dark:from-[#111827] dark:via-[#0B1220] dark:to-[#050816]",
    iconComponent: Scale,
  },
  success: {
    accent: "text-blue-700 dark:text-blue-200",
    chip: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
    icon: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
    darkIcon:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-300/20 dark:bg-blue-300/10 dark:text-blue-200",
    panel: "from-blue-50 to-slate-100 dark:from-[#111827] dark:via-[#0B1220] dark:to-[#050816]",
    iconComponent: Headphones,
  },
};

const defaultItems: FAQItem[] = [
  {
    question: "Who controls business data inside ShopCore?",
    answer:
      "Tenant owners and authorized administrators control users, roles, permissions, module access, workspace settings, subscriptions, billing responsibility, devices, support access, and operational records inside their organization.",
  },
  {
    question: "Does ShopCore sell tenant or customer information?",
    answer:
      "No. ShopCore is designed as a business operating platform, not an advertising network. Information is processed to operate, secure, maintain, support, and improve the platform.",
  },
  {
    question: "How is tenant separation handled?",
    answer:
      "Every organization operates inside its own tenant context. Workspace membership, tenant scope, roles, permissions, support access, subscriptions, and operational records are governed independently.",
  },
  {
    question: "How are offline workflows protected?",
    answer:
      "Offline operations use cached access, local queues, validation checks, pending-record controls, synchronization recovery, and device responsibility to preserve continuity without removing governance.",
  },
  {
    question: "Can support teams access a customer workspace?",
    answer:
      "Sensitive support should use authorized, temporary, limited, and auditable support access. Customers should avoid password sharing or uncontrolled access grants.",
  },
  {
    question: "Are AI-assisted outputs automatically applied?",
    answer:
      "No. AI-assisted recommendations, purchase proposals, stock suggestions, summaries, and operational insights should be reviewed and approved by an authorized user before affecting business records.",
  },
];

export default function EnterpriseFAQ({
  tone = "trust",
  title = "Frequently asked questions",
  description = "Clear answers for business owners, administrators, employees, implementation teams, and platform operators.",
  items = defaultItems,
}: EnterpriseFAQProps) {
  const style = toneStyles[tone];
  const HeaderIcon = style.iconComponent;
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="border-b border-border bg-muted px-5 py-10 sm:px-6 lg:py-14 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.68fr_1.32fr] lg:items-start">
          <div>
            <p
              className={[
                "text-xs font-black uppercase tracking-[0.22em]",
                style.accent,
              ].join(" ")}
            >
              Information center
            </p>

            <h2 className="mt-4 max-w-3xl text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              {title}
            </h2>

            <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
              {description}
            </p>

            <div className="mt-7 rounded-2xl border border-border bg-card p-5 shadow-sm dark:border-white/10 dark:bg-slate-800">
              <div className="flex gap-3">
                <div
                  className={[
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                    style.icon,
                  ].join(" ")}
                >
                  <HeaderIcon className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-sm font-black text-slate-950 dark:text-white">
                    Enterprise guidance
                  </p>
                  <p className="mt-1 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                    These answers explain the platform operating model. They do
                    not replace professional legal, accounting, tax, regulatory,
                    or security advice.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                {
                  icon: ShieldCheck,
                  label: "Governance",
                },
                {
                  icon: LockKeyhole,
                  label: "Security",
                },
                {
                  icon: FileCheck2,
                  label: "Audit",
                },
                {
                  icon: Headphones,
                  label: "Support",
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="rounded-xl border border-border bg-card px-4 py-3 dark:border-white/10 dark:bg-slate-800"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={["h-4 w-4", style.accent].join(" ")} />
                      <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
                        {item.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className={[
              "relative overflow-hidden rounded-[26px] bg-gradient-to-br p-5 text-slate-950 dark:text-white shadow-sm",
              style.panel,
            ].join(" ")}
          >
            <div className="absolute -right-28 -top-28 h-72 w-72 rounded-full bg-white/10 blur-3xl dark:bg-white/10" />
            <div className="absolute -bottom-28 left-10 h-72 w-72 rounded-full bg-blue-300/10 blur-3xl dark:bg-blue-300/10" />

            <div className="relative">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200/10 pb-5 dark:border-white/10">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-white/45">
                    ShopCore knowledge framework
                  </p>
                  <h3 className="mt-2 text-xl font-black text-slate-950 dark:text-white">
                    Answers for secure business operations
                  </h3>
                  <p className="mt-2 max-w-2xl text-xs font-medium leading-5 text-slate-600 dark:text-white/60">
                    Explore governance, privacy, access, support, offline
                    continuity, subscriptions, and platform responsibility.
                  </p>
                </div>

                <div
                  className={[
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
                    style.darkIcon,
                  ].join(" ")}
                >
                  <HeaderIcon className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {items.map((item, index) => {
                  const open = openIndex === index;

                  return (
                    <article
                      key={item.question}
                      className={[
                        "overflow-hidden rounded-2xl border transition",
                        open
                          ? "border-slate-200/20 bg-card dark:border-white/20 dark:bg-slate-800"
                          : "border-slate-200/10 bg-card dark:border-white/10 dark:bg-slate-800",
                      ].join(" ")}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenIndex((current) =>
                            current === index ? null : index,
                          )
                        }
                        className="flex w-full items-center justify-between gap-4 p-4 text-left"
                        aria-expanded={open}
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <span
                            className={[
                              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-[10px] font-black",
                              open
                                ? style.icon
                                : "border-slate-200/15 bg-slate-100/10 text-slate-500 dark:border-white/15 dark:bg-white/10 dark:text-white/65",
                            ].join(" ")}
                          >
                            {String(index + 1).padStart(2, "0")}
                          </span>

                          <span
                            className={[
                              "text-sm font-black leading-6",
                              open ? "text-slate-950 dark:text-white" : "text-slate-950 dark:text-white",
                            ].join(" ")}
                          >
                            {item.question}
                          </span>
                        </div>

                        <ChevronDown
                          className={[
                            "h-5 w-5 shrink-0 transition-transform duration-200",
                            open
                              ? `${style.accent} rotate-180`
                              : "text-slate-400 dark:text-white/45",
                          ].join(" ")}
                        />
                      </button>

                      {open ? (
                        <div className="border-t border-border px-4 pb-5 pt-4 dark:border-slate-700">
                          <p className="pl-11 text-sm font-medium leading-7 text-slate-600 dark:text-slate-400">
                            {item.answer}
                          </p>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200/10 bg-card p-4 text-slate-950 dark:border-white/10 dark:bg-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-400">
                      Need more detail?
                    </p>
                    <p className="mt-1 text-sm font-black text-slate-950 dark:text-white">
                      Use the relevant Trust, Legal, or Success channel.
                    </p>
                  </div>

                  <span
                    className={[
                      "rounded-full border px-3 py-1 text-xs font-black",
                      style.chip,
                    ].join(" ")}
                  >
                    Guidance available
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}