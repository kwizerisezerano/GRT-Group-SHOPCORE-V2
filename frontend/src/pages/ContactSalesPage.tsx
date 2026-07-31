import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  CloudCog,
  Database,
  Globe2,
  Headphones,
  Laptop,
  Mail,
  MapPin,
  MessageSquare,
  Network,
  Package,
  Phone,
  ReceiptText,
  Send,
  ShieldCheck,
  ShoppingCart,
  Store,
  UsersRound,
  Warehouse,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

type DeploymentModel =
  | "cloud"
  | "desktop"
  | "hybrid"
  | "multi-branch"
  | "multi-company";

type ContactFormState = {
  companyName: string;
  contactName: string;
  workEmail: string;
  phone: string;
  country: string;
  city: string;
  industry: string;
  currentSoftware: string;
  employees: string;
  branches: string;
  warehouses: string;
  monthlyTransactions: string;
  preferredTimeline: string;
  deploymentModel: DeploymentModel;
  modules: string[];
  requiresOffline: boolean;
  requiresDesktop: boolean;
  requiresEbm: boolean;
  requiresMigration: boolean;
  message: string;
  consent: boolean;
};

const initialForm: ContactFormState = {
  companyName: "",
  contactName: "",
  workEmail: "",
  phone: "",
  country: "Rwanda",
  city: "",
  industry: "",
  currentSoftware: "",
  employees: "",
  branches: "",
  warehouses: "",
  monthlyTransactions: "",
  preferredTimeline: "",
  deploymentModel: "cloud",
  modules: [],
  requiresOffline: false,
  requiresDesktop: false,
  requiresEbm: false,
  requiresMigration: false,
  message: "",
  consent: false,
};

const modules = [
  {
    id: "pos",
    label: "Point of Sale",
    icon: ShoppingCart,
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: Package,
  },
  {
    id: "warehouses",
    label: "Warehouses",
    icon: Warehouse,
  },
  {
    id: "procurement",
    label: "Procurement",
    icon: Network,
  },
  {
    id: "customers",
    label: "CRM & Customers",
    icon: UsersRound,
  },
  {
    id: "finance",
    label: "Finance & Billing",
    icon: ReceiptText,
  },
  {
    id: "analytics",
    label: "Reports & Analytics",
    icon: BarChart3,
  },
  {
    id: "workspace",
    label: "Team Workspace",
    icon: MessageSquare,
  },
];

const deploymentOptions: Array<{
  id: DeploymentModel;
  title: string;
  detail: string;
  icon: typeof CloudCog;
}> = [
  {
    id: "cloud",
    title: "Cloud",
    detail: "Browser-based centralized operation.",
    icon: CloudCog,
  },
  {
    id: "desktop",
    title: "Desktop",
    detail: "Windows workstations and local continuity.",
    icon: Laptop,
  },
  {
    id: "hybrid",
    title: "Hybrid",
    detail: "Cloud control with desktop and offline operation.",
    icon: Database,
  },
  {
    id: "multi-branch",
    title: "Multi-branch",
    detail: "Central governance across several locations.",
    icon: Store,
  },
  {
    id: "multi-company",
    title: "Multi-company",
    detail: "Several organizations under coordinated oversight.",
    icon: Building2,
  },
];

const salesCapabilities = [
  "Solution architecture consultation",
  "Implementation planning",
  "Data migration assessment",
  "Desktop and offline deployment",
  "Multi-branch rollout guidance",
  "User and role design",
  "Rwanda EBM/VSDC readiness",
  "Training and operational enablement",
];

