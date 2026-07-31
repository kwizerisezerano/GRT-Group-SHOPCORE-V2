import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CreditCard,
  Eye,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import Tenant360Drawer from "@/pages/platform-admin/components/Tenant360Drawer";
import { useLanguage } from "@/contexts/LanguageContext";

type TenantRow = {
  id: string;
  name: string;
  subscription_plan: string | null;
  subscription_status: string | null;
  payment_status: string | null;
  workspace_status: string | null;
  trial_status: string | null;
  billing_cycle: string | null;
  renewal_date: string | null;
  created_at: string | null;
};

function statusBadge(value?: string | null) {
  const status = value || "pending";

  if (["active", "paid", "approved"].includes(status)) {
    return (
      <Badge className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
        {status}
      </Badge>
    );
  }

  if (["suspended", "expired", "blocked"].includes(status)) {
    return (
      <Badge className="rounded-full border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50">
        {status}
      </Badge>
    );
  }

  return (
    <Badge className="rounded-full border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-50">
      {status}
    </Badge>
  );
}


const tenantCopy = {
  en: {
    eyebrow: "Tenant Operations",
    title: "Tenant Management Center",
    description: "Monitor all customer workspaces, subscription state, trial status, commercial readiness and lifecycle health across the ShopCore Cloud Platform.",
    refresh: "Refresh",
    refreshing: "Refreshing tenant records...",
    total: "Total Tenants",
    active: "Active Workspaces",
    pending: "Pending Activation",
    trials: "Trial Workspaces",
    search: "Search tenant, plan, payment status, subscription status...",
    workspace: "Workspace",
    plan: "Plan",
    subscription: "Subscription",
    payment: "Payment",
    trial: "Trial",
    renewal: "Renewal",
    action: "Action",
    view: "View Workspace",
    loading: "Loading tenant records...",
    empty: "No tenant records found.",
    unknown: "Unknown workspace",
  },
  fr: {
    eyebrow: "Opérations clients",
    title: "Centre de gestion des entreprises clientes",
    description: "Surveillez tous les espaces clients, les abonnements, les essais, la préparation commerciale et la santé du cycle de vie sur ShopCore Cloud.",
    refresh: "Actualiser",
    refreshing: "Actualisation des entreprises clientes...",
    total: "Entreprises clientes",
    active: "Espaces actifs",
    pending: "Activation en attente",
    trials: "Espaces en essai",
    search: "Rechercher entreprise, forfait, paiement ou abonnement...",
    workspace: "Espace de travail",
    plan: "Forfait",
    subscription: "Abonnement",
    payment: "Paiement",
    trial: "Essai",
    renewal: "Renouvellement",
    action: "Action",
    view: "Voir l’espace",
    loading: "Chargement des entreprises clientes...",
    empty: "Aucune entreprise cliente trouvée.",
    unknown: "Espace inconnu",
  },
  rw: {
    eyebrow: "Imikorere y’ibigo",
    title: "Ikigo gicunga abakoresha ShopCore",
    description: "Kurikirana ibigo byose, amafatabuguzi, igerageza, imyiteguro y’ubucuruzi n’imiterere yabyo kuri ShopCore Cloud.",
    refresh: "Ongera usubiremo",
    refreshing: "Kuvugurura amakuru y’ibigo...",
    total: "Ibigo byose",
    active: "Ahakorerwa hakora",
    pending: "Bitegereje kwemezwa",
    trials: "Ahakorerwa mu igerageza",
    search: "Shakisha ikigo, paki, ubwishyu cyangwa ifatabuguzi...",
    workspace: "Ahakorerwa",
    plan: "Paki",
    subscription: "Ifatabuguzi",
    payment: "Ubwishyu",
    trial: "Igerageza",
    renewal: "Kongera ifatabuguzi",
    action: "Igikorwa",
    view: "Reba ahakorerwa",
    loading: "Kuzana amakuru y’ibigo...",
    empty: "Nta bigo byabonetse.",
    unknown: "Ahakorerwa hatazwi",
  },
} as const;

