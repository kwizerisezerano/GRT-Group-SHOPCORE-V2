import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  Check,
  CreditCard,
  Gauge,
  Infinity as InfinityIcon,
  Layers3,
  Loader2,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import {
  platformSubscriptionApi,
  type CapacityKeyOption,
  type PlanWriteInput,
  type SubscriptionPlan,
} from "@/lib/subscriptionApi";

/**
 * The plan catalogue, as the person who sells the product sees it.
 *
 * This screen is where "Starter: 3 users, 1 branch, 500 products" is actually
 * decided. Everything typed here is enforced by the server on every create
 * (backend lib/planLimits.ts) and shown to the customer on the signup page,
 * so the editor is built around making the ceilings hard to get wrong: the
 * capacity picker only offers keys the server counts, an unlimited toggle
 * replaces the "leave it blank and hope" convention, and a limit that is
 * neither a number nor unlimited cannot be saved.
 */

const CYCLES: { value: "monthly" | "six_months" | "annual"; label: string; months: number }[] = [
  { value: "monthly", label: "Monthly", months: 1 },
  { value: "six_months", label: "Every 6 months", months: 6 },
  { value: "annual", label: "Annual", months: 12 },
];

type LimitDraft = {
  limit_key: string;
  name: string;
  value: string;
  is_unlimited: boolean;
  unit: string | null;
};

type PriceDraft = {
  billing_cycle: "monthly" | "six_months" | "annual";
  list_price: string;
  discount_percent: string;
  enabled: boolean;
};

type FeatureDraft = {
  feature_key: string;
  name: string;
  access_level: "included" | "limited" | "addon" | "unavailable";
};

type PlanDraft = {
  code: string;
  name: string;
  tagline: string;
  description: string;
  is_active: boolean;
  is_public: boolean;
  is_popular: boolean;
  badge_text: string;
  trial_days: string;
  display_order: string;
  prices: PriceDraft[];
  limits: LimitDraft[];
  features: FeatureDraft[];
};

const emptyDraft = (): PlanDraft => ({
  code: "",
  name: "",
  tagline: "",
  description: "",
  is_active: true,
  is_public: true,
  is_popular: false,
  badge_text: "",
  trial_days: "0",
  display_order: "0",
  prices: CYCLES.map((cycle) => ({
    billing_cycle: cycle.value,
    list_price: "",
    discount_percent: cycle.value === "monthly" ? "0" : cycle.value === "six_months" ? "10" : "20",
    enabled: cycle.value === "monthly",
  })),
  limits: [],
  features: [],
});

function draftFromPlan(plan: SubscriptionPlan): PlanDraft {
  return {
    code: plan.code,
    name: plan.name,
    tagline: plan.tagline ?? "",
    description: plan.description ?? "",
    is_active: plan.is_active,
    is_public: plan.is_public,
    is_popular: plan.is_popular,
    badge_text: plan.badge_text ?? "",
    trial_days: String(plan.trial_days ?? 0),
    display_order: String(plan.display_order ?? 0),
    prices: CYCLES.map((cycle) => {
      const price = plan.prices.find((entry) => entry.billing_cycle === cycle.value);
      return {
        billing_cycle: cycle.value,
        list_price: price ? String(price.list_price) : "",
        discount_percent: price ? String(price.discount_percent) : "0",
        enabled: Boolean(price),
      };
    }),
    limits: plan.limits.map((limit) => ({
      limit_key: limit.limit_key,
      name: limit.name,
      value: limit.is_unlimited || limit.value === null ? "" : String(limit.value),
      is_unlimited: limit.is_unlimited || limit.value === null,
      unit: limit.unit,
    })),
    features: plan.features.map((feature) => ({
      feature_key: feature.feature_key,
      name: feature.name,
      access_level: feature.access_level,
    })),
  };
}

const money = (value: number, currency = "RWF") =>
  `${currency} ${Math.round(value).toLocaleString()}`;

/** Mirrors the server's own arithmetic so the preview is not a second opinion. */
const finalPrice = (list: number, discount: number) => Math.round(list * (1 - discount / 100));

