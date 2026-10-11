import { CreditCard, FileText } from "lucide-react";
import { PlatformStatusBadge } from "@/pages/platform-admin/components/PlatformStatusBadge";
import { formatDate, money } from "../tenant360Utils";
import {
  DataList,
  KpiCard,
  RowCard,
  Section,
} from "../components/Tenant360Primitives";

export function BillingTab({ data, metrics }: { data: any; metrics: any }) {
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Invoices"
          value={metrics.invoices}
          tone="blue"
          trend="Billing records"
        />

        <KpiCard
          label="Paid Revenue"
          value={money(metrics.revenue)}
          tone="emerald"
          trend="Collected"
        />

        <KpiCard
          label="Outstanding"
          value={money(metrics.outstanding)}
          tone="rose"
          trend="Needs review"
        />
      </section>

      <Section title="Invoices" icon={<FileText className="h-5 w-5" />}>
        <DataList
          items={(data?.invoices ?? []).slice(0, 10)}
          empty="No invoices found."
          render={(invoice: any) => (
            <RowCard key={invoice.id}>
              <div>
                <p className="font-black text-slate-950">
                  {invoice.invoice_no || invoice.id}
                </p>

                <p className="mt-1 text-xs font-bold text-slate-500">
                  {money(invoice.total, invoice.currency)} · Due{" "}
                  {formatDate(invoice.due_date)}
                </p>
              </div>

              <PlatformStatusBadge status={invoice.status} />
            </RowCard>
          )}
        />
      </Section>

      <Section
        title="Payment Attempts"
        icon={<CreditCard className="h-5 w-5" />}
      >
        <DataList
          items={(data?.payments ?? []).slice(0, 10)}
          empty="No payment attempts found."
          render={(payment: any) => (
            <RowCard key={payment.id}>
              <div>
                <p className="font-black text-slate-950">
                  {money(payment.amount, payment.currency)}
                </p>

                <p className="mt-1 text-xs font-bold text-slate-500">
                  {payment.payment_method || "manual"} ·{" "}
                  {payment.provider_reference || "No reference"}
                </p>
              </div>

              <PlatformStatusBadge
                status={payment.status || payment.payment_status}
              />
            </RowCard>
          )}
        />
      </Section>
    </>
  );
}