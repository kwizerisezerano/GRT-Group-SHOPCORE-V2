import { useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  CreditCard,
  Landmark,
  Loader2,
  RefreshCw,
  Smartphone,
  Sparkles,
  WalletCards,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageShell } from "@/components/PageShell";
import { PaymentBrandMark, brandFor } from "@/components/payments/PaymentBrandMark";
import { SignedContractCard } from "@/components/billing/SignedContractCard";
import { PageContainer, PageToolbar, SectionCard, StatGrid } from "@/components/patterns";
import { PlatformStatusBadge } from "@/pages/platform-admin/components/PlatformStatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { capacityQueryKey } from "@/components/SubscriptionCapacity";
import { SectionSkeleton } from "@/components/skeletons";
import { CapacityList, PeriodMeter } from "@/components/SubscriptionUsage";
import {
  paymentsApi,
  subscriptionApi,
  type PaymentMethodOption,
  type SubscriptionPlan,
} from "@/lib/subscriptionApi";
import { cn } from "@/lib/utils";

/**
 * The workspace's own billing screen.
 *
 * It answers three questions and does one thing. What am I on, how much of it
 * have I used, and what have I paid — then: pay for it, renew it, or move to
 * a bigger plan.
 *
 * The usage table matters as much as the invoice list here. When an admin is
 * refused a fourth team member, this is where they are sent, and "3 of 3 team
 * members used" beside an upgrade button is the whole explanation.
 *
 * Previously this read Supabase tables that this deployment does not have, so
 * it rendered an empty shell whatever the workspace was actually paying.
 */

type BillingCycle = "monthly" | "six_months" | "annual";

const CYCLE_LABEL: Record<string, string> = {
  monthly: "Monthly",
  six_months: "Every 6 months",
  annual: "Annual",
};

const money = (value: unknown, currency = "RWF") =>
  value === null || value === undefined
    ? "—"
    : `${currency} ${Math.round(Number(value)).toLocaleString()}`;

const longDate = (value: unknown) =>
  typeof value === "string"
    ? new Date(value).toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