export default function SubscriptionPlans() {
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState<PlanDraft | null>(null);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SubscriptionPlan | null>(null);

  const plansQuery = useQuery({
    queryKey: ["platform", "plans"],
    queryFn: () => platformSubscriptionApi.plans(),
  });

  const capacityQuery = useQuery({
    queryKey: ["platform", "capacity-keys"],
    queryFn: () => platformSubscriptionApi.capacityKeys(),
    staleTime: 10 * 60 * 1000,
  });

  const plans = plansQuery.data ?? [];
  const capacityKeys = capacityQuery.data ?? [];

  const savePlan = useMutation({
    mutationFn: async ({ code, input }: { code: string | null; input: PlanWriteInput }) =>
      code
        ? platformSubscriptionApi.updatePlan(code, input)
        : platformSubscriptionApi.createPlan(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform", "plans"] });
      toast.success(editingCode ? "Plan updated." : "Plan created.");
      setEditing(null);
      setEditingCode(null);
    },
    onError: (error: any) => toast.error(error?.message ?? "The plan could not be saved."),
  });

  const deletePlan = useMutation({
    mutationFn: (code: string) => platformSubscriptionApi.deletePlan(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform", "plans"] });
      toast.success("Plan deleted.");
      setConfirmDelete(null);
    },
    onError: (error: any) => {
      toast.error(error?.message ?? "The plan could not be deleted.");
      setConfirmDelete(null);
    },
  });

  const stats = useMemo(() => {
    const active = plans.filter((plan) => plan.is_active).length;
    const subscribers = plans.reduce((total, plan) => total + (plan.subscriber_count ?? 0), 0);
    const capped = plans.filter((plan) => plan.limits.some((limit) => !limit.is_unlimited)).length;
    return { total: plans.length, active, subscribers, capped };
  }, [plans]);

  const startCreate = () => {
    setEditing(emptyDraft());
    setEditingCode(null);
  };

  const startEdit = (plan: SubscriptionPlan) => {
    setEditing(draftFromPlan(plan));
    setEditingCode(plan.code);
  };

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        eyebrow="Commercial catalogue"
        title="Subscription plans"
        description="What each package costs, what it opens up, and the ceilings it puts on a workspace. Limits set here are enforced by the server every time a workspace creates a user, a branch or a product."
        actions={
          <Button onClick={startCreate} className="rounded-xl font-semibold">
            <Plus className="mr-2 h-4 w-4" />
            New plan
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PlatformKpiCard
          tone="blue"
          icon={<Layers3 className="h-5 w-5" />}
          label="Plans"
          value={String(stats.total)}
          helper={`${stats.active} on sale`}
        />
        <PlatformKpiCard
          tone="emerald"
          icon={<Users className="h-5 w-5" />}
          label="Subscriptions"
          value={String(stats.subscribers)}
          helper="Workspaces across all plans"
        />
        <PlatformKpiCard
          tone="violet"
          icon={<Gauge className="h-5 w-5" />}
          label="Plans with ceilings"
          value={`${stats.capped} of ${stats.total}`}
          helper="A plan with no limits is unlimited"
        />
        <PlatformKpiCard
          tone="orange"
          icon={<CreditCard className="h-5 w-5" />}
          label="Billing cycles"
          value="3"
          helper="Monthly, 6-monthly, annual"
        />
      </div>

      {plansQuery.isLoading ? (
        <div className="flex items-center justify-center rounded-3xl border border-border bg-card p-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-3 text-sm font-bold text-muted-foreground">Loading plans…</span>
        </div>
      ) : plans.length === 0 ? (
        <EmptyPlans onCreate={startCreate} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.code}
              plan={plan}
              onEdit={() => startEdit(plan)}
              onDelete={() => setConfirmDelete(plan)}
            />
          ))}
        </div>
      )}

      {editing && (
        <PlanEditor
          draft={editing}
          isNew={!editingCode}
          capacityKeys={capacityKeys}
          saving={savePlan.isPending}
          onChange={setEditing}
          onClose={() => {
            setEditing(null);
            setEditingCode(null);
          }}
          onSave={(input) => savePlan.mutate({ code: editingCode, input })}
        />
      )}

      <Dialog open={Boolean(confirmDelete)} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-semibold">Delete {confirmDelete?.name}?</DialogTitle>
            <DialogDescription className="font-medium">
              {confirmDelete?.subscriber_count
                ? `${confirmDelete.subscriber_count} workspace(s) are still on this plan, so it cannot be deleted. Turn it off instead — everyone on it keeps exactly what they bought, and it stops appearing on the pricing page.`
                : "Its prices, ceilings and feature list go with it. This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl font-bold" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl font-semibold"
              disabled={deletePlan.isPending || Boolean(confirmDelete?.subscriber_count)}
              onClick={() => confirmDelete && deletePlan.mutate(confirmDelete.code)}
            >
              {deletePlan.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyPlans({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card p-14 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Layers3 className="h-6 w-6" />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-foreground">No plans yet</h3>
      <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-muted-foreground">
        Until a plan exists with prices on it, nobody can complete signup. Create one and give it the
        ceilings you want it to impose.
      </p>
      <Button onClick={onCreate} className="mt-6 rounded-xl font-semibold">
        <Plus className="mr-2 h-4 w-4" />
        Create the first plan
      </Button>
    </div>
  );
}

function PlanCard({
  plan,
  onEdit,
  onDelete,
}: {
  plan: SubscriptionPlan;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const cappedLimits = plan.limits.filter((limit) => !limit.is_unlimited);

  return (
    <article className="flex flex-col rounded-3xl border border-border bg-card p-6 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-semibold text-foreground">{plan.name}</h3>
            {plan.is_popular && (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                <Sparkles className="h-3 w-3" />
                {plan.badge_text || "Popular"}
              </span>
            )}
          </div>
          <p className="mt-1 font-mono text-xs font-bold text-muted-foreground">{plan.code}</p>
        </div>

        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onEdit} aria-label={`Edit ${plan.name}`}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-rose-600 hover:text-rose-700"
            onClick={onDelete}
            aria-label={`Delete ${plan.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {plan.tagline && (
        <p className="mt-2 text-sm font-medium leading-6 text-muted-foreground">{plan.tagline}</p>
      )}

      <div className="mt-5 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-foreground">
          {money(plan.monthly_price, plan.currency)}
        </span>
        <span className="text-xs font-bold text-muted-foreground">/ month</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <StatusPill active={plan.is_active} on="On sale" off="Off sale" />
        <StatusPill active={plan.is_public} on="Public" off="Private" />
        {plan.trial_days > 0 && (
          <span className="rounded-full border border-blue-500/25 bg-blue-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary dark:text-blue-300">
            {plan.trial_days}-day trial
          </span>
        )}
        <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {plan.subscriber_count ?? 0} subscribed
        </span>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Ceilings
        </p>

        {plan.limits.length === 0 ? (
          <p className="mt-2 flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            No limits set — this plan is unlimited
          </p>
        ) : (
          <ul className="mt-3 grid gap-1.5">
            {plan.limits.slice(0, 5).map((limit) => (
              <li key={limit.limit_key} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate font-semibold text-muted-foreground">{limit.name}</span>
                <span className="shrink-0 font-data font-semibold text-foreground">
                  {limit.is_unlimited ? (
                    <InfinityIcon className="h-3.5 w-3.5" />
                  ) : (
                    limit.value?.toLocaleString()
                  )}
                </span>
              </li>
            ))}
            {plan.limits.length > 5 && (
              <li className="pt-1 text-[11px] font-bold text-muted-foreground">
                +{plan.limits.length - 5} more
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="mt-auto flex items-center gap-4 border-t border-border pt-4 text-[11px] font-bold text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Boxes className="h-3.5 w-3.5" />
          {plan.features.length} modules
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Gauge className="h-3.5 w-3.5" />
          {cappedLimits.length} capped
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CreditCard className="h-3.5 w-3.5" />
          {plan.prices.length} cycles
        </span>
      </div>
    </article>
  );
}

function StatusPill({ active, on, off }: { active: boolean; on: string; off: string }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
        active
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-border bg-muted/50 text-muted-foreground"
      }`}
    >
      {active ? on : off}
    </span>
  );
}

/* ------------------------------------------------------------- editor --- */

function PlanEditor({
  draft,
  isNew,
  capacityKeys,
  saving,
  onChange,
  onClose,
  onSave,
}: {
  draft: PlanDraft;
  isNew: boolean;
  capacityKeys: CapacityKeyOption[];
  saving: boolean;
  onChange: (draft: PlanDraft) => void;
  onClose: () => void;
  onSave: (input: PlanWriteInput) => void;
}) {
  const [tab, setTab] = useState<"details" | "pricing" | "limits" | "modules">("details");
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => setErrors([]), [tab]);

  const set = <K extends keyof PlanDraft>(key: K, value: PlanDraft[K]) =>
    onChange({ ...draft, [key]: value });

  const usedLimitKeys = new Set(draft.limits.map((limit) => limit.limit_key));
  const availableKeys = capacityKeys.filter((key) => !usedLimitKeys.has(key.limit_key));

  const addLimit = (option: CapacityKeyOption) =>
    set("limits", [
      ...draft.limits,
      {
        limit_key: option.limit_key,
        name: option.name,
        value: "",
        is_unlimited: false,
        unit: option.unit,
      },
    ]);

  const updateLimit = (index: number, patch: Partial<LimitDraft>) =>
    set(
      "limits",
      draft.limits.map((limit, i) => (i === index ? { ...limit, ...patch } : limit))
    );

  const removeLimit = (index: number) =>
    set("limits", draft.limits.filter((_, i) => i !== index));

  const updatePrice = (cycle: string, patch: Partial<PriceDraft>) =>
    set(
      "prices",
      draft.prices.map((price) =>
        price.billing_cycle === cycle ? { ...price, ...patch } : price
      )
    );

  /**
   * Validated here as well as on the server, because the server's refusal
   * arrives after the editor has been open for five minutes and says which
   * field but not which tab.
   */
  const validate = (): string[] => {
    const problems: string[] = [];

    if (!draft.name.trim()) problems.push("The plan needs a name.");
    if (isNew && !/^[a-z][a-z0-9_]*$/.test(draft.code.trim())) {
      problems.push("The plan code must be lowercase letters, numbers and underscores.");
    }

    const enabled = draft.prices.filter((price) => price.enabled);
    if (draft.is_active && enabled.length === 0) {
      problems.push("A plan on sale needs at least one billing cycle priced.");
    }
    for (const price of enabled) {
      if (price.list_price === "" || Number(price.list_price) < 0) {
        problems.push(`Enter a price for the ${price.billing_cycle.replace("_", " ")} cycle.`);
      }
    }

    for (const limit of draft.limits) {
      if (!limit.is_unlimited && (limit.value === "" || Number(limit.value) < 0)) {
        problems.push(`${limit.name}: enter a number, or mark it unlimited.`);
      }
    }

    return problems;
  };

  const submit = () => {
    const problems = validate();
    setErrors(problems);

    if (problems.length > 0) {
      toast.error(problems[0]);
      return;
    }

    onSave({
      ...(isNew ? { code: draft.code.trim() } : {}),
      name: draft.name.trim(),
      tagline: draft.tagline.trim() || null,
      description: draft.description.trim() || null,
      is_active: draft.is_active,
      is_public: draft.is_public,
      is_popular: draft.is_popular,
      badge_text: draft.badge_text.trim() || null,
      trial_days: Number(draft.trial_days) || 0,
      display_order: Number(draft.display_order) || 0,
      prices: draft.prices
        .filter((price) => price.enabled)
        .map((price) => ({
          billing_cycle: price.billing_cycle,
          billing_months: CYCLES.find((cycle) => cycle.value === price.billing_cycle)!.months,
          list_price: Number(price.list_price) || 0,
          discount_percent: Number(price.discount_percent) || 0,
          currency: "RWF",
          is_active: true,
        })),
      limits: draft.limits.map((limit, index) => ({
        limit_key: limit.limit_key,
        name: limit.name.trim() || limit.limit_key,
        value: limit.is_unlimited ? null : Number(limit.value) || 0,
        is_unlimited: limit.is_unlimited,
        unit: limit.unit,
        display_order: index,
      })),
      features: draft.features.map((feature, index) => ({
        feature_key: feature.feature_key,
        name: feature.name,
        access_level: feature.access_level,
        category: "modules",
        display_order: index,
      })),
    });
  };

  const tabs = [
    { id: "details" as const, label: "Details" },
    { id: "pricing" as const, label: "Pricing" },
    { id: "limits" as const, label: `Limits (${draft.limits.length})` },
    { id: "modules" as const, label: `Modules (${draft.features.length})` },
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden rounded-3xl p-0">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="text-xl font-semibold">
            {isNew ? "New subscription plan" : `Edit ${draft.name || draft.code}`}
          </DialogTitle>
          <DialogDescription className="font-medium">
            Ceilings entered here are enforced on every create. A capacity with no row is unlimited.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 border-b border-border px-6">
          {tabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={`relative px-4 py-3 text-xs font-semibold uppercase tracking-wider transition ${
                tab === entry.id
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {entry.label}
              {tab === entry.id && (
                <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>

        <div className="max-h-[58vh] overflow-y-auto px-6 py-5">
          {errors.length > 0 && (
            <div className="mb-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4">
              <p className="flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
                <AlertTriangle className="h-4 w-4" />
                Fix these before saving
              </p>
              <ul className="mt-2 space-y-1 pl-6 text-xs font-semibold text-rose-700 dark:text-rose-300">
                {errors.map((problem) => (
                  <li key={problem} className="list-disc">
                    {problem}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tab === "details" && (
            <div className="grid gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Plan name" required>
                  <Input
                    value={draft.name}
                    onChange={(event) => set("name", event.target.value)}
                    placeholder="Professional"
                    className="h-11 rounded-xl"
                  />
                </Field>

                <Field
                  label="Plan code"
                  required
                  hint={isNew ? "Lowercase, no spaces. Permanent once saved." : "Codes cannot be changed."}
                >
                  <Input
                    value={draft.code}
                    disabled={!isNew}
                    onChange={(event) =>
                      set("code", event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))
                    }
                    placeholder="professional"
                    className="h-11 rounded-xl font-mono"
                  />
                </Field>
              </div>

              <Field label="Tagline" hint="One line under the plan name on the pricing table.">
                <Input
                  value={draft.tagline}
                  onChange={(event) => set("tagline", event.target.value)}
                  placeholder="A growing business with more than one counter"
                  className="h-11 rounded-xl"
                />
              </Field>

              <Field label="Description">
                <Textarea
                  value={draft.description}
                  onChange={(event) => set("description", event.target.value)}
                  rows={3}
                  placeholder="What this plan is for, in a sentence or two."
                  className="rounded-xl"
                />
              </Field>

              <div className="grid gap-5 sm:grid-cols-3">
                <Field label="Free trial (days)" hint="0 means no trial.">
                  <Input
                    type="number"
                    min={0}
                    value={draft.trial_days}
                    onChange={(event) => set("trial_days", event.target.value)}
                    className="h-11 rounded-xl font-data"
                  />
                </Field>

                <Field label="Display order">
                  <Input
                    type="number"
                    min={0}
                    value={draft.display_order}
                    onChange={(event) => set("display_order", event.target.value)}
                    className="h-11 rounded-xl font-data"
                  />
                </Field>

                <Field label="Badge text" hint="Shown when marked popular.">
                  <Input
                    value={draft.badge_text}
                    onChange={(event) => set("badge_text", event.target.value)}
                    placeholder="Most popular"
                    className="h-11 rounded-xl"
                  />
                </Field>
              </div>

              <div className="grid gap-3 rounded-2xl border border-border bg-muted/30 p-4">
                <ToggleRow
                  label="On sale"
                  hint="Off keeps every existing subscription working but stops new signups choosing it."
                  checked={draft.is_active}
                  onChange={(value) => set("is_active", value)}
                />
                <ToggleRow
                  label="Show publicly"
                  hint="Off hides it from the pricing page; a platform admin can still assign it."
                  checked={draft.is_public}
                  onChange={(value) => set("is_public", value)}
                />
                <ToggleRow
                  label="Highlight as most popular"
                  checked={draft.is_popular}
                  onChange={(value) => set("is_popular", value)}
                />
              </div>
            </div>
          )}

          {tab === "pricing" && (
            <div className="space-y-4">
              <p className="text-sm font-medium leading-6 text-muted-foreground">
                Price each cycle you want to offer. The discount is applied to the list price; what a
                customer is charged is shown beside it.
              </p>

              {draft.prices.map((price) => {
                const cycle = CYCLES.find((entry) => entry.value === price.billing_cycle)!;
                const charged = finalPrice(
                  Number(price.list_price) || 0,
                  Number(price.discount_percent) || 0
                );

                return (
                  <div
                    key={price.billing_cycle}
                    className={`rounded-2xl border p-4 transition ${
                      price.enabled ? "border-border bg-card" : "border-dashed border-border bg-muted/20"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{cycle.label}</p>
                        <p className="text-xs font-semibold text-muted-foreground">
                          Charged every {cycle.months} month{cycle.months > 1 ? "s" : ""}
                        </p>
                      </div>
                      <Switch
                        checked={price.enabled}
                        onCheckedChange={(value) => updatePrice(price.billing_cycle, { enabled: value })}
                      />
                    </div>

                    {price.enabled && (
                      <div className="mt-4 grid gap-4 sm:grid-cols-3">
                        <Field label="List price (RWF)">
                          <Input
                            type="number"
                            min={0}
                            value={price.list_price}
                            onChange={(event) =>
                              updatePrice(price.billing_cycle, { list_price: event.target.value })
                            }
                            className="h-11 rounded-xl font-data"
                          />
                        </Field>

                        <Field label="Discount (%)">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={price.discount_percent}
                            onChange={(event) =>
                              updatePrice(price.billing_cycle, { discount_percent: event.target.value })
                            }
                            className="h-11 rounded-xl font-data"
                          />
                        </Field>

                        <Field label="Customer pays">
                          <div className="flex h-11 items-center rounded-xl border border-border bg-muted/40 px-3 font-data text-sm font-semibold text-foreground">
                            {money(charged)}
                          </div>
                        </Field>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === "limits" && (
            <div className="space-y-4">
              <p className="text-sm font-medium leading-6 text-muted-foreground">
                Every ceiling is checked by the server before the thing is created. A capacity with no
                row here is unlimited on this plan.
              </p>

              {draft.limits.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
                  <Gauge className="mx-auto h-6 w-6 text-muted-foreground" />
                  <p className="mt-3 text-sm font-semibold text-foreground">No ceilings on this plan</p>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">
                    Add one below — "3 users", "2 branches" — and workspaces on this plan will be held
                    to it.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {draft.limits.map((limit, index) => {
                  const meta = capacityKeys.find((key) => key.limit_key === limit.limit_key);

                  return (
                    <div key={limit.limit_key} className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{limit.name}</p>
                          <p className="font-mono text-[11px] font-bold text-muted-foreground">
                            {limit.limit_key}
                            {meta && !meta.enforced && (
                              <span className="ml-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300">
                                not metered yet
                              </span>
                            )}
                          </p>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg text-rose-600 hover:text-rose-700"
                          onClick={() => removeLimit(index)}
                          aria-label={`Remove the ${limit.name} limit`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="mt-4 flex flex-wrap items-end gap-4">
                        <div className="w-40">
                          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Maximum
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            disabled={limit.is_unlimited}
                            value={limit.is_unlimited ? "" : limit.value}
                            placeholder={limit.is_unlimited ? "Unlimited" : "e.g. 3"}
                            onChange={(event) => updateLimit(index, { value: event.target.value })}
                            className="mt-1.5 h-11 rounded-xl font-data"
                          />
                        </div>

                        <div className="flex items-center gap-2.5 pb-3">
                          <Switch
                            checked={limit.is_unlimited}
                            onCheckedChange={(value) => updateLimit(index, { is_unlimited: value })}
                          />
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                            <InfinityIcon className="h-3.5 w-3.5" />
                            Unlimited
                          </span>
                        </div>

                        {limit.unit && (
                          <p className="pb-3 text-xs font-semibold text-muted-foreground">{limit.unit}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {availableKeys.length > 0 && (
                <div className="rounded-2xl border border-border bg-muted/20 p-4">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Add a ceiling
                  </Label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {availableKeys.map((option) => (
                      <button
                        key={option.limit_key}
                        type="button"
                        onClick={() => addLimit(option)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {option.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "modules" && (
            <ModuleEditor
              features={draft.features}
              onChange={(features) => set("features", features)}
            />
          )}
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button variant="outline" className="rounded-xl font-bold" onClick={onClose}>
            Cancel
          </Button>
          <Button className="rounded-xl font-semibold" disabled={saving} onClick={submit}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isNew ? "Create plan" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The modules a plan opens.
 *
 * Offered as a checklist against the known module keys rather than a free
 * text field: a typo here does not fail loudly, it silently gives a plan a
 * feature nothing checks for.
 */
const KNOWN_MODULES: { key: string; name: string; group: string }[] = [
  { key: "dashboard", name: "Dashboard", group: "Core" },
  { key: "pos", name: "Point of sale", group: "Core" },
  { key: "sales", name: "Sales & invoicing", group: "Core" },
  { key: "products", name: "Products", group: "Core" },
  { key: "categories", name: "Categories", group: "Core" },
  { key: "brands", name: "Brands", group: "Core" },
  { key: "units", name: "Units", group: "Core" },
  { key: "inventory", name: "Inventory & stock", group: "Core" },
  { key: "customers", name: "Customers", group: "Core" },
  { key: "settings", name: "Workspace settings", group: "Core" },
  { key: "notifications", name: "Notifications", group: "Core" },
  { key: "support", name: "Support", group: "Core" },

  { key: "purchases", name: "Purchase orders", group: "Growth" },
  { key: "suppliers", name: "Suppliers", group: "Growth" },
  { key: "expenses", name: "Expenses", group: "Growth" },
  { key: "reports", name: "Reports & analytics", group: "Growth" },
  { key: "branches", name: "Multi-branch", group: "Growth" },

  { key: "warehouses", name: "Warehouses", group: "Advanced" },
  { key: "loyalty", name: "Loyalty programme", group: "Advanced" },
  { key: "staff", name: "Staff management", group: "Advanced" },
  { key: "workspace_chat", name: "Workspace chat", group: "Advanced" },
  { key: "activity", name: "Activity log", group: "Advanced" },

  { key: "ebm", name: "EBM / RRA integration", group: "Enterprise" },
  { key: "qa", name: "Quality assurance suite", group: "Enterprise" },
];

function ModuleEditor({
  features,
  onChange,
}: {
  features: FeatureDraft[];
  onChange: (features: FeatureDraft[]) => void;
}) {
  const selected = new Map(features.map((feature) => [feature.feature_key, feature]));
  const groups = [...new Set(KNOWN_MODULES.map((module) => module.group))];

  const toggle = (key: string, name: string) => {
    if (selected.has(key)) {
      onChange(features.filter((feature) => feature.feature_key !== key));
    } else {
      onChange([...features, { feature_key: key, name, access_level: "included" }]);
    }
  };

  const setLevel = (key: string, level: FeatureDraft["access_level"]) =>
    onChange(
      features.map((feature) =>
        feature.feature_key === key ? { ...feature, access_level: level } : feature
      )
    );

  return (
    <div className="space-y-6">
      <p className="text-sm font-medium leading-6 text-muted-foreground">
        What a workspace on this plan can reach. Leaving every module unticked means the plan places
        no module restrictions at all — the ceilings on the Limits tab still apply.
      </p>

      {groups.map((group) => (
        <div key={group}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {group}
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {KNOWN_MODULES.filter((module) => module.group === group).map((module) => {
              const feature = selected.get(module.key);
              const isOn = Boolean(feature);

              return (
                <div
                  key={module.key}
                  className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition ${
                    isOn ? "border-primary/30 bg-primary/5" : "border-border bg-card"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggle(module.key, module.name)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                        isOn
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card"
                      }`}
                    >
                      {isOn && <Check className="h-3 w-3" />}
                    </span>
                    <span className="truncate text-xs font-semibold text-foreground">{module.name}</span>
                  </button>

                  {isOn && (
                    <Select
                      value={feature!.access_level}
                      onValueChange={(value) => setLevel(module.key, value as FeatureDraft["access_level"])}
                    >
                      <SelectTrigger className="h-8 w-28 shrink-0 rounded-lg text-[11px] font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="included">Included</SelectItem>
                        <SelectItem value="limited">Limited</SelectItem>
                        <SelectItem value="addon">Add-on</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label} {required && <span className="text-rose-600">*</span>}
      </Label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1.5 text-[11px] font-semibold text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        {hint && <p className="mt-0.5 text-[11px] font-semibold leading-5 text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5 shrink-0" />
    </div>
  );
}
