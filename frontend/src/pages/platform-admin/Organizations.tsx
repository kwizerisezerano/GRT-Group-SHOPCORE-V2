import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  Clock3,
  CreditCard,
  Gauge,
  Infinity as InfinityIcon,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { PlatformPageHeader } from "@/pages/platform-admin/components/PlatformPageHeader";
import { PlatformKpiCard } from "@/pages/platform-admin/components/PlatformKpiCard";
import { PlatformStatusBadge } from "@/pages/platform-admin/components/PlatformStatusBadge";
import { platformSubscriptionApi, type CapacityReport } from "@/lib/subscriptionApi";

/**
 * Every company on the platform, and what each is paying for.
 *
 * Three jobs, in the order a super admin actually does them: see who is on
 * what and who is running out of seats; open one workspace and adjust it; and
 * create a new one from the same fields the customer would have filled in on
 * the signup page.
 */

const STATUS_FILTERS = [
  { value: "all", label: "All workspaces" },
  { value: "active", label: "Active" },
  { value: "pending_payment", label: "Awaiting payment" },
  { value: "suspended", label: "Suspended" },
  { value: "cancelled", label: "Cancelled" },
];

const money = (value: string | number | null | undefined, currency = "RWF") =>
  value === null || value === undefined
    ? "—"
    : `${currency} ${Math.round(Number(value)).toLocaleString()}`;

const shortDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

