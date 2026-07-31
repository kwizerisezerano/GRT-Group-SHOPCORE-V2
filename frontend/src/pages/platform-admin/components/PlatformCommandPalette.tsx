import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  CircleDollarSign,
  CreditCard,
  Flag,
  Gauge,
  Handshake,
  HardDrive,
  Headphones,
  KeyRound,
  Layers3,
  LifeBuoy,
  Lock,
  MonitorCog,
  ReceiptText,
  Search,
  Server,
  Settings,
  ShieldCheck,
  ToggleLeft,
  UserCog,
  Users,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type PlatformCommand = {
  label: string;
  path: string;
  icon: typeof Gauge;
  group: string;
  keywords?: string[];
};

const commands: PlatformCommand[] = [
  {
    label: "Dashboard",
    path: "/platform-admin",
    icon: Gauge,
    group: "Overview",
    keywords: ["home", "overview", "platform"],
  },

  {
    label: "Revenue Intelligence",
    path: "/platform-admin/revenue-intelligence",
    icon: BarChart3,
    group: "Commercial",
    keywords: ["revenue", "sales", "income", "commercial"],
  },
  {
    label: "Sales Enquiries",
    path: "/platform-admin/sales-inquiries",
    icon: Handshake,
    group: "Commercial",
    keywords: [
      "contact sales",
      "leads",
      "prospects",
      "opportunities",
      "pipeline",
      "customers",
    ],
  },
  {
    label: "Tenants",
    path: "/platform-admin/tenants",
    icon: Building2,
    group: "Commercial",
    keywords: ["organizations", "workspaces", "customers"],
  },
  {
    label: "Subscriptions",
    path: "/platform-admin/subscriptions",
    icon: WalletCards,
    group: "Commercial",
    keywords: ["plans", "renewals", "billing"],
  },
  {
    label: "Invoices",
    path: "/platform-admin/invoices",
    icon: ReceiptText,
    group: "Commercial",
    keywords: ["billing", "charges", "receivables"],
  },
  {
    label: "Payments",
    path: "/platform-admin/payments",
    icon: CreditCard,
    group: "Commercial",
    keywords: ["transactions", "collections", "billing"],
  },
  {
    label: "Payment Attempts",
    path: "/platform-admin/payment-attempts",
    icon: CircleDollarSign,
    group: "Commercial",
    keywords: ["failed payments", "retry", "collections"],
  },
  {
    label: "Trial Management",
    path: "/platform-admin/trials",
    icon: Flag,
    group: "Commercial",
    keywords: ["trial", "activation", "conversion"],
  },
  {
    label: "Plans",
    path: "/platform-admin/plans",
    icon: Layers3,
    group: "Commercial",
    keywords: ["pricing", "packages", "entitlements"],
  },

  {
    label: "Support Center",
    path: "/platform-admin/support",
    icon: LifeBuoy,
    group: "Customer Success",
    keywords: ["tickets", "cases", "help"],
  },
  {
    label: "Active Support",
    path: "/platform-admin/active-support",
    icon: Headphones,
    group: "Customer Success",
    keywords: ["impersonation", "support sessions", "tenant access"],
  },
  {
    label: "Workspace Requests",
    path: "/platform-admin/workspaces",
    icon: Building2,
    group: "Customer Success",
    keywords: ["provisioning", "workspace", "requests"],
  },

  {
    label: "Platform Users",
    path: "/platform-admin/users",
    icon: Users,
    group: "Identity & Security",
    keywords: ["admins", "accounts", "operators"],
  },
  {
    label: "Roles",
    path: "/platform-admin/roles",
    icon: UserCog,
    group: "Identity & Security",
    keywords: ["access", "authorization", "role management"],
  },
  {
    label: "Permissions",
    path: "/platform-admin/permissions",
    icon: KeyRound,
    group: "Identity & Security",
    keywords: ["access control", "authorization", "privileges"],
  },
  {
    label: "Audit Logs",
    path: "/platform-admin/audit",
    icon: ShieldCheck,
    group: "Identity & Security",
    keywords: ["activity", "history", "security"],
  },
  {
    label: "Login Sessions",
    path: "/platform-admin/sessions",
    icon: Lock,
    group: "Identity & Security",
    keywords: ["authentication", "devices", "sessions"],
  },

  {
    label: "Automation Engine",
    path: "/platform-admin/automation",
    icon: Zap,
    group: "Operations",
    keywords: ["workflows", "rules", "jobs"],
  },
  {
    label: "Monitoring",
    path: "/platform-admin/monitoring",
    icon: MonitorCog,
    group: "Operations",
    keywords: ["health", "alerts", "availability"],
  },
  {
    label: "Infrastructure",
    path: "/platform-admin/infrastructure",
    icon: Server,
    group: "Operations",
    keywords: ["servers", "services", "cloud"],
  },
  {
    label: "Storage",
    path: "/platform-admin/storage",
    icon: HardDrive,
    group: "Operations",
    keywords: ["files", "capacity", "usage"],
  },
  {
    label: "Analytics",
    path: "/platform-admin/analytics",
    icon: BarChart3,
    group: "Operations",
    keywords: ["metrics", "insights", "reports"],
  },

  {
    label: "Notifications",
    path: "/platform-admin/notifications",
    icon: Bell,
    group: "Platform",
    keywords: ["alerts", "messages", "announcements"],
  },
  {
    label: "Feature Flags",
    path: "/platform-admin/features",
    icon: ToggleLeft,
    group: "Platform",
    keywords: ["features", "modules", "rollout"],
  },
  {
    label: "Platform Settings",
    path: "/platform-admin/settings",
    icon: Settings,
    group: "Platform",
    keywords: ["configuration", "preferences", "system"],
  },
];

