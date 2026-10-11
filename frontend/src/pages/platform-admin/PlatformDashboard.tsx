import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CircleDollarSign,
  ClipboardCheck,
  CreditCard,
  Inbox,
  Layers3,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  EmptyNote,
  PageContainer,
  PrimaryAction,
  SectionCard,
  StatGrid,
} from "@/components/patterns";
import { platformApi } from "@/lib/apiClient";
import { PlatformPageHeader } from "@/pages/platform-admin/components/PlatformPageHeader";

/**
 * The platform console's home screen.
 *
 * ## Why this was rewritten
 *
 * The previous version drew twenty-odd figures from Supabase tables this
 * deployment does not have, so it reported zeros with complete confidence:
 * "Platform Admins 0" with two admins signed in, "Payment Attempts 0" with
 * seven on record, "No subscription invoices found" with one issued. It also
 * contradicted itself — a card reading "Revenue this month RWF 85,200" sat
 * directly above a panel reading "Verified Subscription Revenue · This month ·
 * RWF 0".
 *
 * A dashboard that is confidently wrong is worse than an empty one. An
 * operator who checks "failed payments", reads zero and stops looking has been
 * actively misled. So every figure here comes from an endpoint reading our own
 * database, and anything without a real source was removed rather than left
 * showing a zero.
 *
 * Removed for having no data behind them: sales enquiries, the tenant health
 * watchlist, the live activity feed, the service monitor (API gateway,
 * database cluster and queue statuses were hardcoded strings), storage assets,
 * infrastructure, login sessions and unread alerts.
 *
 * Kept and made real: workspace counts, revenue, what needs attention, the
 * subscription mix by plan, recent payments and recent invoices — what a
 * platform owner opens this page to check.
 */

const money = (value: unknown, currency = "RWF") =>
  `${currency} ${Math.round(Number(value ?? 0)).toLocaleString()}`;

const shortDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "—";

