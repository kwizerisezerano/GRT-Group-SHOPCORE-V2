import {
  Activity,
  AppWindow,
  BadgeCheck,
  BarChart3,
  Building2,
  CreditCard,
  Gauge,
  Headphones,
  MessageSquareText,
  MonitorSmartphone,
  PieChart,
  Server,
  ShieldCheck,
  Users,
  Webhook,
  Zap,
} from "lucide-react";
import type { Tenant360TabKey } from "./Tenant360Types";

export const tenant360Tabs: {
  key: Tenant360TabKey;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    key: "overview",
    label: "Overview",
    icon: <Gauge className="h-4 w-4" />,
  },
  {
    key: "workspace",
    label: "Workspace",
    icon: <Building2 className="h-4 w-4" />,
  },
  {
    key: "people",
    label: "People",
    icon: <Users className="h-4 w-4" />,
  },
  {
    key: "security",
    label: "Security",
    icon: <ShieldCheck className="h-4 w-4" />,
  },
  {
    key: "applications",
    label: "Applications",
    icon: <AppWindow className="h-4 w-4" />,
  },
  {
    key: "infrastructure",
    label: "Infrastructure",
    icon: <Server className="h-4 w-4" />,
  },
  {
    key: "billing",
    label: "Billing",
    icon: <CreditCard className="h-4 w-4" />,
  },
  {
    key: "support",
    label: "Support",
    icon: <Headphones className="h-4 w-4" />,
  },
  {
    key: "analytics",
    label: "Analytics",
    icon: <BarChart3 className="h-4 w-4" />,
  },
  {
    key: "usage",
    label: "Usage",
    icon: <PieChart className="h-4 w-4" />,
  },
  {
    key: "licenses",
    label: "Licenses",
    icon: <BadgeCheck className="h-4 w-4" />,
  },
  {
    key: "devices",
    label: "Devices",
    icon: <MonitorSmartphone className="h-4 w-4" />,
  },
  {
    key: "audit",
    label: "Audit",
    icon: <Activity className="h-4 w-4" />,
  },
  {
    key: "automation",
    label: "Automation",
    icon: <Zap className="h-4 w-4" />,
  },
  {
    key: "developer",
    label: "Developer",
    icon: <Webhook className="h-4 w-4" />,
  },
  {
    key: "notes",
    label: "Notes",
    icon: <MessageSquareText className="h-4 w-4" />,
  },
];

type Props = {
  activeTab: Tenant360TabKey;
  onChange: (tab: Tenant360TabKey) => void;
};

export function Tenant360Tabs({ activeTab, onChange }: Props) {
  return (
    <div className="border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex gap-2 overflow-x-auto">
        {tenant360Tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={[
              "flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-[0.1em] transition-all duration-200",
              activeTab === tab.key
                ? "bg-blue-700 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            ].join(" ")}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}