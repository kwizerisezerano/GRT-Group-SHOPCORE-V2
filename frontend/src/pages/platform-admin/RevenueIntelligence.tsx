import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  CreditCard,
  LineChart,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { PlatformPageHeader } from "@/pages/platform-admin/components/PlatformPageHeader";
import { PlatformKpiCard } from "@/pages/platform-admin/components/PlatformKpiCard";
import { PlatformStatusBadge } from "@/pages/platform-admin/components/PlatformStatusBadge";

type SubscriptionRow = {
  id: string;
  tenant_id: string;
  plan_code: string;
  status: string;
  billing_cycle: string;
  tenants?: { name?: string | null } | null;
};

type InvoiceRow = {
  id: string;
  tenant_id: string | null;
  invoice_no: string | null;
  status: string;
  currency: string;
  total: number;
  created_at: string | null;
  tenants?: { name?: string | null } | null;
};

type PaymentAttemptRow = {
  id: string;
  tenant_id: string | null;
  amount: number;
  currency: string;
  status: string;
  attempted_at: string | null;
};

type EventRow = {
  id: string;
  tenant_id: string | null;
  event_type: string;
  title: string;
  description: string | null;
  created_at: string | null;
};

function money(value?: number | null, currency = "RWF") {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
}

function planAmount(planCode?: string | null) {
  const code = (planCode || "starter").toLowerCase();

  if (code === "enterprise") return 150000;
  if (code === "business") return 75000;
  if (code === "growth") return 45000;
  if (code === "starter") return 25000;

  return 25000;
}


const revenueCopy = {
 en:{eyebrow:"Executive Analytics",title:"Revenue Intelligence",description:"Track recurring revenue, invoice collections, payment performance and subscription activity across ShopCore Cloud.",refresh:"Refresh",refreshing:"Refreshing revenue intelligence...",mrr:"MRR",arr:"ARR",paid:"Paid Revenue",pending:"Pending Revenue",active:"Active Subscriptions",collection:"Invoice Collection",success:"Payment Success",recentInvoices:"Recent Invoices",recentEvents:"Recent Commercial Events",workspace:"Workspace",invoice:"Invoice",amount:"Amount",status:"Status",date:"Date",event:"Event",noInvoices:"No invoice activity found.",noEvents:"No commercial events found.",noDate:"No date"},
 fr:{eyebrow:"Analyse exécutive",title:"Analyse des revenus",description:"Suivez les revenus récurrents, les encaissements de factures, les paiements et l’activité des abonnements sur ShopCore Cloud.",refresh:"Actualiser",refreshing:"Actualisation de l’analyse des revenus...",mrr:"Revenu mensuel récurrent",arr:"Revenu annuel récurrent",paid:"Revenus encaissés",pending:"Revenus en attente",active:"Abonnements actifs",collection:"Recouvrement des factures",success:"Réussite des paiements",recentInvoices:"Factures récentes",recentEvents:"Événements commerciaux récents",workspace:"Espace de travail",invoice:"Facture",amount:"Montant",status:"Statut",date:"Date",event:"Événement",noInvoices:"Aucune activité de facturation.",noEvents:"Aucun événement commercial.",noDate:"Aucune date"},
 rw:{eyebrow:"Isesengura ry’ubuyobozi",title:"Isesengura ry’amafaranga yinjira",description:"Kurikirana amafaranga yinjira buri gihe, inyemezabuguzi, ubwishyu n’amafatabuguzi kuri ShopCore Cloud.",refresh:"Ongera usubiremo",refreshing:"Kuvugurura isesengura ry’amafaranga...",mrr:"Amafaranga y’ukwezi",arr:"Amafaranga y’umwaka",paid:"Amafaranga yishyuwe",pending:"Amafaranga ategereje",active:"Amafatabuguzi akora",collection:"Kwishyura inyemezabuguzi",success:"Ubwishyu bwagenze neza",recentInvoices:"Inyemezabuguzi ziheruka",recentEvents:"Ibikorwa by’ubucuruzi biheruka",workspace:"Ahakorerwa",invoice:"Inyemezabuguzi",amount:"Amafaranga",status:"Imiterere",date:"Itariki",event:"Igikorwa",noInvoices:"Nta bikorwa by’inyemezabuguzi byabonetse.",noEvents:"Nta bikorwa by’ubucuruzi byabonetse.",noDate:"Nta tariki"}
} as const;

