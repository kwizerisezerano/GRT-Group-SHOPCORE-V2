import { useEffect, type ElementType } from "react";
import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Flag,
  Gauge,
  Handshake,
  HardDrive,
  Headphones,
  Headset,
  Home,
  KeyRound,
  Layers3,
  LifeBuoy,
  Lock,
  ReceiptText,
  Server,
  Settings,
  ShieldCheck,
  ToggleLeft,
  UserCog,
  Users,
  WalletCards,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

type NavItem = {
  label: string;
  icon: ElementType;
  to: string;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const groups: NavGroup[] = [
  {
    title: "overview",
    items: [{ label: "dashboard", icon: Home, to: "/platform-admin" }],
  },
  {
    title: "commercial",
    items: [
      {
        label: "revenueIntelligence",
        icon: BarChart3,
        to: "/platform-admin/revenue-intelligence",
      },
      {
        label: "salesEnquiries",
        icon: Handshake,
        to: "/platform-admin/sales-inquiries",
      },
      {
        label: "tenants",
        icon: Building2,
        to: "/platform-admin/tenants",
      },
      {
        label: "subscriptions",
        icon: WalletCards,
        to: "/platform-admin/subscriptions",
      },
      {
        label: "invoices",
        icon: ReceiptText,
        to: "/platform-admin/invoices",
      },
      {
        label: "payments",
        icon: CreditCard,
        to: "/platform-admin/payments",
      },
      {
        label: "paymentAttempts",
        icon: CircleDollarSign,
        to: "/platform-admin/payment-attempts",
      },
      {
        label: "trialManagement",
        icon: Flag,
        to: "/platform-admin/trials",
      },
      {
        label: "plans",
        icon: Layers3,
        to: "/platform-admin/plans",
      },
    ],
  },
  {
    title: "customerSuccess",
    items: [
      {
        label: "supportCenter",
        icon: Headset,
        to: "/platform-admin/support",
      },
      {
        label: "activeSupport",
        icon: Headphones,
        to: "/platform-admin/active-support",
      },
      {
        label: "workspaceRequests",
        icon: LifeBuoy,
        to: "/platform-admin/workspaces",
      },
    ],
  },
  {
    title: "identitySecurity",
    items: [
      {
        label: "platformUsers",
        icon: Users,
        to: "/platform-admin/users",
      },
      {
        label: "roles",
        icon: UserCog,
        to: "/platform-admin/roles",
      },
      {
        label: "permissions",
        icon: KeyRound,
        to: "/platform-admin/permissions",
      },
      {
        label: "auditLogs",
        icon: ShieldCheck,
        to: "/platform-admin/audit",
      },
      {
        label: "loginSessions",
        icon: Lock,
        to: "/platform-admin/sessions",
      },
    ],
  },
  {
    title: "operations",
    items: [
      {
        label: "automationEngine",
        icon: Zap,
        to: "/platform-admin/automation",
      },
      {
        label: "monitoring",
        icon: Activity,
        to: "/platform-admin/monitoring",
      },
      {
        label: "infrastructure",
        icon: Server,
        to: "/platform-admin/infrastructure",
      },
      {
        label: "storage",
        icon: HardDrive,
        to: "/platform-admin/storage",
      },
      {
        label: "analytics",
        icon: BarChart3,
        to: "/platform-admin/analytics",
      },
    ],
  },
  {
    title: "platform",
    items: [
      {
        label: "notifications",
        icon: Bell,
        to: "/platform-admin/notifications",
      },
      {
        label: "featureFlags",
        icon: ToggleLeft,
        to: "/platform-admin/features",
      },
      {
        label: "platformSettings",
        icon: Settings,
        to: "/platform-admin/settings",
      },
    ],
  },
];

const translations = {
  en: {
    groups: {
      overview: "Overview",
      commercial: "Commercial",
      customerSuccess: "Customer Success",
      identitySecurity: "Identity & Security",
      operations: "Operations",
      platform: "Platform",
    },
    items: {
      dashboard: "Dashboard",
      revenueIntelligence: "Revenue Intelligence",
      salesEnquiries: "Sales Enquiries",
      tenants: "Tenants",
      subscriptions: "Subscriptions",
      invoices: "Invoices",
      payments: "Payments",
      paymentAttempts: "Payment Attempts",
      trialManagement: "Trial Management",
      plans: "Plans",
      supportCenter: "Support Center",
      activeSupport: "Active Support",
      workspaceRequests: "Workspace Requests",
      platformUsers: "Platform Users",
      roles: "Roles",
      permissions: "Permissions",
      auditLogs: "Audit Logs",
      loginSessions: "Login Sessions",
      automationEngine: "Automation Engine",
      monitoring: "Monitoring",
      infrastructure: "Infrastructure",
      storage: "Storage",
      analytics: "Analytics",
      notifications: "Notifications",
      featureFlags: "Feature Flags",
      platformSettings: "Platform Settings",
    },
    adminPortal: "ShopCore Admin Portal",
    platformHealth: "Platform Health",
    operational: "All services operational",
  },
  fr: {
    groups: {
      overview: "Vue d’ensemble",
      commercial: "Commercial",
      customerSuccess: "Réussite client",
      identitySecurity: "Identité et sécurité",
      operations: "Opérations",
      platform: "Plateforme",
    },
    items: {
      dashboard: "Tableau de bord",
      revenueIntelligence: "Analyse des revenus",
      salesEnquiries: "Demandes commerciales",
      tenants: "Entreprises clientes",
      subscriptions: "Abonnements",
      invoices: "Factures",
      payments: "Paiements",
      paymentAttempts: "Tentatives de paiement",
      trialManagement: "Gestion des essais",
      plans: "Forfaits",
      supportCenter: "Centre d’assistance",
      activeSupport: "Assistance active",
      workspaceRequests: "Demandes d’espace de travail",
      platformUsers: "Utilisateurs de la plateforme",
      roles: "Rôles",
      permissions: "Autorisations",
      auditLogs: "Journaux d’audit",
      loginSessions: "Sessions de connexion",
      automationEngine: "Moteur d’automatisation",
      monitoring: "Supervision",
      infrastructure: "Infrastructure",
      storage: "Stockage",
      analytics: "Analyses",
      notifications: "Notifications",
      featureFlags: "Fonctionnalités contrôlées",
      platformSettings: "Paramètres de la plateforme",
    },
    adminPortal: "Portail d’administration ShopCore",
    platformHealth: "État de la plateforme",
    operational: "Tous les services sont opérationnels",
  },
  rw: {
    groups: {
      overview: "Incamake",
      commercial: "Ubucuruzi",
      customerSuccess: "Serivisi y’abakiriya",
      identitySecurity: "Imyirondoro n’umutekano",
      operations: "Imikorere",
      platform: "Platform",
    },
    items: {
      dashboard: "Imbonerahamwe",
      revenueIntelligence: "Isesengura ry’amafaranga yinjira",
      salesEnquiries: "Ibyifuzo by’ubucuruzi",
      tenants: "Ibigo bikoresha sisitemu",
      subscriptions: "Amafatabuguzi",
      invoices: "Inyemezabuguzi",
      payments: "Ubwishyu",
      paymentAttempts: "Kugerageza kwishyura",
      trialManagement: "Imicungire y’igerageza",
      plans: "Paki",
      supportCenter: "Ikigo cy’ubufasha",
      activeSupport: "Ubufasha burimo gukorwa",
      workspaceRequests: "Ibyifuzo by’ahakorerwa",
      platformUsers: "Abakoresha platform",
      roles: "Inshingano",
      permissions: "Uburenganzira",
      auditLogs: "Amakuru y’igenzura",
      loginSessions: "Ibihe byo kwinjira",
      automationEngine: "Sisitemu y’automatisation",
      monitoring: "Gukurikirana",
      infrastructure: "Ibikorwa remezo",
      storage: "Ububiko",
      analytics: "Isesengura",
      notifications: "Amatangazo",
      featureFlags: "Igenzura ry’imikorere",
      platformSettings: "Igenamiterere rya platform",
    },
    adminPortal: "ShopCore Admin Portal",
    platformHealth: "Imiterere ya platform",
    operational: "Serivisi zose zirakora",
  },
} as const;

export default function PlatformSidebar() {
  const { language } = useLanguage();
  const copy = translations[language];

  const notificationsQ = useQuery({
    queryKey: ["platform-unread-notifications-count"],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("platform_notifications")
        .select("id", { count: "exact", head: true })
        .eq("status", "unread");

      if (error) throw error;

      return count ?? 0;
    },
    refetchInterval: 30_000,
  });

  const salesInquiriesQ = useQuery({
    queryKey: ["platform-open-sales-inquiries-count"],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("sales_inquiries")
        .select("id", { count: "exact", head: true })
        .in("status", ["new", "reviewing"]);

      if (error) throw error;

      return count ?? 0;
    },
    refetchInterval: 30_000,
  });

  const activeSupportQ = useQuery({
    queryKey: ["platform-active-support-count"],
    queryFn: async () => {
      await (supabase as any).rpc(
        "expire_platform_impersonation_sessions",
      );

      const { count, error } = await (supabase as any)
        .from("platform_active_support_sessions")
        .select("id", { count: "exact", head: true });

      if (error) throw error;

      return count ?? 0;
    },
    refetchInterval: 30_000,
  });

  const workspaceRequestsQ = useQuery({
    queryKey: ["platform-open-workspace-requests-count"],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("platform_workspace_requests")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "in_review"]);

      if (error) throw error;

      return count ?? 0;
    },
    refetchInterval: 30_000,
  });

  const loginSessionsQ = useQuery({
    queryKey: ["platform-active-login-sessions-count"],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("platform_login_sessions")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");

      if (error) throw error;

      return count ?? 0;
    },
    refetchInterval: 30_000,
  });

  const unreadCount = notificationsQ.data ?? 0;
  const salesInquiriesCount = salesInquiriesQ.data ?? 0;
  const activeSupportCount = activeSupportQ.data ?? 0;
  const workspaceRequestsCount = workspaceRequestsQ.data ?? 0;
  const loginSessionsCount = loginSessionsQ.data ?? 0;

  useEffect(() => {
    const channel = supabase
      .channel("platform-sidebar-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "platform_notifications",
        },
        () => {
          void notificationsQ.refetch();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales_inquiries",
        },
        () => {
          void salesInquiriesQ.refetch();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "platform_impersonation_sessions",
        },
        () => {
          void activeSupportQ.refetch();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "platform_workspace_requests",
        },
        () => {
          void workspaceRequestsQ.refetch();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "platform_login_sessions",
        },
        () => {
          void loginSessionsQ.refetch();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [
    activeSupportQ,
    loginSessionsQ,
    notificationsQ,
    salesInquiriesQ,
    workspaceRequestsQ,
  ]);

  const getBadgeCount = (path: string) => {
    if (path === "/platform-admin/notifications") {
      return unreadCount;
    }

    if (path === "/platform-admin/sales-inquiries") {
      return salesInquiriesCount;
    }

    if (path === "/platform-admin/active-support") {
      return activeSupportCount;
    }

    if (path === "/platform-admin/workspaces") {
      return workspaceRequestsCount;
    }

    if (path === "/platform-admin/sessions") {
      return loginSessionsCount;
    }

    return 0;
  };

  return (
    <aside className="flex h-screen w-[300px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-6 py-6">
        <div className="flex items-center gap-4">
          <img
            src="/shopcore-icon.png"
            alt="ShopCore"
            className="h-12 w-12 object-contain"
          />

          <div>
            <h2 className="text-lg font-black tracking-tight text-sidebar-primary">
              ShopCore Cloud
            </h2>

            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
              {copy.adminPortal}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="space-y-8">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="mb-3 px-3 text-[10px] font-black uppercase tracking-[0.22em] text-sidebar-muted">
                {copy.groups[group.title as keyof typeof copy.groups]}
              </p>

              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const badgeCount = getBadgeCount(item.to);
                  const showBadge = badgeCount > 0;

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/platform-admin"}
                      className={({ isActive }) =>
                        [
                          "group flex items-center justify-between rounded-xl px-3 py-3 transition-all",
                          isActive
                            ? "bg-blue-600 text-sidebar-accent-foreground shadow-lg shadow-blue-950/30"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        ].join(" ")
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className={[
                                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                                isActive
                                  ? "bg-white/15"
                                  : "bg-sidebar-accent/60 group-hover:bg-sidebar-accent",
                              ].join(" ")}
                            >
                              <Icon className="h-5 w-5" />
                            </div>

                            <span className="truncate text-sm font-bold">
                              {copy.items[item.label as keyof typeof copy.items]}
                            </span>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            {showBadge ? (
                              <span
                                className={[
                                  "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-black text-sidebar-accent-foreground",
                                  item.to ===
                                  "/platform-admin/sales-inquiries"
                                    ? "bg-orange-500"
                                    : "bg-rose-600",
                                ].join(" ")}
                              >
                                {badgeCount > 99 ? "99+" : badgeCount}
                              </span>
                            ) : null}

                            <ChevronRight
                              className={[
                                "h-4 w-4 transition-all",
                                isActive
                                  ? "translate-x-0 opacity-100"
                                  : "translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100",
                              ].join(" ")}
                            />
                          </div>
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-sidebar-border p-5">
        <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/60 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600">
              <Gauge className="h-5 w-5" />
            </div>

            <div>
              <p className="text-sm font-black">
                {copy.platformHealth}
              </p>
              <p className="text-xs font-medium text-emerald-300">
                {copy.operational}
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}