export default function PlatformDashboard() {
  const overviewQ = useQuery({
    queryKey: ["platform", "overview"],
    queryFn: () => platformApi.overview(),
    refetchInterval: 30_000,
  });

  const usersQ = useQuery({
    queryKey: ["platform", "users"],
    queryFn: () => platformApi.platformUsers(),
  });

  const paymentsQ = useQuery({
    queryKey: ["platform", "payments", "recent"],
    queryFn: () => platformApi.platformPayments(),
  });

  const invoicesQ = useQuery({
    queryKey: ["platform", "invoices", "recent"],
    queryFn: () => platformApi.platformInvoices(),
  });

  const overview = overviewQ.data;
  const workspaces = overview?.workspaces;
  const total = workspaces?.total ?? 0;
  const active = workspaces?.active ?? 0;
  const attention = (overview?.pending_approvals ?? 0) + (overview?.failed_payments ?? 0);

  const payments = paymentsQ.data?.payments ?? [];
  const invoices = invoicesQ.data?.invoices ?? [];

  const recentPayments = useMemo(() => payments.slice(0, 6), [payments]);
  const recentInvoices = useMemo(() => invoices.slice(0, 6), [invoices]);

  const refreshing =
    overviewQ.isFetching || usersQ.isFetching || paymentsQ.isFetching || invoicesQ.isFetching;

  return (
    <PageContainer className="px-0 py-0 lg:px-0">
      {/*
        The page names itself, now that the console’s second header is gone.
        Same component and the same `.page-header` styling every other console
        page uses.
      */}
      <PlatformPageHeader
        title="Dashboard"
        description="Workspaces, revenue and what needs a decision, across the whole platform."
        actions={
          <PrimaryAction
          icon={RefreshCw}
          disabled={refreshing}
          onClick={() => {
            void overviewQ.refetch();
            void usersQ.refetch();
            void paymentsQ.refetch();
            void invoicesQ.refetch();
          }}
        >
            {refreshing ? "Refreshing…" : "Refresh"}
          </PrimaryAction>
        }
      />

      <StatGrid
        columns={4}
        items={[
          {
            label: "Workspaces",
            value: total.toLocaleString(),
            icon: Building2,
            tone: "indigo",
            helper: `${workspaces?.pending_payment ?? 0} awaiting payment`,
          },
          {
            label: "Active workspaces",
            value: active.toLocaleString(),
            icon: ShieldCheck,
            tone: "emerald",
            helper: total ? `${Math.round((active / total) * 100)}% of the platform` : "None yet",
          },
          {
            label: "Revenue this month",
            value: money(overview?.revenue_this_month?.amount),
            icon: CircleDollarSign,
            tone: "violet",
            helper: `${overview?.revenue_this_month?.payment_count ?? 0} payments received`,
          },
          {
            label: "Needs attention",
            value: attention.toLocaleString(),
            icon: ClipboardCheck,
            tone: attention > 0 ? "amber" : "cyan",
            helper: `${overview?.pending_approvals ?? 0} approvals · ${overview?.failed_payments ?? 0} failed`,
          },
        ]}
      />

      <StatGrid
        columns={4}
        items={[
          {
            label: "Platform users",
            value: (usersQ.data?.total ?? 0).toLocaleString(),
            icon: Users,
            tone: "sky",
            helper: `${usersQ.data?.platform_admins ?? 0} platform admins`,
          },
          {
            label: "Payments recorded",
            value: payments.length.toLocaleString(),
            icon: CreditCard,
            tone: "teal",
            helper: `${payments.filter((payment) => payment.status === "success").length} settled`,
          },
          {
            label: "Invoices issued",
            value: (invoicesQ.data?.total ?? 0).toLocaleString(),
            icon: ReceiptText,
            tone: "indigo",
            helper: "One per settled payment",
          },
          {
            label: "Gateway",
            value: overview?.gateway?.configured ? "Live" : "Not configured",
            icon: Layers3,
            tone: overview?.gateway?.configured ? "emerald" : "rose",
            helper: overview?.gateway?.driver ?? "—",
          },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard
          icon={Layers3}
          tone="violet"
          title="Subscriptions by plan"
          description="Where the platform's workspaces actually sit."
          actions={
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link to="/platform-admin/subscriptions">Open subscriptions</Link>
            </Button>
          }
        >
          {(overview?.subscriptions_by_plan ?? []).length === 0 ? (
            <EmptyNote icon={Inbox} text="No subscriptions yet." />
          ) : (
            <ul className="space-y-2">
              {(overview?.subscriptions_by_plan ?? []).map((row) => {
                const share = total ? Math.round((row.count / total) * 100) : 0;

                return (
                  <li
                    key={row.plan_code}
                    className="flex items-center gap-3 rounded-xl border border-border p-3"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {row.plan_name}
                      </span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${share}%` }}
                        />
                      </span>
                    </span>

                    <span className="shrink-0 text-right">
                      <span className="block font-data text-sm font-bold text-foreground">
                        {row.count}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">{share}%</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          icon={CreditCard}
          tone="teal"
          title="Recent payments"
          description="The last charges put through the gateway."
          actions={
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link to="/platform-admin/payments">Open payments</Link>
            </Button>
          }
        >
          {recentPayments.length === 0 ? (
            <EmptyNote icon={Inbox} text="No payments recorded yet." />
          ) : (
            <ul className="space-y-2">
              {recentPayments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex items-center gap-3 rounded-xl border border-border p-3"
                >
                  {/* Settled, failed and still-in-flight are the three states
                      an operator scans this list for. */}
                  <span
                    aria-hidden="true"
                    className={`h-8 w-1.5 shrink-0 rounded-full ${
                      payment.status === "success"
                        ? "bg-emerald-500"
                        : payment.status === "failed"
                          ? "bg-rose-500"
                          : "bg-amber-500"
                    }`}
                  />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {payment.tenant_name ?? "Unknown workspace"}
                    </span>
                    <span className="block truncate font-data text-[11px] text-muted-foreground">
                      {payment.reference_id}
                    </span>
                  </span>

                  <span className="shrink-0 text-right">
                    <span className="block font-data text-sm font-semibold text-foreground">
                      {money(payment.amount, payment.currency)}
                    </span>
                    <span className="block text-[11px] capitalize text-muted-foreground">
                      {payment.status} · {shortDate(payment.created_at)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard
        icon={ReceiptText}
        tone="indigo"
        title="Recent invoices"
        description="Receipts issued after a payment settled."
        actions={
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <Link to="/platform-admin/invoices">Open invoices</Link>
          </Button>
        }
      >
        {recentInvoices.length === 0 ? (
          <EmptyNote icon={Inbox} text="No invoices issued yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">Invoice</th>
                  <th className="px-3 py-2 font-semibold">Workspace</th>
                  <th className="px-3 py-2 font-semibold">Plan</th>
                  <th className="px-3 py-2 font-semibold">Period</th>
                  <th className="px-3 py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {recentInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-3 py-2.5 font-data text-xs font-semibold text-foreground">
                      {invoice.invoice_no}
                    </td>
                    <td className="px-3 py-2.5 text-foreground">{invoice.tenant_name ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{invoice.plan_name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {shortDate(invoice.period_start)} → {shortDate(invoice.period_end)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-data font-semibold text-foreground">
                      {money(invoice.amount, invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </PageContainer>
  );
}