export default function PlatformCommandPalette() {
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const isCommand = event.ctrlKey || event.metaKey;

      if (isCommand && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }

      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };

    window.addEventListener("keydown", handleShortcut);

    return () => {
      window.removeEventListener("keydown", handleShortcut);
    };
  }, []);

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return commands;
    }

    return commands.filter((command) => {
      const searchableText = [
        command.label,
        command.group,
        command.path,
        ...(command.keywords ?? []),
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [query]);

  const closePalette = () => {
    setOpen(false);
    setQuery("");
  };

  const runCommand = (path: string) => {
    navigate(path);
    closePalette();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] bg-slate-950/50 px-4 py-12 backdrop-blur-sm sm:py-20"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closePalette();
        }
      }}
    >
      <div className="mx-auto max-w-2xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_30px_90px_-40px_rgba(15,23,42,0.8)]">
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
          <Search className="h-5 w-5 shrink-0 text-slate-400" />

          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages, operations, tenants, sales, support..."
            className="h-11 min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-950 outline-none placeholder:text-slate-400"
          />

          <span className="hidden rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 sm:inline-flex">
            Esc
          </span>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0 rounded-xl border-slate-200"
            onClick={closePalette}
            aria-label="Close command palette"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-[520px] overflow-y-auto p-3">
          {results.length === 0 ? (
            <div className="py-14 text-center">
              <Search className="mx-auto h-7 w-7 text-slate-300" />

              <p className="mt-4 text-sm font-black text-slate-700">
                No matching command
              </p>

              <p className="mt-1 text-xs font-medium text-slate-500">
                Try searching for sales, tenant, billing, support, security, or
                monitoring.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((command) => {
                const Icon = command.icon;

                return (
                  <button
                    key={command.path}
                    type="button"
                    onClick={() => runCommand(command.path)}
                    className="group flex w-full items-center justify-between gap-4 rounded-2xl px-4 py-3 text-left transition hover:bg-blue-50"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700 transition group-hover:border-blue-200 group-hover:bg-blue-100">
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-950">
                          {command.label}
                        </p>

                        <p className="mt-1 text-xs font-bold text-slate-500">
                          {command.group}
                        </p>
                      </div>
                    </div>

                    <span className="hidden max-w-[220px] truncate text-xs font-bold text-slate-400 md:block">
                      {command.path}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
            {results.length} command{results.length === 1 ? "" : "s"}
          </p>

          <p className="text-[10px] font-bold text-slate-400">
            Ctrl / ⌘ + K
          </p>
        </div>
      </div>
    </div>
  );
}