export default function Tenants() {
  const { language } = useLanguage();
  const copy = tenantCopy[language];
  const [search, setSearch] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  const tenantsQ = useQuery({
    queryKey: ["platform-tenants"],
    queryFn: async (): Promise<TenantRow[]> => {
      const { data, error } = await (supabase as any).rpc(
  "platform_get_all_tenants",
);

      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return (tenantsQ.data ?? []).filter((tenant) => {
      if (!q) return true;

      return (
        tenant.name?.toLowerCase().includes(q) ||
        tenant.subscription_plan?.toLowerCase().includes(q) ||
        tenant.subscription_status?.toLowerCase().includes(q) ||
        tenant.payment_status?.toLowerCase().includes(q) ||
        tenant.workspace_status?.toLowerCase().includes(q)
      );
    });
  }, [search, tenantsQ.data]);

  const stats = useMemo(() => {
    const all = tenantsQ.data ?? [];

    return {
      total: all.length,
      active: all.filter(
        (tenant) =>
          tenant.workspace_status === "active" ||
          tenant.subscription_status === "active",
      ).length,
      pending: all.filter(
        (tenant) =>
          tenant.workspace_status !== "active" &&
          tenant.payment_status !== "paid",
      ).length,
      trials: all.filter((tenant) => tenant.trial_status === "approved").length,
    };
  }, [tenantsQ.data]);

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
          Tenant Operations
        </p>

        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">
              Tenant Management Center
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-muted-foreground">
              {copy.description}
            </p>
          </div>

          <Button
            className="rounded-xl bg-[#070b67] font-black hover:bg-[#050950]"
            onClick={() => {
              tenantsQ.refetch();
              toast.info(copy.refreshing);
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-1">
        <KpiCard icon={<Building2 className="h-6 w-6" />} label={copy.total} value={stats.total.toLocaleString()} tone="blue" />
        <KpiCard icon={<ShieldCheck className="h-6 w-6" />} label={copy.active} value={stats.active.toLocaleString()} tone="emerald" />
        <KpiCard icon={<CreditCard className="h-6 w-6" />} label={copy.pending} value={stats.pending.toLocaleString()} tone="orange" />
        <KpiCard icon={<Users className="h-6 w-6" />} label={copy.trials} value={stats.trials.toLocaleString()} tone="violet" />
      </div>

      <div className="rounded-[2rem] border border-border bg-card p-5 shadow-sm">
        <div className="mb-5 flex min-h-12 items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4">
          <Search className="h-5 w-5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={copy.search}
            className="border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
        </div>

        {tenantsQ.isLoading ? (
          <div className="py-12 text-center text-sm font-bold text-muted-foreground">
            Loading tenants...
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm font-bold text-muted-foreground">
            No tenants found.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-muted/30 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{copy.workspace}</th>
                  <th className="px-4 py-3">{copy.plan}</th>
                  <th className="px-4 py-3">{copy.subscription}</th>
                  <th className="px-4 py-3">{copy.payment}</th>
                  <th className="px-4 py-3">{copy.workspace}</th>
                  <th className="px-4 py-3">{copy.trial}</th>
                  <th className="px-4 py-3">{copy.renewal}</th>
                  <th className="px-4 py-3 text-right">{copy.action}</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((tenant) => (
                  <tr key={tenant.id} className="border-t border-border">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                          <Store className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-black text-foreground">
                            {tenant.name}
                          </p>
                          <p className="mt-1 text-xs font-medium text-muted-foreground">
                            {tenant.id}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4 capitalize">
                      {tenant.subscription_plan || "pending"}
                    </td>

                    <td className="px-4 py-4">
                      {statusBadge(tenant.subscription_status)}
                    </td>

                    <td className="px-4 py-4">
                      {statusBadge(tenant.payment_status)}
                    </td>

                    <td className="px-4 py-4">
                      {statusBadge(tenant.workspace_status)}
                    </td>

                    <td className="px-4 py-4">
                      {statusBadge(tenant.trial_status)}
                    </td>

                    <td className="px-4 py-4">
                      {tenant.renewal_date
                        ? new Date(tenant.renewal_date).toLocaleDateString()
                        : "Pending"}
                    </td>

                    <td className="px-4 py-4 text-right">
                      <Button
                        variant="outline"
                        className="rounded-xl border-blue-200 bg-blue-50 font-black text-blue-700 hover:bg-blue-100"
                        onClick={() => setSelectedTenantId(tenant.id)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Tenant360Drawer
        open={!!selectedTenantId}
        tenantId={selectedTenantId}
        onClose={() => setSelectedTenantId(null)}
      />
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "blue" | "emerald" | "orange" | "violet";
}) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
  }[tone];

  return (
    <div className={`rounded-[1.5rem] border p-5 shadow-sm ${toneClass}`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-card/80">
        {icon}
      </div>

      <p className="mt-5 text-xs font-black uppercase tracking-[0.16em]">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}