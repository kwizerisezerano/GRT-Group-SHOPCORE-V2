import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Command,
  HelpCircle,
  LogOut,
  Search,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

type PlatformTopbarCopy = {
  portal: string;
  searchPlaceholder: string;
  command: string;
  notifications: string;
  help: string;
  operational: string;
  platformOwner: string;
  signOut: string;
  pages: Record<string, string>;
};

const topbarTranslations: Record<
  "en" | "fr" | "rw",
  PlatformTopbarCopy
> = {
  en: {
    portal: "ShopCore Admin Portal",
    searchPlaceholder:
      "Search tenants, payments, users, invoices...",
    command: "Command",
    notifications: "Notifications",
    help: "Help",
    operational: "Operational",
    platformOwner: "Platform Owner",
    signOut: "Sign out",
    pages: {
      dashboard: "Dashboard",
      settings: "Platform Settings",
      features: "Feature Flags",
      monitoring: "Monitoring",
      audit: "Audit Logs",
      users: "Platform Users",
      trials: "Trial Management",
      tenants: "Tenants",
      payments: "Payments",
      plans: "Subscription Plans",
      support: "Support Center",
      "active-support": "Active Support",
      invoices: "Invoices",
      "payment-attempts": "Payment Attempts",
      "revenue-intelligence": "Revenue Intelligence",
      automation: "Automation Engine",
      subscriptions: "Subscriptions",
      notifications: "Notifications",
      workspaces: "Workspace Requests",
      roles: "Roles",
      permissions: "Permissions",
      sessions: "Login Sessions",
      infrastructure: "Infrastructure",
      storage: "Storage",
      analytics: "Analytics",
      "sales-inquiries": "Sales Enquiries",
    },
  },
  fr: {
    portal: "Portail d’administration ShopCore",
    searchPlaceholder:
      "Rechercher des entreprises, paiements, utilisateurs, factures...",
    command: "Commande",
    notifications: "Notifications",
    help: "Aide",
    operational: "Opérationnel",
    platformOwner: "Propriétaire de la plateforme",
    signOut: "Se déconnecter",
    pages: {
      dashboard: "Tableau de bord",
      settings: "Paramètres de la plateforme",
      features: "Fonctionnalités contrôlées",
      monitoring: "Supervision",
      audit: "Journaux d’audit",
      users: "Utilisateurs de la plateforme",
      trials: "Gestion des essais",
      tenants: "Entreprises clientes",
      payments: "Paiements",
      plans: "Forfaits d’abonnement",
      support: "Centre d’assistance",
      "active-support": "Assistance active",
      invoices: "Factures",
      "payment-attempts": "Tentatives de paiement",
      "revenue-intelligence": "Analyse des revenus",
      automation: "Moteur d’automatisation",
      subscriptions: "Abonnements",
      notifications: "Notifications",
      workspaces: "Demandes d’espace de travail",
      roles: "Rôles",
      permissions: "Autorisations",
      sessions: "Sessions de connexion",
      infrastructure: "Infrastructure",
      storage: "Stockage",
      analytics: "Analyses",
      "sales-inquiries": "Demandes commerciales",
    },
  },
  rw: {
    portal: "ShopCore Admin Portal",
    searchPlaceholder:
      "Shakisha ibigo, ubwishyu, abakoresha n’inyemezabuguzi...",
    command: "Amabwiriza",
    notifications: "Amatangazo",
    help: "Ubufasha",
    operational: "Birakora",
    platformOwner: "Nyir’urubuga rwa platform",
    signOut: "Sohoka",
    pages: {
      dashboard: "Imbonerahamwe",
      settings: "Igenamiterere rya platform",
      features: "Igenzura ry’imikorere",
      monitoring: "Gukurikirana",
      audit: "Amakuru y’igenzura",
      users: "Abakoresha platform",
      trials: "Imicungire y’igerageza",
      tenants: "Ibigo bikoresha sisitemu",
      payments: "Ubwishyu",
      plans: "Paki z’ifatabuguzi",
      support: "Ikigo cy’ubufasha",
      "active-support": "Ubufasha burimo gukorwa",
      invoices: "Inyemezabuguzi",
      "payment-attempts": "Kugerageza kwishyura",
      "revenue-intelligence": "Isesengura ry’amafaranga yinjira",
      automation: "Sisitemu y’automatisation",
      subscriptions: "Amafatabuguzi",
      notifications: "Amatangazo",
      workspaces: "Ibyifuzo by’ahakorerwa",
      roles: "Inshingano",
      permissions: "Uburenganzira",
      sessions: "Ibihe byo kwinjira",
      infrastructure: "Ibikorwa remezo",
      storage: "Ububiko",
      analytics: "Isesengura",
      "sales-inquiries": "Ibyifuzo by’ubucuruzi",
    },
  },
};