export default function RevenueIntelligence() {
  const { language } = useLanguage();
  const copy = revenueCopy[language];
  const revenueQ = useQuery({
    queryKey: ["platform-revenue-intelligence"],
    queryFn: async () => {
      const [subscriptionsRes, invoicesRes, attemptsRes, eventsRes] =
        await Promise.all([
          (supabase as any)
            .from("tenant_subscriptions")
            .select(
              `
              id,
              tenant_id,
              plan_code,
              status,
              billing_cycle,
              tenants (name)
            `,
            ),

          (supabase as any)
            .from("subscription_invoices")
            .select(
              `
              id,
              tenant_id,
              invoice_no,
              status,
              currency,
              total,
              created_at,
              tenants (name)
            `,
            )
            .order("created_at", { ascending: false }),

          (supabase as any)
            .from("payment_attempts")
            .select("id, tenant_id, amount, currency, status, attempted_at")
            .order("attempted_at", { ascending: false }),

          (supabase as any)
            .from("subscription_events")
            .select("id, tenant_id, event_type, title, description, created_at")
            .order("created_at", { ascending: false })
            .limit(12),
        ]);

      if (subscriptionsRes.error) throw subscriptionsRes.error;
      if (invoicesRes.error) throw invoicesRes.error;
      if (attemptsRes.error) throw attemptsRes.error;
      if (eventsRes.error) throw eventsRes.error;

      return {
        subscriptions: (subscriptionsRes.data ?? []) as SubscriptionRow[],
        invoices: (invoicesRes.data ?? []) as InvoiceRow[],
        attempts: (attemptsRes.data ?? []) as PaymentAttemptRow[],
        events: (eventsRes.data ?? []) as EventRow[],
      };
    },
  });

  const subscriptions = revenueQ.data?.subscriptions ?? [];
  const invoices = revenueQ.data?.invoices ?? [];
  const attempts = revenueQ.data?.attempts ?? [];
  const events = revenueQ.data?.events ?? [];

  const metrics = useMemo(() => {
    const activeSubs = subscriptions.filter((sub) => sub.status === "active");
    const paidInvoices = invoices.filter((invoice) => invoice.status === "paid");
    const pendingInvoices = invoices.filter(
      (invoice) => invoice.status !== "paid" && invoice.status !== "void",
    );
    const paidAttempts = attempts.filter((attempt) => attempt.status === "paid");

    const mrr = activeSubs.reduce((sum, sub) => {
      const amount = planAmount(sub.plan_code);
      return sum + (sub.billing_cycle === "yearly" ? amount / 12 : amount);
    }, 0);

    const paidRevenue = paidInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.total || 0),
      0,
    );

    const pendingRevenue = pendingInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.total || 0),
      0,
    );

    return {
      mrr,
      arr: mrr * 12,
      paidRevenue,
      pendingRevenue,
      activeSubscriptions: activeSubs.length,
      invoiceCollectionRate: invoices.length
        ? Math.round((paidInvoices.length / invoices.length) * 100)
        : 0,
      paymentSuccessRate: attempts.length
        ? Math.round((paidAttempts.length / attempts.length) * 100)
        : 0,
    };
  }, [subscriptions, invoices, attempts]);

  const planStats = useMemo(() => {
    const grouped = subscriptions.reduce<Record<string, number>>((acc, sub) => {
      const key = sub.plan_code || "starter";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped).map(([plan, count]) => ({
      plan,
      count,
      revenue: count * planAmount(plan),
    }));
  }, [subscriptions]);

  const statusStats = useMemo(() => {
    const grouped = subscriptions.reduce<Record<string, number>>((acc, sub) => {
      const key = sub.status || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped).map(([status, count]) => ({
      status,
      count,
    }));
  }, [subscriptions]);

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        eyebrow="Executive Analytics"
        title={copy.title}
        description="Track recurring revenue, invoice collection, subscription growth, payment success and commercial performance across ShopCore Cloud."
        actions={
          <Button
            className="rounded-xl bg-[#070b67] font-black hover:bg-[#050950]"
            onClick={() => {
              revenueQ.refetch();
              toast.info(copy.refreshing);
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-1">
        <PlatformKpiCard icon={<TrendingUp className="h-6 w-6" />} label={copy.mrr} value={money(metrics.mrr)} tone="emerald" />
        <PlatformKpiCard icon={<LineChart className="h-6 w-6" />} label={copy.arr} value={money(metrics.arr)} tone="violet" />
        <PlatformKpiCard icon={<ReceiptText className="h-6 w-6" />} label={copy.paid} value={money(metrics.paidRevenue)} tone="blue" />
        <PlatformKpiCard icon={<CreditCard className="h-6 w-6" />} label={copy.pending} value={money(metrics.pendingRevenue)} tone="orange" />
      </div>

      <div className="grid gap-4 xl:grid-cols-1">
        <PlatformKpiCard icon={<WalletCards className="h-6 w-6" />} label={copy.active} value={metrics.activeSubscriptions.toLocaleString()} tone="emerald" />
        <PlatformKpiCard icon={<ShieldCheck className="h-6 w-6" />} label={copy.collection} value={`${metrics.invoiceCollectionRate}%`} tone="cyan" />
        <PlatformKpiCard icon={<Activity className="h-6 w-6" />} label={copy.success} value={`${metrics.paymentSuccessRate}%`} tone="violet" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                Revenue by Plan
              </p>
              <h2 className="mt-2 text-xl font-black text-foreground">
                Plan Performance
              </h2>
            </div>
            <BarChart3 className="h-7 w-7 text-violet-700" />
          </div>

          <div className="mt-6 space-y-4">
            {planStats.map((item) => (
              <div key={item.plan} className="rounded-2xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black capitalize text-foreground">
                    {item.plan}
                  </p>
                  <p className="text-sm font-black text-foreground">
                    {money(item.revenue)}
                  </p>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[#070b67]"
                    style={{
                      width: `${Math.min(100, item.count * 12)}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-xs font-bold text-muted-foreground">
                  {item.count.toLocaleString()} subscription(s)
                </p>
              </div>
            ))}

            {!planStats.length && (
              <div className="rounded-2xl border border-border p-5 text-sm font-bold text-muted-foreground">
                No subscription plan data available.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
            Subscription Mix
          </p>
          <h2 className="mt-2 text-xl font-black text-foreground">
            Lifecycle Status
          </h2>

          <div className="mt-6 space-y-3">
            {statusStats.map((item) => (
              <div
                key={item.status}
                className="flex items-center justify-between rounded-2xl border border-border bg-muted/30 p-4"
              >
                <PlatformStatusBadge status={item.status} />
                <p className="text-2xl font-black text-foreground">
                  {item.count}
                </p>
              </div>
            ))}

            {!statusStats.length && (
              <div className="rounded-2xl border border-border p-5 text-sm font-bold text-muted-foreground">
                No lifecycle data available.
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
          Commercial Activity
        </p>
        <h2 className="mt-2 text-xl font-black text-foreground">
          Latest Revenue Events
        </h2>

        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {events.map((event) => (
            <div
              key={event.id}
              className="rounded-2xl border border-border bg-muted/30 p-4"
            >
              <p className="text-sm font-black text-foreground">
                {event.title}
              </p>
              <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">
                {event.description || event.event_type}
              </p>
              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                {event.created_at
                  ? new Date(event.created_at).toLocaleString()
                  : "No date"}
              </p>
            </div>
          ))}

          {!events.length && (
            <div className="rounded-2xl border border-border p-5 text-sm font-bold text-muted-foreground">
              No recent revenue events.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}