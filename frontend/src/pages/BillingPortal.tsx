import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  CreditCard,
  Download,
  FileText,
  RefreshCw,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PlatformStatusBadge } from "@/pages/platform-admin/components/PlatformStatusBadge";
import InvoicePreviewModal from "@/pages/platform-admin/components/InvoicePreviewModal";

type InvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
};

type Invoice = {
  id: string;
  invoice_no: string | null;
  status: string;
  currency: string;
  subtotal: number;
  tax_total: number;
  discount_total: number;
  total: number;
  due_date: string | null;
  paid_at: string | null;
  created_at: string | null;
  tenants?: { name?: string | null } | null;
  invoice_items?: InvoiceItem[];
};

function money(value?: number | null, currency = "RWF") {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
}

export default function BillingPortal() {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const billingQ = useQuery({
    queryKey: ["tenant-billing-portal"],
    queryFn: async () => {
      const { data: member } = await (supabase as any)
        .from("tenant_members")
        .select("tenant_id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .maybeSingle();

      if (!member?.tenant_id) {
        throw new Error("No workspace billing profile found.");
      }

      const [tenantRes, subscriptionRes, invoicesRes] = await Promise.all([
        (supabase as any)
          .from("tenants")
          .select("id, name, payment_status, workspace_status, subscription_status, renewal_date")
          .eq("id", member.tenant_id)
          .maybeSingle(),

        (supabase as any)
          .from("tenant_subscriptions")
          .select("id, plan_code, status, billing_cycle, current_period_end, trial_ends_at")
          .eq("tenant_id", member.tenant_id)
          .maybeSingle(),

        (supabase as any)
          .from("subscription_invoices")
          .select(`
            id,
            invoice_no,
            status,
            currency,
            subtotal,
            tax_total,
            discount_total,
            total,
            due_date,
            paid_at,
            created_at,
            tenants (name),
            invoice_items (
              id,
              description,
              quantity,
              unit_price,
              total
            )
          `)
          .eq("tenant_id", member.tenant_id)
          .order("created_at", { ascending: false }),
      ]);

      if (tenantRes.error) throw tenantRes.error;
      if (subscriptionRes.error) throw subscriptionRes.error;
      if (invoicesRes.error) throw invoicesRes.error;

      return {
        tenant: tenantRes.data,
        subscription: subscriptionRes.data,
        invoices: (invoicesRes.data ?? []) as Invoice[],
      };
    },
  });

  const invoices = billingQ.data?.invoices ?? [];

  const stats = useMemo(() => {
    return {
      totalInvoices: invoices.length,
      paidInvoices: invoices.filter((item) => item.status === "paid").length,
      pendingInvoices: invoices.filter(
        (item) => item.status !== "paid" && item.status !== "void",
      ).length,
      outstanding: invoices
        .filter((item) => item.status !== "paid" && item.status !== "void")
        .reduce((sum, item) => sum + Number(item.total || 0), 0),
    };
  }, [invoices]);

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 lg:px-8">
          <div className="flex items-center gap-3">
            <img
              src="/shopcore-icon.png"
              alt="ShopCore"
              className="h-11 w-11 object-contain"
            />
            <div>
              <p className="text-lg font-black text-slate-950">
                ShopCore Cloud
              </p>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
                Billing Portal
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            className="rounded-xl font-black"
            onClick={() => {
              billingQ.refetch();
              toast.info("Refreshing billing profile...");
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl space-y-6 px-4 py-8 lg:px-8">
        {billingQ.isLoading ? (
          <div className="rounded-[2rem] border border-blue-200 bg-blue-50 p-8 text-center font-bold text-blue-700">
            Loading billing portal...
          </div>
        ) : billingQ.isError ? (
          <div className="rounded-[2rem] border border-rose-200 bg-rose-50 p-8 text-center font-bold text-rose-700">
            Could not load billing portal.
          </div>
        ) : (
          <>
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                Workspace Billing
              </p>
              <h1 className="mt-3 text-3xl font-black text-slate-950">
                {billingQ.data?.tenant?.name || "Workspace"}
              </h1>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                View subscription status, invoice history, payment status and
                renewal information for your ShopCore Cloud workspace.
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-4">
              <PortalCard
                icon={<ShieldCheck className="h-6 w-6" />}
                label="Subscription"
                value={billingQ.data?.subscription?.status || "pending"}
                tone="emerald"
              />
              <PortalCard
                icon={<WalletCards className="h-6 w-6" />}
                label="Plan"
                value={billingQ.data?.subscription?.plan_code || "starter"}
                tone="blue"
              />
              <PortalCard
                icon={<CalendarClock className="h-6 w-6" />}
                label="Renewal"
                value={
                  billingQ.data?.subscription?.current_period_end
                    ? new Date(
                        billingQ.data.subscription.current_period_end,
                      ).toLocaleDateString()
                    : "Pending"
                }
                tone="violet"
              />
              <PortalCard
                icon={<CreditCard className="h-6 w-6" />}
                label="Outstanding"
                value={money(stats.outstanding)}
                tone="orange"
              />
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Invoice History
                  </p>
                  <h2 className="mt-2 text-xl font-black text-slate-950">
                    Billing Documents
                  </h2>
                </div>

                <div className="flex gap-2">
                  <PlatformStatusBadge
                    status={`${stats.paidInvoices} paid`}
                  />
                  <PlatformStatusBadge
                    status={`${stats.pendingInvoices} pending`}
                  />
                </div>
              </div>

              <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Due Date</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="border-t border-slate-200">
                        <td className="px-4 py-4">
                          <p className="font-black text-slate-950">
                            {invoice.invoice_no || invoice.id}
                          </p>
                          <p className="mt-1 text-xs font-bold text-slate-500">
                            {(invoice.invoice_items ?? [])[0]?.description ||
                              "Subscription invoice"}
                          </p>
                        </td>

                        <td className="px-4 py-4 font-black text-slate-950">
                          {money(invoice.total, invoice.currency)}
                        </td>

                        <td className="px-4 py-4">
                          <PlatformStatusBadge status={invoice.status} />
                        </td>

                        <td className="px-4 py-4">
                          {invoice.due_date
                            ? new Date(invoice.due_date).toLocaleDateString()
                            : "Not set"}
                        </td>

                        <td className="px-4 py-4">
                          {invoice.created_at
                            ? new Date(invoice.created_at).toLocaleDateString()
                            : "No date"}
                        </td>

                        <td className="px-4 py-4 text-right">
                          <Button
                            variant="outline"
                            className="rounded-xl font-black"
                            onClick={() => setSelectedInvoice(invoice)}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            View / PDF
                          </Button>
                        </td>
                      </tr>
                    ))}

                    {!invoices.length && (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-10 text-center text-sm font-bold text-slate-500"
                        >
                          No invoices found for this workspace.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>

      <InvoicePreviewModal
        open={!!selectedInvoice}
        invoice={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
      />
    </main>
  );
}

function PortalCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone: "blue" | "emerald" | "orange" | "violet";
}) {
  const toneClass = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
  }[tone];

  return (
    <div className={`rounded-[1.5rem] border p-5 shadow-sm ${toneClass}`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/80">
        {icon}
      </div>
      <p className="mt-5 text-xs font-black uppercase tracking-[0.16em]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black capitalize">{value}</p>
    </div>
  );
}