function resolvePageTitle(
  pathname: string,
  copy: PlatformTopbarCopy,
) {
  const segment = pathname
    .split("/")
    .filter(Boolean)
    .pop();

  if (!segment || segment === "platform-admin") {
    return copy.pages.dashboard;
  }

  return (
    copy.pages[segment] ||
    segment
      .replace(/-/g, " ")
      .replace(/\b\w/g, (character) =>
        character.toUpperCase(),
      )
  );
}

export default function PlatformTopbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { language } = useLanguage();

  const copy = topbarTranslations[language];

  const notificationsQ = useQuery({
    queryKey: [
      "platform-unread-notifications-count",
    ],
    queryFn: async () => {
      const { count, error } = await (
        supabase as any
      )
        .from("platform_notifications")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("status", "unread");

      if (error) throw error;

      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  const unreadCount =
    notificationsQ.data ?? 0;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 text-card-foreground backdrop-blur">
      <div className="flex h-20 items-center justify-between gap-6 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-6">
          <div className="min-w-0">
            <p className="truncate text-xs font-black uppercase tracking-[0.18em] text-primary">
              {copy.portal}
            </p>

            <h1 className="mt-1 truncate text-xl font-black tracking-tight text-foreground">
              {resolvePageTitle(
                location.pathname,
                copy,
              )}
            </h1>
          </div>

          <div className="hidden min-h-11 w-[520px] items-center gap-3 rounded-2xl border border-border bg-muted/40 px-4 xl:flex">
            <Search className="h-4 w-4 text-muted-foreground" />

            <input
              className="w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
              placeholder={
                copy.searchPlaceholder
              }
            />

            <div className="rounded-lg border border-border bg-card px-2 py-1 text-[10px] font-black text-muted-foreground">
              Ctrl K
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="outline"
            className="hidden rounded-2xl border-border bg-card font-black text-foreground hover:bg-muted lg:inline-flex"
          >
            <Command className="mr-2 h-4 w-4" />
            {copy.command}
          </Button>

          <Button
            variant="outline"
            size="icon"
            aria-label={copy.notifications}
            title={copy.notifications}
            className="relative rounded-2xl border-border bg-card text-foreground hover:bg-muted"
            onClick={() =>
              navigate(
                "/platform-admin/notifications",
              )
            }
          >
            <Bell className="h-4 w-4" />

            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[10px] font-black text-white">
                {unreadCount > 99
                  ? "99+"
                  : unreadCount}
              </span>
            ) : null}
          </Button>

          <Button
            variant="outline"
            size="icon"
            aria-label={copy.help}
            title={copy.help}
            className="rounded-2xl border-border bg-card text-foreground hover:bg-muted"
            onClick={() =>
              navigate(
                "/platform-admin/support",
              )
            }
          >
            <HelpCircle className="h-4 w-4" />
          </Button>

          <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300 lg:flex">
            <Zap className="h-3.5 w-3.5" />
            {copy.operational}
          </div>

          <div className="hidden rounded-2xl border border-border bg-muted/40 px-4 py-2 md:block">
            <p className="max-w-52 truncate text-xs font-black text-foreground">
              {user?.email}
            </p>

            <p className="mt-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              <ShieldCheck className="h-3 w-3" />
              {copy.platformOwner}
            </p>
          </div>

          <Button
            variant="outline"
            aria-label={copy.signOut}
            title={copy.signOut}
            className="rounded-2xl border-border bg-card font-black text-foreground hover:bg-muted"
            onClick={async () => {
              await signOut();
              navigate("/auth", {
                replace: true,
              });
            }}
          >
            <LogOut className="h-4 w-4 sm:mr-2" />

            <span className="hidden sm:inline">
              {copy.signOut}
            </span>
          </Button>
        </div>
      </div>
    </header>
  );
}