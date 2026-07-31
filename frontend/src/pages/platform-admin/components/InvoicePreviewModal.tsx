import { Download, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlatformStatusBadge } from "@/pages/platform-admin/components/PlatformStatusBadge";
import { useTranslation } from "@/hooks/useTranslation";

type InvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
};

type InvoicePreviewModalProps = {
  open: boolean;
  onClose: () => void;
  invoice: {
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
    tenants?: {
      name?: string | null;
    } | null;
    invoice_items?: InvoiceItem[];
  } | null;
};


export default function InvoicePreviewModal({
  open,
  onClose,
  invoice,
}: InvoicePreviewModalProps) {
  const { t, formatDate, formatNumber, formatCurrency } = useTranslation();

  if (!open || !invoice) return null;

  const printInvoice = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/50 px-4 py-6 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-[2rem] bg-card shadow-[0_30px_90px_-40px_rgba(15,23,42,0.9)]">
        <div className="no-print flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
              {t("platformAdmin.invoicePreview.title")}
            </p>
            <h2 className="mt-1 text-xl font-black text-foreground">
              {invoice.invoice_no || invoice.id}
            </h2>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="rounded-xl font-black"
              onClick={printInvoice}
            >
              <Printer className="mr-2 h-4 w-4" />
              {t("platformAdmin.invoicePreview.print")}
            </Button>

            <Button
              className="rounded-xl bg-[#070b67] font-black hover:bg-[#050950]"
              onClick={printInvoice}
            >
              <Download className="mr-2 h-4 w-4" />
              {t("platformAdmin.invoicePreview.savePdf")}
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="rounded-xl"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-muted/40 p-6 print:bg-card print:p-0">
          <div className="invoice-print-area mx-auto max-w-4xl rounded-[1.5rem] bg-card p-8 shadow-sm print:max-w-none print:rounded-none print:shadow-none">
            <div className="flex items-start justify-between gap-8 border-b border-border pb-8">
              <div className="flex items-center gap-4">
                <img
                  src="/shopcore-icon.png"
                  alt="ShopCore"
                  className="h-16 w-16 object-contain"
                />
                <div>
                  <h1 className="text-2xl font-black text-foreground">
                    ShopCore Cloud
                  </h1>
                  <p className="mt-1 text-sm font-bold text-muted-foreground">
                    {t("app.description")}
                  </p>
                  <p className="mt-3 text-xs font-bold leading-5 text-muted-foreground">
                    Kigali, Rwanda
                    <br />
                    billing@shopcore.app
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
                  {t("platformAdmin.table.invoice")}
                </p>
                <h2 className="mt-2 text-2xl font-black text-foreground">
                  {invoice.invoice_no || invoice.id}
                </h2>
                <div className="mt-3 inline-flex">
                  <PlatformStatusBadge status={invoice.status} />
                </div>
              </div>
            </div>

            <div className="grid gap-6 border-b border-border py-8 md:grid-cols-2">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                  {t("platformAdmin.invoicePreview.billedTo")}
                </p>
                <h3 className="mt-3 text-xl font-black text-foreground">
                  {invoice.tenants?.name || "Customer Workspace"}
                </h3>
                <p className="mt-2 text-sm font-medium text-muted-foreground">
                  {t("platformAdmin.invoicePreview.subscriptionWorkspace")}
                </p>
              </div>

              <div className="grid gap-3 text-sm">
                <InvoiceMeta
                  label={t("platformAdmin.invoicePreview.invoiceDate")}
                  value={
                    invoice.created_at
                      ? formatDate(invoice.created_at)
                      : "—"
                  }
                />
                <InvoiceMeta
                  label={t("platformAdmin.table.dueDate")}
                  value={
                    invoice.due_date
                      ? formatDate(invoice.due_date)
                      : "—"
                  }
                />
                <InvoiceMeta
                  label={t("platformAdmin.invoicePreview.paidDate")}
                  value={
                    invoice.paid_at
                      ? formatDate(invoice.paid_at)
                      : t("platformAdmin.invoicePreview.notPaid")
                  }
                />
              </div>
            </div>

            <div className="py-8">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                    <th className="py-3">{t("platformAdmin.invoicePreview.description")}</th>
                    <th className="py-3 text-right">{t("platformAdmin.invoicePreview.quantity")}</th>
                    <th className="py-3 text-right">{t("platformAdmin.invoicePreview.unitPrice")}</th>
                    <th className="py-3 text-right">{t("platformAdmin.invoicePreview.total")}</th>
                  </tr>
                </thead>

                <tbody>
                  {(invoice.invoice_items ?? []).map((item) => (
                    <tr key={item.id} className="border-b border-border">
                      <td className="py-4 font-bold text-foreground">
                        {item.description}
                      </td>
                      <td className="py-4 text-right font-bold text-muted-foreground">
                        {formatNumber(item.quantity)}
                      </td>
                      <td className="py-4 text-right font-bold text-muted-foreground">
                        {formatCurrency(item.unit_price, invoice.currency)}
                      </td>
                      <td className="py-4 text-right font-black text-foreground">
                        {formatCurrency(item.total, invoice.currency)}
                      </td>
                    </tr>
                  ))}

                  {!invoice.invoice_items?.length && (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-8 text-center font-bold text-muted-foreground"
                      >
                        {t("platformAdmin.invoicePreview.noItems")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end border-t border-border pt-6">
              <div className="w-full max-w-sm space-y-3">
                <AmountRow
                  label={t("platformAdmin.invoicePreview.subtotal")}
                  value={formatCurrency(invoice.subtotal, invoice.currency)}
                />
                <AmountRow
                  label={t("platformAdmin.invoicePreview.discount")}
                  value={formatCurrency(invoice.discount_total, invoice.currency)}
                />
                <AmountRow
                  label={t("platformAdmin.invoicePreview.tax")}
                  value={formatCurrency(invoice.tax_total, invoice.currency)}
                />

                <div className="flex items-center justify-between rounded-2xl bg-blue-50 px-4 py-4">
                  <span className="text-sm font-black uppercase tracking-[0.14em] text-blue-700">
                    Total
                  </span>
                  <span className="text-2xl font-black text-blue-950">
                    {formatCurrency(invoice.total, invoice.currency)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-10 rounded-2xl border border-border bg-slate-50 p-5">
              <p className="text-sm font-black text-foreground">
                {t("platformAdmin.invoicePreview.paymentInstructions")}
              </p>
              <p className="mt-2 text-sm font-medium leading-6 text-muted-foreground">
                {t("platformAdmin.invoicePreview.paymentInstructionsDescription")}
              </p>
            </div>

            <p className="mt-8 text-center text-xs font-bold text-muted-foreground">
              {t("platformAdmin.invoicePreview.generatedBy")}
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }

          .invoice-print-area,
          .invoice-print-area * {
            visibility: visible;
          }

          .invoice-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function InvoiceMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border pb-2">
      <span className="font-bold text-muted-foreground">{label}</span>
      <span className="font-black text-foreground">{value}</span>
    </div>
  );
}

function AmountRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4">
      <span className="text-sm font-bold text-muted-foreground">{label}</span>
      <span className="text-sm font-black text-foreground">{value}</span>
    </div>
  );
}