const salesChannels = [
  {
    icon: Phone,
    title: "Enterprise sales",
    detail: "Discuss licensing, rollout scope, pricing, and commercial requirements.",
    value: "+250 786 485 989",
    href: "tel:+250786485989",
    tone: "border-blue-200 bg-blue-50 text-blue-700",
  },
  {
    icon: Mail,
    title: "Sales enquiries",
    detail: "Send your business profile, scope, and preferred deployment timeline.",
    value: "sales@shopcore.app",
    href: "mailto:sales@shopcore.app",
    tone: "border-violet-200 bg-violet-50 text-violet-700",
  },
  {
    icon: Headphones,
    title: "Implementation advisory",
    detail: "Prepare your branches, users, inventory, devices, and go-live plan.",
    value: "Success Center",
    to: "/support-center",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
];

const questions = [
  {
    question: "How long does implementation take?",
    answer:
      "The implementation period depends on organization size, branch count, data readiness, required modules, integrations, training, desktop deployment, and EBM preparation. A focused single-location rollout may be completed more quickly than a complex multi-branch deployment.",
  },
  {
    question: "Can ShopCore migrate information from another platform?",
    answer:
      "Migration can be assessed for products, customers, suppliers, opening stock, prices, users, and selected operational records. The exact scope depends on the source system, data quality, available exports, and validation requirements.",
  },
  {
    question: "Can ShopCore continue working without internet access?",
    answer:
      "ShopCore includes offline-first architecture for supported workflows, cached authentication, local operational queues, and controlled synchronization when connectivity returns.",
  },
  {
    question: "Does ShopCore support multiple branches and warehouses?",
    answer:
      "Yes. ShopCore is designed for multi-branch and multi-warehouse operations with centralized tenant governance, users, permissions, inventory visibility, and reporting.",
  },
  {
    question: "Can ShopCore integrate with Rwanda EBM/VSDC?",
    answer:
      "ShopCore is being prepared for Rwanda EBM/VSDC workflows. Deployment requires correct configuration, certification, testing, business registration information, and compliance with applicable RRA requirements.",
  },
  {
    question: "Is a Windows desktop application available?",
    answer:
      "Yes. ShopCore offers a fully featured native Windows desktop experience designed for speed, reliability, and business continuity. It provides effortless installation, secure local data storage, uninterrupted offline functionality, and seamless synchronization, ensuring your operations remain productive regardless of network availability.",
  },
];

function validateForm(form: ContactFormState) {
  if (!form.companyName.trim()) return "Enter your organization name.";
  if (!form.contactName.trim()) return "Enter the contact person’s name.";
  if (!form.workEmail.trim()) return "Enter a business email address.";
  if (!form.workEmail.includes("@")) return "Enter a valid email address.";
  if (!form.phone.trim()) return "Enter a telephone number.";
  if (!form.country.trim()) return "Select or enter a country.";
  if (!form.industry.trim()) return "Select your business type.";
  if (form.modules.length === 0) {
    return "Select at least one platform requirement.";
  }
  if (!form.message.trim()) {
    return "Describe your operations, challenges, or implementation needs.";
  }
  if (!form.consent) {
    return "Confirm that ShopCore may contact you about this enquiry.";
  }

  return null;
}

export default function ContactSalesPage() {
  const [form, setForm] = useState<ContactFormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [openQuestion, setOpenQuestion] = useState<number | null>(0);

  const selectedModuleNames = useMemo(
    () =>
      modules
        .filter((module) => form.modules.includes(module.id))
        .map((module) => module.label),
    [form.modules],
  );

  const updateField = <K extends keyof ContactFormState>(
    field: K,
    value: ContactFormState[K],
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const toggleModule = (moduleId: string) => {
    setForm((current) => ({
      ...current,
      modules: current.modules.includes(moduleId)
        ? current.modules.filter((item) => item !== moduleId)
        : [...current.modules, moduleId],
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationError = validateForm(form);

    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSubmitting(true);

    const payload = {
      company_name: form.companyName.trim(),
      contact_name: form.contactName.trim(),
      email: form.workEmail.trim().toLowerCase(),
      phone: form.phone.trim(),
      country: form.country.trim(),
      city: form.city.trim() || null,
      business_type: form.industry,
      current_software: form.currentSoftware.trim() || null,
      employee_count: form.employees
        ? Number.parseInt(form.employees, 10)
        : null,
      branch_count: form.branches
        ? Number.parseInt(form.branches, 10)
        : null,
      warehouse_count: form.warehouses
        ? Number.parseInt(form.warehouses, 10)
        : null,
      monthly_transactions: form.monthlyTransactions || null,
      preferred_timeline: form.preferredTimeline || null,
      deployment_model: form.deploymentModel,
      modules: selectedModuleNames,
      needs_offline: form.requiresOffline,
      needs_desktop: form.requiresDesktop,
      needs_ebm: form.requiresEbm,
      needs_migration: form.requiresMigration,
      message: form.message.trim(),
      consent_given: form.consent,
      source: "public_contact_sales",
      status: "new",
    };

    try {
      const { error } = await supabase
        .from("sales_inquiries" as never)
        .insert(payload as never);

      if (error) {
        throw error;
      }

      setSubmitted(true);
      setForm(initialForm);
      toast.success("Your sales enquiry has been submitted.");
    } catch (error) {
      console.error("Sales enquiry submission failed:", error);

      toast.error(
        "The enquiry could not be submitted. Please use the telephone or email contact shown on this page.",
        {
          duration: 9000,
        },
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f4f6f9] text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <img
              src="/shopcore-icon.png"
              alt="ShopCore"
              className="h-11 w-11 object-contain"
            />

            <div>
              <p className="text-lg font-black leading-tight">ShopCore</p>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Enterprise Business OS
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 sm:inline-flex"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </Link>

            <Link
              to="/auth"
              className="rounded-full bg-[#0B1220] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#111827]"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-14 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:py-20">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">
              <Building2 className="h-3.5 w-3.5" />
              ShopCore Enterprise Sales
            </div>

            <p className="mt-8 text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Plan your ShopCore deployment
            </p>

            <h1 className="mt-4 max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-[46px]">
              Build the right operating system for your business.
            </h1>

            <p className="mt-5 max-w-2xl text-base font-medium leading-8 text-slate-600">
              Speak with a ShopCore solution consultant about your branches,
              warehouses, users, current software, implementation timeline,
              desktop requirements, offline operation, data migration, and
              Rwanda EBM readiness.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {salesCapabilities.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-[#f4f6f9] px-4 py-3"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="text-sm font-bold text-slate-700">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#111827] via-[#0B1220] to-[#050816] p-6 text-white shadow-xl">
            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-blue-400/10 blur-3xl" />
            <div className="absolute -bottom-24 left-10 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl" />

            <div className="relative">
              <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                    Enterprise solution planning
                  </p>
                  <h2 className="mt-2 text-xl font-black">
                    From requirements to go-live
                  </h2>
                  <p className="mt-2 text-xs font-medium leading-5 text-white/60">
                    A structured deployment path for retail, distribution,
                    pharmacy, wholesale, and multi-branch operations.
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                  <Network className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {[
                  {
                    title: "Business assessment",
                    text: "Understand workflows, locations, users, data, devices, and commercial priorities.",
                  },
                  {
                    title: "Solution architecture",
                    text: "Select modules, deployment model, access controls, integrations, and operating structure.",
                  },
                  {
                    title: "Implementation plan",
                    text: "Prepare migration, configuration, validation, training, deployment, and support.",
                  },
                  {
                    title: "Operational rollout",
                    text: "Activate workspaces, branches, users, desktop applications, offline workflows, and reporting.",
                  },
                ].map((item, index) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-white/10 bg-white/10 p-4"
                  >
                    <div className="flex gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-xs font-black text-cyan-200">
                        {String(index + 1).padStart(2, "0")}
                      </span>

                      <div>
                        <p className="text-sm font-black">{item.title}</p>
                        <p className="mt-1 text-xs font-medium leading-5 text-white/55">
                          {item.text}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl bg-white p-4 text-slate-950">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                      Sales readiness
                    </p>
                    <p className="mt-1 text-sm font-black">
                      Enterprise consultation available
                    </p>
                  </div>

                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                    Ready
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-[#f4f6f9]">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:py-16">
          <div className="grid gap-10 lg:grid-cols-[1.28fr_0.72fr]">
            <form
              onSubmit={handleSubmit}
              className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
            >
              <div className="border-b border-slate-200 pb-6">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
                  Sales enquiry
                </p>
                <h2 className="mt-3 text-2xl font-black tracking-tight">
                  Tell us about your organization
                </h2>
                <p className="mt-3 text-sm font-medium leading-7 text-slate-600">
                  The information below helps ShopCore understand the required
                  modules, deployment model, implementation effort, and
                  commercial scope.
                </p>
              </div>

              <div className="mt-7 grid gap-5 md:grid-cols-2">
                <FormField
                  label="Organization name"
                  required
                  value={form.companyName}
                  onChange={(value) => updateField("companyName", value)}
                  placeholder="Example: KGTASTE Retail Inc"
                />

                <FormField
                  label="Contact person"
                  required
                  value={form.contactName}
                  onChange={(value) => updateField("contactName", value)}
                  placeholder="Full name"
                />

                <FormField
                  label="Business email"
                  required
                  type="email"
                  value={form.workEmail}
                  onChange={(value) => updateField("workEmail", value)}
                  placeholder="name@company.com"
                />

                <FormField
                  label="Telephone"
                  required
                  type="tel"
                  value={form.phone}
                  onChange={(value) => updateField("phone", value)}
                  placeholder="+250 ..."
                />

                <FormField
                  label="Country"
                  required
                  value={form.country}
                  onChange={(value) => updateField("country", value)}
                  placeholder="Country"
                />

                <FormField
                  label="City"
                  value={form.city}
                  onChange={(value) => updateField("city", value)}
                  placeholder="City or region"
                />

                <SelectField
                  label="Business type"
                  required
                  value={form.industry}
                  onChange={(value) => updateField("industry", value)}
                  options={[
                    ["", "Select business type"],
                    ["retail", "Retail store"],
                    ["supermarket", "Supermarket"],
                    ["wholesale", "Wholesale"],
                    ["distribution", "Distribution"],
                    ["pharmacy", "Pharmacy"],
                    ["hardware", "Hardware store"],
                    ["hospitality", "Hospitality"],
                    ["services", "Professional services"],
                    ["other", "Other"],
                  ]}
                />

                <FormField
                  label="Current software"
                  value={form.currentSoftware}
                  onChange={(value) => updateField("currentSoftware", value)}
                  placeholder="Odoo, spreadsheets, custom system..."
                />

                <FormField
                  label="Number of employees"
                  type="number"
                  min="0"
                  value={form.employees}
                  onChange={(value) => updateField("employees", value)}
                  placeholder="Example: 25"
                />

                <FormField
                  label="Number of branches"
                  type="number"
                  min="0"
                  value={form.branches}
                  onChange={(value) => updateField("branches", value)}
                  placeholder="Example: 3"
                />

                <FormField
                  label="Number of warehouses"
                  type="number"
                  min="0"
                  value={form.warehouses}
                  onChange={(value) => updateField("warehouses", value)}
                  placeholder="Example: 2"
                />

                <SelectField
                  label="Monthly transactions"
                  value={form.monthlyTransactions}
                  onChange={(value) =>
                    updateField("monthlyTransactions", value)
                  }
                  options={[
                    ["", "Select a range"],
                    ["under_1000", "Under 1,000"],
                    ["1000_5000", "1,000–5,000"],
                    ["5000_20000", "5,000–20,000"],
                    ["20000_100000", "20,000–100,000"],
                    ["over_100000", "More than 100,000"],
                  ]}
                />

                <SelectField
                  label="Preferred go-live timeline"
                  value={form.preferredTimeline}
                  onChange={(value) => updateField("preferredTimeline", value)}
                  options={[
                    ["", "Select a timeline"],
                    ["immediate", "As soon as possible"],
                    ["one_month", "Within one month"],
                    ["three_months", "Within three months"],
                    ["six_months", "Within six months"],
                    ["planning", "Still planning"],
                  ]}
                />
              </div>

              <div className="mt-8 border-t border-slate-200 pt-7">
                <p className="text-sm font-black">Required modules</p>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  Select every area included in your expected deployment.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {modules.map((module) => {
                    const Icon = module.icon;
                    const selected = form.modules.includes(module.id);

                    return (
                      <button
                        key={module.id}
                        type="button"
                        onClick={() => toggleModule(module.id)}
                        className={[
                          "rounded-2xl border p-4 text-left transition",
                          selected
                            ? "border-blue-300 bg-blue-50 text-blue-800"
                            : "border-slate-200 bg-[#f4f6f9] text-slate-700 hover:bg-white",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between">
                          <Icon className="h-5 w-5" />

                          <span
                            className={[
                              "flex h-5 w-5 items-center justify-center rounded-md border",
                              selected
                                ? "border-blue-600 bg-blue-600 text-white"
                                : "border-slate-300 bg-white text-transparent",
                            ].join(" ")}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        </div>

                        <p className="mt-3 text-xs font-black">
                          {module.label}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-8 border-t border-slate-200 pt-7">
                <p className="text-sm font-black">Deployment model</p>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {deploymentOptions.map((option) => {
                    const Icon = option.icon;
                    const selected = form.deploymentModel === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() =>
                          updateField("deploymentModel", option.id)
                        }
                        className={[
                          "rounded-2xl border p-4 text-left transition",
                          selected
                            ? "border-violet-300 bg-violet-50"
                            : "border-slate-200 bg-[#f4f6f9] hover:bg-white",
                        ].join(" ")}
                      >
                        <Icon
                          className={[
                            "h-5 w-5",
                            selected
                              ? "text-violet-700"
                              : "text-slate-500",
                          ].join(" ")}
                        />

                        <p className="mt-3 text-sm font-black">
                          {option.title}
                        </p>
                        <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
                          {option.detail}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <CheckboxField
                  label="Offline operation required"
                  checked={form.requiresOffline}
                  onChange={(checked) =>
                    updateField("requiresOffline", checked)
                  }
                />
                <CheckboxField
                  label="Windows desktop deployment required"
                  checked={form.requiresDesktop}
                  onChange={(checked) =>
                    updateField("requiresDesktop", checked)
                  }
                />
                <CheckboxField
                  label="Rwanda EBM/VSDC readiness required"
                  checked={form.requiresEbm}
                  onChange={(checked) => updateField("requiresEbm", checked)}
                />
                <CheckboxField
                  label="Existing data migration required"
                  checked={form.requiresMigration}
                  onChange={(checked) =>
                    updateField("requiresMigration", checked)
                  }
                />
              </div>

              <div className="mt-8">
                <label className="text-sm font-black text-slate-800">
                  Business requirements
                  <span className="ml-1 text-rose-600">*</span>
                </label>

                <textarea
                  value={form.message}
                  onChange={(event) =>
                    updateField("message", event.target.value)
                  }
                  rows={7}
                  placeholder="Describe your current operations, business challenges, existing software, expected modules, integrations, reporting needs, implementation priorities, and go-live expectations."
                  className="mt-2 w-full resize-y rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-[#f4f6f9] p-4">
                <input
                  type="checkbox"
                  checked={form.consent}
                  onChange={(event) =>
                    updateField("consent", event.target.checked)
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
                />

                <span className="text-xs font-medium leading-5 text-slate-600">
                  I confirm that the information provided is accurate and
                  authorize ShopCore to contact me about this enquiry,
                  implementation services, product information, and commercial
                  requirements. Review the{" "}
                  <Link
                    to="/privacy"
                    className="font-black text-blue-700 hover:underline"
                  >
                    Privacy Center
                  </Link>
                  .
                </span>
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0B1220] px-5 py-3.5 text-sm font-black text-white transition hover:bg-[#111827] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                <Send className="h-4 w-4" />
                {submitting ? "Submitting enquiry..." : "Submit sales enquiry"}
              </button>

              {submitted ? (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />

                    <div>
                      <p className="text-sm font-black text-emerald-950">
                        Enquiry submitted
                      </p>
                      <p className="mt-1 text-xs font-medium leading-5 text-emerald-800">
                        The ShopCore sales team can now review your deployment
                        requirements and contact details.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </form>

            <aside className="space-y-5">
              {salesChannels.map((channel) => {
                const Icon = channel.icon;

                const content = (
                  <article className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <div
                      className={[
                        "flex h-10 w-10 items-center justify-center rounded-xl border",
                        channel.tone,
                      ].join(" ")}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    <h3 className="mt-5 text-base font-black">
                      {channel.title}
                    </h3>

                    <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                      {channel.detail}
                    </p>

                    <p className="mt-4 inline-flex items-center gap-2 text-sm font-black text-slate-950">
                      {channel.value}
                      <ArrowRight className="h-4 w-4" />
                    </p>
                  </article>
                );

                if (channel.to) {
                  return (
                    <Link key={channel.title} to={channel.to}>
                      {content}
                    </Link>
                  );
                }

                return (
                  <a key={channel.title} href={channel.href}>
                    {content}
                  </a>
                );
              })}

              <div className="rounded-[22px] bg-gradient-to-br from-[#111827] via-[#0B1220] to-[#050816] p-6 text-white">
                <Globe2 className="h-7 w-7 text-cyan-300" />

                <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-white/45">
                  Regional availability
                </p>

                <h3 className="mt-3 text-xl font-black">
                  Kigali implementation and support
                </h3>

                <div className="mt-5 space-y-3">
                  <div className="flex gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                    <p className="text-sm font-medium leading-6 text-white/65">
                      Kigali, Rwanda
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                    <p className="text-sm font-medium leading-6 text-white/65">
                      +250 786 485 989
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                    <p className="text-sm font-medium leading-6 text-white/65">
                      sales@shopcore.app
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:py-16">
          <div className="grid gap-10 lg:grid-cols-[0.65fr_1.35fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-700">
                Sales questions
              </p>

              <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">
                Planning your ShopCore deployment
              </h2>

              <p className="mt-4 text-sm font-medium leading-7 text-slate-600">
                These answers explain common implementation, migration,
                desktop, offline, multi-branch, and fiscal-readiness
                considerations.
              </p>
            </div>

            <div className="space-y-3">
              {questions.map((item, index) => {
                const open = openQuestion === index;

                return (
                  <article
                    key={item.question}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-[#f4f6f9]"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setOpenQuestion((current) =>
                          current === index ? null : index,
                        )
                      }
                      className="flex w-full items-center justify-between gap-4 p-5 text-left"
                      aria-expanded={open}
                    >
                      <span className="text-sm font-black">
                        {item.question}
                      </span>

                      <ChevronDown
                        className={[
                          "h-5 w-5 shrink-0 text-slate-500 transition",
                          open ? "rotate-180" : "",
                        ].join(" ")}
                      />
                    </button>

                    {open ? (
                      <div className="border-t border-slate-200 bg-white px-5 py-5">
                        <p className="text-sm font-medium leading-7 text-slate-600">
                          {item.answer}
                        </p>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-[#050816] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img
              src="/shopcore-icon.png"
              alt="ShopCore"
              className="h-10 w-10 object-contain"
            />

            <div>
              <p className="font-black">ShopCore</p>
              <p className="text-xs font-semibold text-slate-400">
                Enterprise Business Operating System
              </p>
            </div>
          </Link>

          <div className="flex flex-wrap gap-4 text-sm font-bold text-slate-400">
            <Link to="/privacy" className="hover:text-white">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-white">
              Terms
            </Link>
            <Link to="/support-center" className="hover:text-white">
              Support
            </Link>
            <Link to="/auth" className="hover:text-white">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

type FormFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "tel" | "number";
  required?: boolean;
  min?: string;
};

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  min,
}: FormFieldProps) {
  return (
    <label>
      <span className="text-sm font-black text-slate-800">
        {label}
        {required ? <span className="ml-1 text-rose-600">*</span> : null}
      </span>

      <input
        type={type}
        min={min}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-4 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
      />
    </label>
  );
}

type SelectFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  required?: boolean;
};

function SelectField({
  label,
  value,
  onChange,
  options,
  required = false,
}: SelectFieldProps) {
  return (
    <label>
      <span className="text-sm font-black text-slate-800">
        {label}
        {required ? <span className="ml-1 text-rose-600">*</span> : null}
      </span>

      <select
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue || optionLabel} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

type CheckboxFieldProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function CheckboxField({
  label,
  checked,
  onChange,
}: CheckboxFieldProps) {
  return (
    <label
      className={[
        "flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 transition",
        checked
          ? "border-blue-300 bg-blue-50"
          : "border-slate-200 bg-[#f4f6f9]",
      ].join(" ")}
    >
      <span className="text-sm font-bold text-slate-700">{label}</span>

      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-blue-600"
      />
    </label>
  );
}