const shortDateTime = (value: unknown) =>
  typeof value === "string"
    ? new Date(value).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export default function BillingPortal() {
  const { tenantId, refreshTenant } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [changingPlan, setChangingPlan] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>("monthly");
  const [methodCode, setMethodCode] = useState("");
  const [payerPhone, setPayerPhone] = useState("");
  const [pendingReference, setPendingReference] = useState<string | null>(
    searchParams.get("reference_id")
  );
  /** Filled in by the first poll — see the effect below for why. */
  const [pendingMethod, setPendingMethod] = useState<string | null>(null);
  /** The card tab, claimed during the click and pointed at the gateway later. */
  const cardTabRef = useRef<Window | null>(null);

  /*
   * Acknowledge a card payer arriving back from the gateway.
   *
   * They land here on a fresh page load with nothing but ?reference_id — no
   * memory of the payment they just made. Without a word, the page looks like
   * ordinary billing and the natural conclusion is that nothing happened.
   * Fires once: the ref survives the re-render the first poll causes.
   */
  const greetedReturn = useRef(false);
  useEffect(() => {
    if (greetedReturn.current) return;
    if (!searchParams.get("reference_id")) return;

    greetedReturn.current = true;
    toast.info("Checking your payment", {
      description: "This page updates by itself as soon as the gateway confirms it.",
    });
  }, [searchParams]);

  const currentQuery = useQuery({
    queryKey: ["subscription", "current", tenantId],
    queryFn: () => subscriptionApi.current(),
    enabled: Boolean(tenantId),
  });

  const usageQuery = useQuery({
    queryKey: capacityQueryKey(tenantId),
    queryFn: () => subscriptionApi.usage(),
    enabled: Boolean(tenantId),
  });

  const plansQuery = useQuery({
    queryKey: ["subscription", "plans"],
    queryFn: () => subscriptionApi.plans(),
    staleTime: 5 * 60 * 1000,
  });

  const methodsQuery = useQuery({
    queryKey: ["subscription", "payment-methods"],
    queryFn: () => subscriptionApi.paymentMethods(),
    staleTime: 5 * 60 * 1000,
  });

  const paymentsQuery = useQuery({
    queryKey: ["payments", "transactions", tenantId],
    queryFn: () => paymentsApi.transactions(25),
    enabled: Boolean(tenantId),
  });

  const subscription = currentQuery.data?.subscription ?? null;
  const plan = currentQuery.data?.plan ?? null;
  const tenant = currentQuery.data?.tenant ?? null;
  const capacities = usageQuery.data ?? [];
  const plans = plansQuery.data ?? [];
  const methods = methodsQuery.data ?? [];
  const payments = paymentsQuery.data ?? [];

  useEffect(() => {
    if (!selectedPlan && plan?.code) setSelectedPlan(plan.code);
  }, [plan, selectedPlan]);

  useEffect(() => {
    if (!methodCode && methods.length > 0) setMethodCode(methods[0].code);
  }, [methods, methodCode]);

  useEffect(() => {
    const cycle = subscription?.billing_cycle;
    if (typeof cycle === "string" && cycle in CYCLE_LABEL) {
      setSelectedCycle(cycle as BillingCycle);
    }
  }, [subscription]);

  const checkout = useMutation({
    mutationFn: () =>
      subscriptionApi.checkout({
        plan_code: selectedPlan || undefined,
        billing_cycle: selectedCycle,
        payment_method_code: methodCode,
        payer_phone: payerPhone.trim() || null,
      }),
    onSuccess: (result) => {
      setChangingPlan(false);

      /*
       * Card goes to a second tab, and this one stays on the pending banner
       * polling for the result. Replacing this tab meant leaving billing
       * entirely mid-payment and coming back to a page that had forgotten
       * there was one in flight.
       */
      if (result.redirect_url) {
        setPendingReference(result.reference_id);

        const tab = cardTabRef.current;
        cardTabRef.current = null;

        if (tab && !tab.closed) {
          tab.location.href = result.redirect_url;
          toast.success("Card page opened", {
            description: "Finish paying in the new tab — this page updates on its own.",
          });
        } else {
          // Blocked. Send them there from this tab rather than stranding them.
          window.location.href = result.redirect_url;
        }
        return;
      }

      setPendingReference(result.reference_id);
      toast.success("Prompt sent", {
        description: result.message || "Approve the payment on your phone to finish.",
      });
    },
    onError: (error: any) => {
      cardTabRef.current?.close();
      cardTabRef.current = null;
      toast.error("The payment could not be started", {
        description: error?.message ?? "Please try again, or choose another method.",
      });
    },
  });

  /*
   * Poll while a charge is in flight. The gateway's callback is what settles
   * it; this is only how this tab finds out, so it stops as soon as the
   * payment resolves and never runs when there is nothing pending.
   */
  useEffect(() => {
    if (!pendingReference) return;

    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;

      try {
        const transaction = await paymentsApi.status(pendingReference);
        if (cancelled) return;

        /*
         * Which rail this is decides what the banner tells them to do. It has
         * to come from the transaction rather than from component state,
         * because the card gateway returns the payer to this page with
         * nothing but ?reference_id= — a fresh load with no memory of how the
         * payment was started. Before this, a card payer coming back from
         * their bank was told to approve a prompt on their phone.
         */
        setPendingMethod(transaction.payment_method_code ?? null);

        if (transaction.status !== "pending") {
          setPendingReference(null);

          if (transaction.status === "success") {
            toast.success("Payment received", {
              description: "Your subscription is up to date and the receipt is on its way to your email.",
            });
            await refreshTenant({ authoritative: true });
          } else {
            toast.error("The payment did not go through", {
              description: transaction.status_detail || "Nothing was charged. You can try again.",
            });
          }

          queryClient.invalidateQueries({ queryKey: ["subscription", "current", tenantId] });
          queryClient.invalidateQueries({ queryKey: capacityQueryKey(tenantId) });
          queryClient.invalidateQueries({ queryKey: ["payments", "transactions", tenantId] });
          return;
        }
      } catch {
        // A missed poll is not a failure; the next one answers.
      }

      if (!cancelled && attempts < 60) setTimeout(poll, 3000);
      else if (!cancelled) setPendingReference(null);
    };

    const timer = setTimeout(poll, 2500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pendingReference, queryClient, refreshTenant, tenantId]);

  const workspaceStatus = String(tenant?.workspace_status ?? "");
  const needsPayment =
    workspaceStatus === "pending_payment" || subscription?.payment_status === "pending";

  const kpis = [
    {
      label: "Plan",
      value: plan?.name ?? String(subscription?.plan_code ?? "—"),
      icon: WalletCards,
    },
    {
      label: "Billing",
      value: CYCLE_LABEL[String(subscription?.billing_cycle)] ?? "—",
      icon: CalendarClock,
    },
    {
      label: "Per period",
      value: money(subscription?.amount, String(subscription?.currency ?? "RWF")),
      icon: CreditCard,
    },
    {
      label: "Renews",
      value: longDate(subscription?.current_period_end),
      icon: RefreshCw,
    },
  ];

  const selected = plans.find((entry) => entry.code === selectedPlan) ?? null;
  const selectedMethod = methods.find((entry) => entry.code === methodCode) ?? null;
  const selectedPrice = selected?.prices.find((price) => price.billing_cycle === selectedCycle) ?? null;

  return (
    <PageShell
      title="Billing & subscription"
      description="What your workspace is on, how much of it you are using, and every payment you have made."
    >
      <PageContainer>
        <PageToolbar>
          <Button
            variant="outline"
            className="ml-auto rounded-xl font-bold"
            onClick={() => {
              currentQuery.refetch();
              usageQuery.refetch();
              paymentsQuery.refetch();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </PageToolbar>

        {pendingReference && (
          <div className="flex items-start gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-4">
            <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary" />
            <div>
              <p className="text-sm font-black text-foreground">
                {pendingMethod === "card" ? "Confirming your card payment" : "Waiting for your payment"}
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">
                {pendingMethod === "card"
                  ? "Your bank is confirming it. "
                  : "Approve the prompt on your phone. "}
                Reference <span className="font-mono font-bold">{pendingReference}</span> — this page
                updates itself.
              </p>
            </div>
          </div>
        )}

        {needsPayment && !pendingReference && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0">
              <p className="text-sm font-black text-amber-800 dark:text-amber-200">
                This workspace is waiting on payment
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-amber-700 dark:text-amber-300">
                Settle {money(subscription?.amount, String(subscription?.currency ?? "RWF"))} to open
                it fully.
              </p>
              <Button
                size="sm"
                className="mt-3 rounded-xl font-black"
                onClick={() => setChangingPlan(true)}
              >
                Pay now
              </Button>
            </div>
          </div>
        )}

        <StatGrid items={kpis} columns={4} />

        {/*
          The term, above the capacity table. "18 of 30 days used" is the
          question people open this screen for, and it was the one thing the
          KPI row could not express.
        */}
        <PeriodMeter
          period={currentQuery.data?.period ?? null}
          planName={plan?.name ?? null}
        />

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <SectionCard
            title="What you are using"
            description="Counted live. When one of these fills up, the server stops new records being created until you upgrade."
          >
            {usageQuery.isLoading ? (
              <SectionSkeleton lines={5} className="border-0 p-0" />
            ) : (
              /* Handles the "no limits at all" case itself. */
              <CapacityList capacities={capacities} limit={8} />
            )}
          </SectionCard>

          <SectionCard
            title="Your plan"
            description={plan?.tagline ?? "Move up or down whenever you need to."}
          >
            {plan ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-muted/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-lg font-black text-foreground">{plan.name}</p>
                      <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                        {CYCLE_LABEL[String(subscription?.billing_cycle)] ?? "—"}
                      </p>
                    </div>
                    <PlatformStatusBadge status={String(subscription?.status ?? tenant?.subscription_status ?? "")} />
                  </div>

                  <p className="mt-4 font-data text-2xl font-black text-foreground">
                    {money(subscription?.amount, String(subscription?.currency ?? "RWF"))}
                  </p>

                  {subscription?.current_period_end ? (
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      Next payment due {longDate(subscription.current_period_end)}
                    </p>
                  ) : null}
                </div>

                <Button
                  className="h-12 w-full rounded-xl font-black"
                  onClick={() => setChangingPlan(true)}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {needsPayment ? "Pay for this plan" : "Change plan or renew"}
                </Button>
              </div>
            ) : (
              <div className="py-10 text-center">
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </SectionCard>
        </div>

        {changingPlan && (
          <SectionCard
            title="Choose what to pay for"
            description="Pick a plan and a billing cycle, then how you want to pay. Nothing is charged until you confirm."
          >
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {plans.map((entry) => (
                  <PlanOption
                    key={entry.code}
                    plan={entry}
                    cycle={selectedCycle}
                    current={entry.code === plan?.code}
                    selected={entry.code === selectedPlan}
                    onSelect={() => setSelectedPlan(entry.code)}
                  />
                ))}
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    Billing cycle
                  </Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(["monthly", "six_months", "annual"] as BillingCycle[])
                      .filter((cycle) =>
                        selected?.prices.some((price) => price.billing_cycle === cycle)
                      )
                      .map((cycle) => (
                        <button
                          key={cycle}
                          type="button"
                          onClick={() => setSelectedCycle(cycle)}
                          className={cn(
                            "rounded-xl border px-4 py-2.5 text-xs font-black transition",
                            selectedCycle === cycle
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card text-foreground hover:border-primary/40"
                          )}
                        >
                          {CYCLE_LABEL[cycle]}
                        </button>
                      ))}
                  </div>
                </div>

                <div>
                  <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    Pay with
                  </Label>
                  <div className="mt-2 grid gap-2">
                    {methods.map((method) => (
                      <MethodRow
                        key={method.code}
                        method={method}
                        selected={method.code === methodCode}
                        onSelect={() => setMethodCode(method.code)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {selectedMethod?.requires_phone && (
                <div className="max-w-sm">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    {selectedMethod.name} number
                  </Label>
                  <Input
                    type="tel"
                    value={payerPhone}
                    onChange={(event) => setPayerPhone(event.target.value)}
                    placeholder="+250 78 000 0000"
                    className="mt-1.5 h-11 rounded-xl"
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
                <Button
                  className="h-12 rounded-xl px-6 font-black"
                  disabled={
                    checkout.isPending ||
                    !selectedPrice ||
                    !methodCode ||
                    (selectedMethod?.requires_phone === true && payerPhone.trim().length < 9)
                  }
                  onClick={() => {
                    /*
                     * Claim the card tab inside the click, before the request.
                     * `window.open` from the mutation's onSuccess runs after an
                     * await, outside the user gesture, and every browser blocks
                     * it. See the same reasoning in onboarding/Checkout.tsx.
                     */
                    const selected = methods.find((m) => m.code === methodCode);
                    cardTabRef.current =
                      selected && !selected.is_manual && !selected.requires_phone
                        ? window.open("", "_blank")
                        : null;

                    /*
                     * Not "noopener" — that option makes window.open return
                     * null, leaving a blank tab we cannot navigate. Nulling
                     * opener on the blank page protects us just as well.
                     */
                    if (cardTabRef.current) cardTabRef.current.opener = null;

                    checkout.mutate();
                  }}
                >
                  {checkout.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="mr-2 h-4 w-4" />
                  )}
                  Pay {money(selectedPrice?.final_price, selectedPrice?.currency)}
                </Button>

                <Button
                  variant="ghost"
                  className="h-12 rounded-xl font-bold"
                  onClick={() => setChangingPlan(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </SectionCard>
        )}

        {/* Renders nothing when this workspace has no signed contract. */}
        <SignedContractCard />

        <SectionCard
          title="Payment history"
          description="Every charge on this workspace, with the reference the gateway knows it by."
        >
          {paymentsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : payments.length === 0 ? (
            <div className="py-10 text-center">
              <WalletCards className="mx-auto h-7 w-7 text-muted-foreground" />
              <p className="mt-3 text-sm font-black text-foreground">No payments yet</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                They will appear here as soon as you make one.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-border text-left">
                    {["Reference", "Amount", "Method", "Status", "When"].map((heading) => (
                      <th
                        key={heading}
                        className="px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-3 font-mono text-xs font-bold text-foreground">
                        {payment.reference_id}
                      </td>
                      <td className="px-3 py-3 font-data text-xs font-black text-foreground">
                        {money(payment.amount, payment.currency)}
                      </td>
                      <td className="px-3 py-3 text-xs font-semibold capitalize text-muted-foreground">
                        {(payment.payment_method_code ?? "—").replace(/_/g, " ")}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-black">
                          {payment.status === "success" ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : payment.status === "pending" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600 dark:text-amber-400" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                          )}
                          <span className="capitalize text-foreground">{payment.status}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs font-semibold text-muted-foreground">
                        {shortDateTime(payment.completed_at ?? payment.initiated_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </PageContainer>
    </PageShell>
  );
}

function PlanOption({
  plan,
  cycle,
  current,
  selected,
  onSelect,
}: {
  plan: SubscriptionPlan;
  cycle: BillingCycle;
  current: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const price = plan.prices.find((entry) => entry.billing_cycle === cycle);
  const seats = plan.limits.find((limit) => limit.limit_key === "users");

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-2xl border p-4 text-left transition",
        selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-black text-foreground">{plan.name}</span>
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition",
            selected ? "border-primary bg-primary text-primary-foreground" : "border-border"
          )}
        >
          {selected && <Check className="h-3 w-3" strokeWidth={3} />}
        </span>
      </div>

      <p className="mt-2 font-data text-lg font-black text-foreground">
        {price ? money(price.final_price, price.currency) : "—"}
      </p>

      <p className="mt-1 text-[11px] font-bold text-muted-foreground">
        {seats
          ? seats.is_unlimited
            ? "Unlimited team members"
            : `${seats.value} team members`
          : "No seat limit"}
      </p>

      {current && (
        <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-primary">
          Your current plan
        </p>
      )}
    </button>
  );
}

function MethodRow({
  method,
  selected,
  onSelect,
}: {
  method: PaymentMethodOption;
  selected: boolean;
  onSelect: () => void;
}) {
  /*
   * The real brand marks, the same ones the signup checkout shows.
   *
   * This used to draw a generic lucide glyph — one phone outline standing in
   * for both MTN and Airtel, so the two were distinguishable only by reading
   * the label. Somebody choosing how to pay recognises the logo before they
   * read anything, and it also meant the same choice looked like two different
   * products depending on whether you paid at signup or from billing.
   */
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border bg-card hover:border-primary/40 hover:bg-muted/40",
      )}
    >
      <PaymentBrandMark
        brand={brandFor({ provider: method.provider, code: method.code })}
        className="h-8 w-12 shrink-0 transition-transform duration-200 group-hover:scale-105"
      />
      <span className="min-w-0 flex-1 truncate text-xs font-black text-foreground">
        {method.name}
      </span>
      {selected && <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={3} />}
    </button>
  );
}
