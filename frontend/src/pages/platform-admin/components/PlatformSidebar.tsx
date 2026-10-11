import { type ElementType } from "react";
import { NavLink } from "react-router-dom";
import {
  Building2,
  CircleDollarSign,
  ClipboardCheck,
  CreditCard,
  FileSignature,
  Home,
  Layers3,
  ReceiptText,
  Users,
  WalletCards,
} from "lucide-react";

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
      { label: "organizations", icon: Building2, to: "/platform-admin/organizations" },
      { label: "subscriptionPlans", icon: Layers3, to: "/platform-admin/subscription-plans" },
      { label: "contractTemplates", icon: FileSignature, to: "/platform-admin/contract-templates" },
      { label: "paymentGateway", icon: WalletCards, to: "/platform-admin/payment-gateway" },
      { label: "tenants", icon: Building2, to: "/platform-admin/tenants" },
      { label: "subscriptions", icon: WalletCards, to: "/platform-admin/subscriptions" },
      {
        label: "paymentApprovals",
        icon: ClipboardCheck,
        to: "/platform-admin/subscription-approvals",
      },
      { label: "invoices", icon: ReceiptText, to: "/platform-admin/invoices" },
      { label: "payments", icon: CreditCard, to: "/platform-admin/payments" },
      { label: "paymentAttempts", icon: CircleDollarSign, to: "/platform-admin/payment-attempts" },
    ],
  },
  {
    title: "identitySecurity",
    items: [{ label: "platformUsers", icon: Users, to: "/platform-admin/users" }],
  },
];

const translations = {
  en: {
    groups: {
      overview: "Overview",
      commercial: "Commercial",
      identitySecurity: "Identity & Security",
    },
    items: {
      dashboard: "Dashboard",
      organizations: "Organizations",
      subscriptionPlans: "Subscription Plans",
      contractTemplates: "Contract Templates",
      paymentGateway: "Payment Gateway",
      tenants: "Tenants",
      subscriptions: "Subscriptions",
      paymentApprovals: "Payment Approvals",
      invoices: "Invoices",
      payments: "Payments",
      paymentAttempts: "Payment Attempts",
      platformUsers: "Platform Users",
    },
  },
  fr: {
    groups: {
      overview: "Vue d’ensemble",
      commercial: "Commercial",
      identitySecurity: "Identité et sécurité",
    },
    items: {
      dashboard: "Tableau de bord",
      organizations: "Organisations",
      subscriptionPlans: "Forfaits d'abonnement",
      contractTemplates: "Modèles de contrat",
      paymentGateway: "Passerelle de paiement",
      tenants: "Entreprises clientes",
      subscriptions: "Abonnements",
      paymentApprovals: "Approbations de paiement",
      invoices: "Factures",
      payments: "Paiements",
      paymentAttempts: "Tentatives de paiement",
      platformUsers: "Utilisateurs de la plateforme",
    },
  },
  rw: {
    groups: {
      overview: "Incamake",
      commercial: "Ubucuruzi",
      identitySecurity: "Imyirondoro n’umutekano",
    },
    items: {
      dashboard: "Imbonerahamwe",
      organizations: "Imiryango",
      subscriptionPlans: "Gahunda z'ifatabuguzi",
      contractTemplates: "Inyandiko-rugero z'amasezerano",
      paymentGateway: "Uburyo bwo kwishyura",
      tenants: "Ibigo bikoresha sisitemu",
      subscriptions: "Amafatabuguzi",
      paymentApprovals: "Kwemeza Kwishyura",
      invoices: "Inyemezabuguzi",
      payments: "Ubwishyu",
      paymentAttempts: "Kugerageza kwishyura",
      platformUsers: "Abakoresha platform",
    },
  },
} as const;

/**
 * The console's navigation.
 *
 * ## What was taken out
 *
 * This file opened five Supabase queries on every render — unread
 * notifications, open sales enquiries, active support sessions, workspace
 * requests and login sessions — plus a realtime channel subscribed to the five
 * matching tables, all to paint red count badges. None of those tables exist in
 * this deployment, and none of the five links they belonged to are in the menu
 * any more, so the queries failed on a thirty-second timer and the badges could
 * never appear. Removing them takes the console's last Supabase dependency with
 * them.
 *
 * The footer panel went the same way. It read "Platform Health · All services
 * operational" in green, and it was two hardcoded strings — it would have said
 * the same during a total outage. The topbar's "Operational" badge was dropped
 * earlier for that reason; this was the same claim in a larger box.
 *
 * The unused translation entries went with the links they named. Roughly twenty
 * labels ("Trial Management", "Audit Logs", "Storage") were still being
 * translated into three languages for a menu none of them appear in.
 */
export default function PlatformSidebar() {
  const { language } = useLanguage();
  const copy = translations[language];

  return (
    <aside className="flex h-full w-[264px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/*
        No brand block here: the layout header carries it, exactly as the
        workspace does. Repeating it put the product name on screen twice, one
        above the other.

        Braces matter: a C-style comment written bare inside JSX is not a
        comment at all, it is text, and React renders it onto the page.
      */}

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted">
                {copy.groups[group.title as keyof typeof copy.groups]}
              </p>

              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;

                  return (
                    /*
                      The workspace sidebar's row, exactly.

                      This was a 40px icon tile above `py-3` padding with
                      `font-bold` text, a hardcoded `bg-blue-600` active state
                      and a drop shadow — rows roughly twice the height of the
                      workspace's, in a different weight and a blue that
                      ignored the theme.

                      Now: a bare 16px icon, `text-sm`, and the same
                      `bg-sidebar-accent` active state the workspace uses, so
                      both follow the theme together.
                    */
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/platform-admin"}
                      className={({ isActive }) =>
                        [
                          "group flex items-center gap-2 rounded-lg px-2 py-2 transition-colors",
                          isActive
                            ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        ].join(" ")
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />

                      <span className="min-w-0 flex-1 truncate text-sm">
                        {copy.items[item.label as keyof typeof copy.items]}
                      </span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