export default function Organizations() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const organizationsQuery = useQuery({
    queryKey: ["platform", "organizations", search, status],
    queryFn: () => platformSubscriptionApi.organizations({ search, status }),
  });

  const overviewQuery = useQuery({
    queryKey: ["platform", "overview"],
    queryFn: () => platformSubscriptionApi.overview(),
  });

  const plansQuery = useQuery({
    queryKey: ["platform", "plans"],
    queryFn: () => platformSubscriptionApi.plans(),
    staleTime: 5 * 60 * 1000,
  });

  const organizations = organizationsQuery.data?.organizations ?? [];
  const overview = overviewQuery.data;

  const nearingLimit = useMemo(
    () => organizations.filter((org) => org.at_seat_limit).length,
    [organizations]
  );

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["platform", "organizations"] });
    queryClient.invalidateQueries({ queryKey: ["platform", "overview"] });
  };

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        eyebrow="Customers"
        title="Organizations"
        description="Every workspace on the platform with its plan, its billing state and how much of its subscription it has used. Create a workspace here when the sale happened over a phone call rather than through the signup page."
        actions={
          <>
            <Button variant="outline" className="rounded-xl font-bold" onClick={refreshAll}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button className="rounded-xl font-semibold" onClick={() => setCreating(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add organization
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PlatformKpiCard
          tone="blue"
          icon={<Building2 className="h-5 w-5" />}
          label="Workspaces"
          value={String(overview?.workspaces.total ?? organizations.length)}
          helper={`${overview?.workspaces.active ?? 0} active`}
        />
        <PlatformKpiCard
          tone="orange"
          icon={<Clock3 className="h-5 w-5" />}
          label="Awaiting payment"
          value={String(overview?.workspaces.pending_payment ?? 0)}
          helper={`${overview?.pending_approvals ?? 0} awaiting approval`}
        />
        <PlatformKpiCard
          tone="emerald"
          icon={<TrendingUp className="h-5 w-5" />}
          label="Collected this month"
          value={money(overview?.revenue_this_month.amount ?? 0)}
          helper={`${overview?.revenue_this_month.payment_count ?? 0} payments`}
        />
        <PlatformKpiCard
          tone={nearingLimit > 0 ? "rose" : "violet"}
          icon={<Gauge className="h-5 w-5" />}
          label="At their seat limit"
          value={String(nearingLimit)}
          helper="Cannot add users without upgrading"
        />
      </div>

      <div className="rounded-3xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by workspace, owner or plan…"
              className="h-11 rounded-xl pl-10"
            />
          </div>

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-11 w-52 rounded-xl font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((filter) => (
                <SelectItem key={filter.value} value={filter.value}>
                  {filter.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {organizationsQuery.isLoading ? (
          <div className="flex items-center justify-center p-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-3 text-sm font-bold text-muted-foreground">Loading workspaces…</span>
          </div>
        ) : organizations.length === 0 ? (
          <div className="p-16 text-center">
            <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-4 text-sm font-semibold text-foreground">No workspaces match</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              {search || status !== "all"
                ? "Try a different search or filter."
                : "Nobody has signed up yet. Add the first organization above."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Workspace", "Owner", "Plan", "Seats", "Billing", "Renews", ""].map((heading) => (
                    <th
                      key={heading}
                      className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {organizations.map((org) => (
                  <tr
                    key={org.id}
                    className="border-b border-border/60 transition last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-semibold text-foreground">{org.name}</p>
                      <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
                        Joined {shortDate(org.created_at)}
                      </p>
                    </td>

                    <td className="px-4 py-3.5">
                      <p className="text-xs font-bold text-foreground">{org.owner_name ?? "—"}</p>
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-muted-foreground">
                        {org.owner_email ?? org.contact_email ?? "—"}
                      </p>
                    </td>

                    <td className="px-4 py-3.5">
                      <p className="text-xs font-semibold text-foreground">{org.plan_name ?? "—"}</p>
                      <p className="mt-0.5 text-[11px] font-semibold capitalize text-muted-foreground">
                        {(org.billing_cycle ?? "").replace("_", " ") || "—"}
                      </p>
                    </td>

                    <td className="px-4 py-3.5">
                      <SeatMeter
                        used={org.seats_used}
                        limit={org.seats_limit}
                        atLimit={org.at_seat_limit}
                      />
                    </td>

                    <td className="px-4 py-3.5">
                      <PlatformStatusBadge status={org.workspace_status} />
                      <p className="mt-1 font-data text-[11px] font-bold text-muted-foreground">
                        {money(org.subscription_amount, org.subscription_currency)}
                      </p>
                    </td>

                    <td className="px-4 py-3.5">
                      <p className="text-xs font-bold text-foreground">
                        {shortDate(org.current_period_end)}
                      </p>
                      {org.has_limit_overrides && (
                        <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                          <ShieldCheck className="h-3 w-3" />
                          custom limits
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-lg font-bold"
                        onClick={() => setOpenId(org.id)}
                      >
                        <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                        Manage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && (
        <CreateOrganizationDialog
          plans={plansQuery.data ?? []}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            refreshAll();
          }}
        />
      )}

      {openId && (
        <OrganizationDrawer
          organizationId={openId}
          plans={plansQuery.data ?? []}
          onClose={() => setOpenId(null)}
          onChanged={refreshAll}
        />
      )}
    </div>
  );
}

/** "4 of 5" with a bar — the one number that decides whether a workspace can grow. */
function SeatMeter({
  used,
  limit,
  atLimit,
}: {
  used: number;
  limit: number | null;
  atLimit: boolean;
}) {
  if (limit === null) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <InfinityIcon className="h-3.5 w-3.5" />
        {used} used
      </span>
    );
  }

  const percent = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));

  return (
    <div className="w-28">
      <p
        className={`font-data text-xs font-semibold ${
          atLimit ? "text-rose-600 dark:text-rose-400" : "text-foreground"
        }`}
      >
        {used} / {limit}
      </p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${
            atLimit ? "bg-rose-500" : percent >= 80 ? "bg-amber-500" : "bg-emerald-500"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------- create organization --- */

function CreateOrganizationDialog({
  plans,
  onClose,
  onCreated,
}: {
  plans: { code: string; name: string; prices: { billing_cycle: string }[] }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    business_name: "",
    owner_name: "",
    owner_email: "",
    owner_phone: "",
    business_location: "",
    business_type: "retail",
    team_size: "",
    plan_code: plans[0]?.code ?? "",
    billing_cycle: "monthly" as "monthly" | "six_months" | "annual",
    activate_immediately: true,
    trial_days: "",
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const create = useMutation({
    mutationFn: () =>
      platformSubscriptionApi.createOrganization({
        business_name: form.business_name.trim(),
        owner_name: form.owner_name.trim(),
        owner_email: form.owner_email.trim(),
        owner_phone: form.owner_phone.trim() || null,
        business_location: form.business_location.trim() || null,
        business_type: form.business_type || null,
        team_size: form.team_size.trim() || null,
        plan_code: form.plan_code,
        billing_cycle: form.billing_cycle,
        activate_immediately: form.activate_immediately,
        trial_days: form.trial_days === "" ? null : Number(form.trial_days),
      }),
    onSuccess: () => {
      toast.success("Workspace created. The owner has been emailed their sign-in details.");
      onCreated();
    },
    onError: (error: any) => toast.error(error?.message ?? "The workspace could not be created."),
  });

  const selectedPlan = plans.find((plan) => plan.code === form.plan_code);
  const availableCycles = selectedPlan?.prices.map((price) => price.billing_cycle) ?? ["monthly"];

  const ready =
    form.business_name.trim().length > 1 &&
    form.owner_name.trim().length > 1 &&
    /\S+@\S+\.\S+/.test(form.owner_email) &&
    Boolean(form.plan_code);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Add an organization</DialogTitle>
          <DialogDescription className="font-medium">
            The same details the customer would have entered on the signup page. The owner receives a
            generated password by email and text, and is made to change it on first sign-in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <Section title="Business">
            <div className="grid gap-4 sm:grid-cols-2">
              <LabelledInput
                label="Business name"
                required
                icon={<Building2 className="h-4 w-4" />}
                value={form.business_name}
                onChange={(value) => set("business_name", value)}
                placeholder="Kigali Fresh Market"
              />
              <LabelledInput
                label="Location"
                icon={<MapPin className="h-4 w-4" />}
                value={form.business_location}
                onChange={(value) => set("business_location", value)}
                placeholder="Kigali, Nyarugenge"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Business type
                </Label>
                <Select value={form.business_type} onValueChange={(value) => set("business_type", value)}>
                  <SelectTrigger className="mt-1.5 h-11 rounded-xl font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retail">Retail shop</SelectItem>
                    <SelectItem value="supermarket">Supermarket</SelectItem>
                    <SelectItem value="wholesale">Wholesale</SelectItem>
                    <SelectItem value="pharmacy">Pharmacy</SelectItem>
                    <SelectItem value="restaurant">Restaurant</SelectItem>
                    <SelectItem value="hardware">Hardware</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <LabelledInput
                label="Team size"
                icon={<Users className="h-4 w-4" />}
                value={form.team_size}
                onChange={(value) => set("team_size", value)}
                placeholder="5-10"
              />
            </div>
          </Section>

          <Section title="Owner account">
            <div className="grid gap-4 sm:grid-cols-2">
              <LabelledInput
                label="Full name"
                required
                icon={<UserPlus className="h-4 w-4" />}
                value={form.owner_name}
                onChange={(value) => set("owner_name", value)}
                placeholder="Jean Bosco"
              />
              <LabelledInput
                label="Email"
                required
                type="email"
                icon={<Mail className="h-4 w-4" />}
                value={form.owner_email}
                onChange={(value) => set("owner_email", value)}
                placeholder="owner@business.rw"
              />
            </div>

            <LabelledInput
              label="Phone"
              icon={<Phone className="h-4 w-4" />}
              value={form.owner_phone}
              onChange={(value) => set("owner_phone", value)}
              placeholder="+250 78 000 0000"
              hint="A second channel for the sign-in details, in case the email lands in spam."
            />
          </Section>

          <Section title="Subscription">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Plan <span className="text-rose-600">*</span>
                </Label>
                <Select value={form.plan_code} onValueChange={(value) => set("plan_code", value)}>
                  <SelectTrigger className="mt-1.5 h-11 rounded-xl font-semibold">
                    <SelectValue placeholder="Choose a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((plan) => (
                      <SelectItem key={plan.code} value={plan.code}>
                        {plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Billing cycle
                </Label>
                <Select
                  value={form.billing_cycle}
                  onValueChange={(value) => set("billing_cycle", value as typeof form.billing_cycle)}
                >
                  <SelectTrigger className="mt-1.5 h-11 rounded-xl font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCycles.includes("monthly") && <SelectItem value="monthly">Monthly</SelectItem>}
                    {availableCycles.includes("six_months") && (
                      <SelectItem value="six_months">Every 6 months</SelectItem>
                    )}
                    {availableCycles.includes("annual") && <SelectItem value="annual">Annual</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <LabelledInput
                label="Free trial days"
                type="number"
                value={form.trial_days}
                onChange={(value) => set("trial_days", value)}
                placeholder="Plan default"
                hint="Leave blank to use whatever the plan grants."
              />

              <div className="flex items-end pb-1">
                <div className="flex w-full items-start justify-between gap-3 rounded-xl border border-border bg-muted/30 p-3">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Open the workspace now</p>
                    <p className="mt-0.5 text-[11px] font-semibold leading-5 text-muted-foreground">
                      Off leaves it awaiting payment, exactly as a signup would.
                    </p>
                  </div>
                  <Switch
                    checked={form.activate_immediately}
                    onCheckedChange={(value) => set("activate_immediately", value)}
                    className="mt-0.5 shrink-0"
                  />
                </div>
              </div>
            </div>
          </Section>
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-xl font-bold" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="rounded-xl font-semibold"
            disabled={!ready || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Building2 className="mr-2 h-4 w-4" />
            )}
            Create workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------------------------- organization drawer --- */

function OrganizationDrawer({
  organizationId,
  plans,
  onClose,
  onChanged,
}: {
  organizationId: string;
  plans: { code: string; name: string }[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: ["platform", "organization", organizationId],
    queryFn: () => platformSubscriptionApi.organization(organizationId),
  });

  const detail = detailQuery.data;

  const update = useMutation({
    mutationFn: (input: Parameters<typeof platformSubscriptionApi.updateOrganization>[1]) =>
      platformSubscriptionApi.updateOrganization(organizationId, input),
    onSuccess: () => {
      toast.success("Workspace updated.");
      queryClient.invalidateQueries({ queryKey: ["platform", "organization", organizationId] });
      onChanged();
    },
    onError: (error: any) => toast.error(error?.message ?? "The workspace could not be updated."),
  });

  const setOverride = useMutation({
    mutationFn: (input: { limitKey: string; value: number | null; isUnlimited: boolean }) =>
      platformSubscriptionApi.setLimitOverride(organizationId, input.limitKey, {
        value: input.value,
        is_unlimited: input.isUnlimited,
      }),
    onSuccess: () => {
      toast.success("Limit updated for this workspace.");
      queryClient.invalidateQueries({ queryKey: ["platform", "organization", organizationId] });
      onChanged();
    },
    onError: (error: any) => toast.error(error?.message ?? "The limit could not be saved."),
  });

  const clearOverride = useMutation({
    mutationFn: (limitKey: string) =>
      platformSubscriptionApi.clearLimitOverride(organizationId, limitKey),
    onSuccess: () => {
      toast.success("Back to the plan's own limit.");
      queryClient.invalidateQueries({ queryKey: ["platform", "organization", organizationId] });
      onChanged();
    },
    onError: (error: any) => toast.error(error?.message ?? "The override could not be removed."),
  });

  const overriddenKeys = new Set((detail?.limit_overrides ?? []).map((entry) => entry.limit_key));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto rounded-3xl">
        {detailQuery.isLoading || !detail ? (
          <div className="flex items-center justify-center p-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">{detail.organization.name}</DialogTitle>
              <DialogDescription className="font-medium">
                {detail.organization.owner_name ?? "No owner on file"} ·{" "}
                {detail.organization.owner_email ?? "—"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-2">
              <div className="grid gap-4 sm:grid-cols-3">
                <MiniStat
                  icon={<CreditCard className="h-4 w-4" />}
                  label="Plan"
                  value={detail.plan?.name ?? detail.subscription?.plan_code ?? "—"}
                  helper={(detail.subscription?.billing_cycle ?? "").replace("_", " ")}
                />
                <MiniStat
                  icon={<Wallet className="h-4 w-4" />}
                  label="Subscription"
                  value={money(detail.subscription?.amount, detail.subscription?.currency ?? "RWF")}
                  helper={detail.subscription?.payment_status ?? "—"}
                />
                <MiniStat
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  label="Renews"
                  value={shortDate(detail.subscription?.current_period_end)}
                  helper={detail.organization.workspace_status ?? "—"}
                />
              </div>

              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Workspace controls
                </h3>

                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Status
                    </Label>
                    <Select
                      value={detail.organization.workspace_status ?? "active"}
                      onValueChange={(value) =>
                        update.mutate({ workspace_status: value as "active" })
                      }
                    >
                      <SelectTrigger className="mt-1.5 h-11 rounded-xl font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="pending_payment">Awaiting payment</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Move to plan
                    </Label>
                    <Select
                      value={detail.subscription?.plan_code ?? ""}
                      onValueChange={(value) => update.mutate({ plan_code: value })}
                    >
                      <SelectTrigger className="mt-1.5 h-11 rounded-xl font-semibold">
                        <SelectValue placeholder="Choose a plan" />
                      </SelectTrigger>
                      <SelectContent>
                        {plans.map((plan) => (
                          <SelectItem key={plan.code} value={plan.code}>
                            {plan.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Capacity
                  </h3>
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    Overriding a ceiling affects this workspace only
                  </p>
                </div>

                <div className="mt-3 space-y-2">
                  {detail.capacities.map((capacity) => (
                    <CapacityRow
                      key={capacity.limit_key}
                      capacity={capacity}
                      overridden={overriddenKeys.has(capacity.limit_key)}
                      saving={setOverride.isPending || clearOverride.isPending}
                      onOverride={(value, isUnlimited) =>
                        setOverride.mutate({ limitKey: capacity.limit_key, value, isUnlimited })
                      }
                      onClear={() => clearOverride.mutate(capacity.limit_key)}
                    />
                  ))}
                </div>
              </section>

              {detail.payments.length > 0 && (
                <section>
                  <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Recent payments
                  </h3>

                  <div className="mt-3 overflow-hidden rounded-2xl border border-border">
                    <table className="w-full">
                      <tbody>
                        {detail.payments.slice(0, 8).map((payment) => (
                          <tr key={payment.id} className="border-b border-border/60 last:border-0">
                            <td className="px-4 py-2.5 font-mono text-[11px] font-bold text-muted-foreground">
                              {payment.reference_id}
                            </td>
                            <td className="px-4 py-2.5 font-data text-xs font-semibold text-foreground">
                              {money(payment.amount, payment.currency)}
                            </td>
                            <td className="px-4 py-2.5 text-[11px] font-semibold capitalize text-muted-foreground">
                              {(payment.payment_method_code ?? "").replace(/_/g, " ")}
                            </td>
                            <td className="px-4 py-2.5">
                              <PlatformStatusBadge status={payment.status} />
                            </td>
                            <td className="px-4 py-2.5 text-[11px] font-semibold text-muted-foreground">
                              {shortDate(payment.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" className="rounded-xl font-bold" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * One capacity, with an inline editor for this workspace's own ceiling.
 *
 * The whole point of an override is that it is a small, occasional
 * adjustment — "they bought one more seat" — so it is editable in place
 * rather than behind another dialog.
 */
function CapacityRow({
  capacity,
  overridden,
  saving,
  onOverride,
  onClear,
}: {
  capacity: CapacityReport;
  overridden: boolean;
  saving: boolean;
  onOverride: (value: number | null, isUnlimited: boolean) => void;
  onClear: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(capacity.limit === null ? "" : String(capacity.limit));
  const [unlimited, setUnlimited] = useState(capacity.is_unlimited);

  const percent =
    capacity.limit === null
      ? 0
      : Math.min(100, Math.round((capacity.usage / Math.max(1, capacity.limit)) * 100));

  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-xs font-semibold text-foreground">{capacity.name}</p>
            {overridden && (
              <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                custom
              </span>
            )}
          </div>

          <div className="mt-1.5 flex items-center gap-3">
            <p className="font-data text-[11px] font-bold text-muted-foreground">
              {capacity.usage} used
              {capacity.limit !== null && ` of ${capacity.limit}`}
            </p>
            {capacity.limit !== null && (
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${
                    capacity.at_limit ? "bg-rose-500" : percent >= 80 ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              disabled={unlimited}
              value={unlimited ? "" : draft}
              placeholder={unlimited ? "Unlimited" : "0"}
              onChange={(event) => setDraft(event.target.value)}
              className="h-9 w-24 rounded-lg font-data"
            />
            <div className="flex items-center gap-1.5">
              <Switch checked={unlimited} onCheckedChange={setUnlimited} />
              <InfinityIcon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <Button
              size="sm"
              className="h-9 rounded-lg font-semibold"
              disabled={saving}
              onClick={() => {
                onOverride(unlimited ? null : Number(draft) || 0, unlimited);
                setEditing(false);
              }}
            >
              Save
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 rounded-lg"
              onClick={() => setEditing(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-data text-xs font-semibold text-foreground">
              {capacity.limit === null ? <InfinityIcon className="h-4 w-4" /> : capacity.limit}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 rounded-lg text-[11px] font-bold"
              onClick={() => setEditing(true)}
            >
              Override
            </Button>
            {overridden && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 rounded-lg text-[11px] font-bold text-muted-foreground"
                disabled={saving}
                onClick={onClear}
              >
                Reset
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- pieces --- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function LabelledInput({
  label,
  required,
  type = "text",
  icon,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  required?: boolean;
  type?: string;
  icon?: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label} {required && <span className="text-rose-600">*</span>}
      </Label>
      <div className="relative mt-1.5">
        {icon && (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </div>
        )}
        <Input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`h-11 rounded-xl ${icon ? "pl-10" : ""}`}
        />
      </div>
      {hint && <p className="mt-1.5 text-[11px] font-semibold text-muted-foreground">{hint}</p>}
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  helper,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-2 truncate text-sm font-semibold text-foreground">{value}</p>
      {helper && (
        <p className="mt-0.5 truncate text-[11px] font-semibold capitalize text-muted-foreground">
          {helper}
        </p>
      )}
    </div>
  );
}
