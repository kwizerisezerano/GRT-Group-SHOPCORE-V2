import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CreditCard,
  Eye,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  UserPlus2,
  Users,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import Tenant360Drawer from "@/pages/platform-admin/components/Tenant360Drawer";
import { useLanguage } from "@/contexts/LanguageContext";
import { lastSuccessMessage, platformApi } from "@/lib/apiClient";
import { PlatformPageHeader } from "@/pages/platform-admin/components/PlatformPageHeader";
import {
  PageContainer,
  PageToolbar,
  PrimaryAction,
  StatGrid,
  ToolbarButton,
} from "@/components/patterns";
import { TenantModulesDialog } from "./components/TenantModulesDialog";

const TENANT_USER_ROLES = [
  "admin",
  "manager",
  "cashier",
  "accountant",
  "inventory_officer",
  "sales_staff",
  "staff",
  "viewer",
] as const;

function roleLabel(role: string) {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

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
  /*
   * A missing value is not a pending one.
   *
   * This defaulted to "pending", so every column the tenants endpoint does
   * not return — payment, trial — rendered an amber "pending" badge for six
   * workspaces regardless of what was true. An em dash says "not known here",
   * which is the honest answer and reads as one.
   */
  if (!value) return <span className="text-muted-foreground">—</span>;

  const status = value;

  if (["active", "paid", "approved"].includes(status)) {
    return (
      <Badge className="rounded-full border-emerald-500/25 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-50">
        {status}
      </Badge>
    );
  }

  if (["suspended", "expired", "blocked"].includes(status)) {
    return (
      <Badge className="rounded-full border-rose-500/25 bg-rose-500/10 text-rose-700 hover:bg-rose-50">
        {status}
      </Badge>
    );
  }

  return (
    <Badge className="rounded-full border-orange-500/25 bg-orange-500/10 text-orange-700 hover:bg-orange-50">
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
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  /** The workspace whose module access is open for editing. */
  const [modulesFor, setModulesFor] = useState<{ id: string; name: string } | null>(null);

  // Self-contained addition: a tenant picker backed by the real backend
  // (GET /api/platform/tenants), independent of the mock Supabase RPC the
  // rest of this page still reads from. See platformApi in lib/apiClient.
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [addUserTenantId, setAddUserTenantId] = useState("");
  const [addUserName, setAddUserName] = useState("");
  const [addUserEmail, setAddUserEmail] = useState("");
  const [addUserRole, setAddUserRole] = useState<(typeof TENANT_USER_ROLES)[number]>("staff");

  const realTenantsQ = useQuery({
    queryKey: ["platform-real-tenants"],
    enabled: addUserDialogOpen,
    queryFn: () => platformApi.tenants(),
  });

  const createTenantUser = useMutation({
    mutationFn: async () => {
      if (!addUserTenantId) throw new Error("Choose a tenant first");
      if (!addUserName.trim()) throw new Error("Enter a name");
      if (!isValidEmail(addUserEmail)) throw new Error("Enter a valid email address");

      return platformApi.createTenantUser(addUserTenantId, {
        email: addUserEmail.trim(),
        display_name: addUserName.trim(),
        role: addUserRole,
      });
    },
    onSuccess: () => {
      toast.success(lastSuccessMessage ?? `User created — login credentials emailed to ${addUserEmail}`);
      setAddUserDialogOpen(false);
      setAddUserName("");
      setAddUserEmail("");
      setAddUserRole("staff");
      qc.invalidateQueries({ queryKey: ["platform-real-tenants"] });
    },
    onError: (error: any) => toast.error(error?.message || "Could not create the user"),
  });

  /*
   * The workspace list comes from our own API.
   *
   * It used to call the Supabase RPC `platform_get_all_tenants`, which this
   * deployment does not have — so the page rendered "No tenants found" no
   * matter how many paying customers existed, and every control that needs a
   * row (module access, the 360 drawer) was unreachable.
   *
   * `/platform/tenants` returns fewer columns than the RPC promised: payment
   * status, trial status, billing cycle and renewal date are not in it. Those
   * cells read "—" rather than being guessed at, which is honest and still far
   * more useful than an empty table.
   */
  const tenantsQ = useQuery({
    queryKey: ["platform-tenants"],
    queryFn: async (): Promise<TenantRow[]> => {
      const tenants = await platformApi.tenants();

      return tenants.map((tenant) => ({
        id: tenant.id,
        name: tenant.name,
        subscription_plan: tenant.subscription_plan,
        subscription_status: tenant.subscription_status,
        payment_status: null,
        workspace_status: tenant.workspace_status,
        trial_status: null,
        billing_cycle: null,
        renewal_date: null,
        created_at: tenant.created_at,
      }));
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

  /*
   * Laid out the way the workspace lays out its pages.
   *
   * This was a `rounded-3xl` hero panel — an eyebrow, a 3xl `font-semibold`
   * heading, a paragraph of description and the actions inside it — repeated
   * on every console screen. The workspace uses none of that: one
   * `PageContainer`, a row of ghost buttons with the single primary action
   * pushed right, then the figures. Two products in one codebase is what made
   * the console feel like somebody else's software, and the page title is
   * already in the topbar, so the hero was restating it.
   */
  return (
    <PageContainer className="px-0 py-0 lg:px-0">
      <PlatformPageHeader title={copy.title} description={copy.description} />

      <PageToolbar>
        <ToolbarButton
          icon={RefreshCw}
          onClick={() => {
            tenantsQ.refetch();
            toast.info(copy.refreshing);
          }}
        >
          Refresh
        </ToolbarButton>

        <PrimaryAction icon={UserPlus2} onClick={() => setAddUserDialogOpen(true)}>
          Add Tenant User
        </PrimaryAction>
      </PageToolbar>

      <StatGrid
        columns={4}
        items={[
          { label: copy.total, value: stats.total.toLocaleString(), icon: Building2, tone: "indigo" },
          { label: copy.active, value: stats.active.toLocaleString(), icon: ShieldCheck, tone: "emerald" },
          { label: copy.pending, value: stats.pending.toLocaleString(), icon: CreditCard, tone: "amber" },
          { label: copy.trials, value: stats.trials.toLocaleString(), icon: Users, tone: "violet" },
        ]}
      />

      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-5 flex min-h-12 items-center gap-3 rounded-2xl border border-border bg-muted/40 px-4">
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
              <thead className="bg-muted/30 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
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
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-primary">
                          <Store className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">
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
                      {tenant.renewal_date ? (
                        new Date(tenant.renewal_date).toLocaleDateString()
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-xl"
                          onClick={() => setModulesFor({ id: tenant.id, name: tenant.name ?? "This workspace" })}
                        >
                          <SlidersHorizontal className="mr-2 h-4 w-4" />
                          Modules
                        </Button>

                        <Button
                          size="sm"
                          className="rounded-xl font-semibold"
                          onClick={() => setSelectedTenantId(tenant.id)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </Button>
                      </div>
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

      <TenantModulesDialog
        tenantId={modulesFor?.id ?? null}
        tenantName={modulesFor?.name ?? null}
        open={Boolean(modulesFor)}
        onClose={() => setModulesFor(null)}
      />

      <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
        <DialogContent className="max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle>Add Tenant User</DialogTitle>
            <DialogDescription>
              Creates the account immediately in the chosen tenant. A generated password is emailed to
              them, and they are required to change it the first time they sign in.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tenant</label>
              <Select value={addUserTenantId} onValueChange={setAddUserTenantId}>
                <SelectTrigger className="mt-1 rounded-2xl">
                  <SelectValue placeholder={realTenantsQ.isLoading ? "Loading tenants..." : "Choose a tenant"} />
                </SelectTrigger>
                <SelectContent>
                  {(realTenantsQ.data ?? []).map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Full name</label>
              <Input
                className="mt-1 rounded-2xl"
                placeholder="Jane Doe"
                value={addUserName}
                onChange={(e) => setAddUserName(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <Input
                className="mt-1 rounded-2xl"
                placeholder="user@example.com"
                value={addUserEmail}
                onChange={(e) => setAddUserEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Role</label>
              <Select value={addUserRole} onValueChange={(v) => setAddUserRole(v as (typeof TENANT_USER_ROLES)[number])}>
                <SelectTrigger className="mt-1 rounded-2xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TENANT_USER_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => setAddUserDialogOpen(false)}>Cancel</Button>
            <Button
              className="rounded-2xl bg-primary text-primary-foreground hover:opacity-90"
              disabled={createTenantUser.isPending}
              onClick={() => createTenantUser.mutate()}
            >
              <UserPlus2 className="mr-2 h-4 w-4" />
              {createTenantUser.isPending ? "Creating..." : "Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

/* KpiCard now lives in components/PlatformKpiCard — one card style for the
   console and the workspace, instead of a private copy per page. */