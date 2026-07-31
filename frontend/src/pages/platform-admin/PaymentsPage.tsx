import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  RefreshCw,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { PlatformPageHeader } from "@/pages/platform-admin/components/PlatformPageHeader";
import { PlatformKpiCard } from "@/pages/platform-admin/components/PlatformKpiCard";
import { PlatformSearchBar } from "@/pages/platform-admin/components/PlatformSearchBar";
import { PlatformStatusBadge } from "@/pages/platform-admin/components/PlatformStatusBadge";
import Tenant360Drawer from "@/pages/platform-admin/components/Tenant360Drawer";
import { toast } from "sonner";

type PaymentAttempt = {
  id: string;
  tenant_id: string | null;
  invoice_id: string | null;
  amount: number;
  currency: string;
  payment_method: string | null;
  provider: string | null;
  provider_reference: string | null;
  status: string;
  failure_reason: string | null;
  attempted_at: string | null;
  verified_at: string | null;
  tenants?: { name?: string | null } | null;
  subscription_invoices?: {
    invoice_no?: string | null;
    status?: string | null;
  } | null;
};


function money(amount?: number | null, currency = "RWF") {
  return `${currency} ${Number(amount || 0).toLocaleString()}`;
}

export default function PaymentsPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  const attemptsQ = useQuery({
    queryKey: ["platform-payments"],
    queryFn: async (): Promise<PaymentAttempt[]> => {
      const { data, error } = await (supabase as any)
        .from("payment_attempts")
        .select(`
          id, tenant_id, invoice_id, amount, currency, payment_method,
          provider, provider_reference, status, failure_reason,
          attempted_at, verified_at, tenants (name),
          subscription_invoices (invoice_no, status)
        `)
        .order("attempted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const attempts = attemptsQ.data ?? [];
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return attempts.filter((attempt) =>
      !q ||
      attempt.tenants?.name?.toLowerCase().includes(q) ||
      attempt.subscription_invoices?.invoice_no?.toLowerCase().includes(q) ||
      attempt.payment_method?.toLowerCase().includes(q) ||
      attempt.provider?.toLowerCase().includes(q) ||
      attempt.provider_reference?.toLowerCase().includes(q) ||
      attempt.status?.toLowerCase().includes(q)
    );
  }, [attempts, search]);

  const stats = useMemo(() => {
    const paid = attempts.filter((item) => item.status === "paid");
    const pending = attempts.filter((item) => item.status === "pending");
    const failed = attempts.filter((item) => item.status === "failed");
    return {
      total: attempts.length,
      paid: paid.length,
      pending: pending.length,
      failed: failed.length,
      revenue: paid.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    };
  }, [attempts]);

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        eyebrow={t("platformAdmin.pages.payments.eyebrow")}
        title={t("platformAdmin.pages.payments.title")}
        description={t("platformAdmin.pages.payments.description")}
        actions={
          <Button
            className="rounded-xl bg-primary font-black text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              attemptsQ.refetch();
              toast.info(t("platformAdmin.pages.payments.refreshing"));
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("actions.refresh")}
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-5">
        <PlatformKpiCard icon={<WalletCards className="h-6 w-6" />} label={t("platformAdmin.pages.payments.metrics.attempts")} value={stats.total.toLocaleString()} tone="blue" />
        <PlatformKpiCard icon={<CheckCircle2 className="h-6 w-6" />} label={t("status.paid")} value={stats.paid.toLocaleString()} tone="emerald" />
        <PlatformKpiCard icon={<CreditCard className="h-6 w-6" />} label={t("status.pending")} value={stats.pending.toLocaleString()} tone="orange" />
        <PlatformKpiCard icon={<AlertCircle className="h-6 w-6" />} label={t("status.failed")} value={stats.failed.toLocaleString()} tone="rose" />
        <PlatformKpiCard icon={<ReceiptText className="h-6 w-6" />} label={t("platformAdmin.pages.payments.metrics.verifiedRevenue")} value={money(stats.revenue)} tone="violet" />
      </div>

      <div className="rounded-[2rem] border border-border bg-card p-5 text-card-foreground shadow-sm">
        <div className="mb-5">
          <PlatformSearchBar value={search} onChange={setSearch} placeholder={t("platformAdmin.pages.payments.search")} />
        </div>

        {attemptsQ.isLoading ? (
          <div className="py-12 text-center text-sm font-bold text-muted-foreground">{t("common.loading")}</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm font-bold text-muted-foreground">{t("common.noData")}</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[1220px] text-left text-sm">
              <thead className="bg-muted/40 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t("platformAdmin.table.workspace")}</th>
                  <th className="px-4 py-3">{t("platformAdmin.table.invoice")}</th>
                  <th className="px-4 py-3">{t("platformAdmin.table.amount")}</th>
                  <th className="px-4 py-3">{t("platformAdmin.table.method")}</th>
                  <th className="px-4 py-3">{t("platformAdmin.table.provider")}</th>
                  <th className="px-4 py-3">{t("platformAdmin.table.reference")}</th>
                  <th className="px-4 py-3">{t("platformAdmin.table.status")}</th>
                  <th className="px-4 py-3">{t("platformAdmin.table.attempted")}</th>
                  <th className="px-4 py-3 text-right">{t("platformAdmin.table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((attempt) => (
                  <tr key={attempt.id} className="border-t border-border">
                    <td className="px-4 py-4">
                      <p className="font-black text-foreground">{attempt.tenants?.name || "—"}</p>
                      <p className="mt-1 text-xs font-medium text-muted-foreground">{attempt.tenant_id || "—"}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-black text-foreground">{attempt.subscription_invoices?.invoice_no || "—"}</p>
                      <p className="mt-1 text-xs font-bold text-muted-foreground">{attempt.subscription_invoices?.status || "—"}</p>
                    </td>
                    <td className="px-4 py-4 font-black text-foreground">{money(attempt.amount, attempt.currency)}</td>
                    <td className="px-4 py-4 capitalize">{attempt.payment_method || "manual"}</td>
                    <td className="px-4 py-4 capitalize">{attempt.provider || "platform"}</td>
                    <td className="px-4 py-4"><p className="max-w-[190px] truncate font-bold text-muted-foreground">{attempt.provider_reference || "—"}</p></td>
                    <td className="px-4 py-4"><PlatformStatusBadge status={attempt.status} /></td>
                    <td className="px-4 py-4">{attempt.attempted_at ? new Date(attempt.attempted_at).toLocaleString() : "—"}</td>
                    <td className="px-4 py-4 text-right">
                      <Button variant="outline" className="rounded-xl border-blue-200 bg-blue-50 font-black text-blue-700 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/35 dark:text-blue-300" disabled={!attempt.tenant_id} onClick={() => setSelectedTenantId(attempt.tenant_id)}>
                        {t("actions.view")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Tenant360Drawer open={!!selectedTenantId} tenantId={selectedTenantId} onClose={() => setSelectedTenantId(null)} />
    </div>
  );
}