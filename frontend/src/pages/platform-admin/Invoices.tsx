import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Download,
  Eye,
  FileDown,
  FileText,
  Filter,
  Landmark,
  RefreshCw,
  ReceiptText,
  Search,
  WalletCards,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlatformPageHeader } from "@/pages/platform-admin/components/PlatformPageHeader";
import { PlatformKpiCard } from "@/pages/platform-admin/components/PlatformKpiCard";
import { PlatformStatusBadge } from "@/pages/platform-admin/components/PlatformStatusBadge";
import Tenant360Drawer from "@/pages/platform-admin/components/Tenant360Drawer";
import InvoicePreviewModal from "@/pages/platform-admin/components/InvoicePreviewModal";
import { toast } from "sonner";

type InvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
};

type PaymentAttempt = {
  id: string;
  amount: number | null;
  currency: string | null;
  payment_method: string | null;
  provider: string | null;
  provider_reference: string | null;
  status: string | null;
  attempted_at: string | null;
  verified_at: string | null;
};

type Invoice = {
  id: string;
  tenant_id: string | null;
  subscription_id: string | null;
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
    subscription_plan?: string | null;
    subscription_status?: string | null;
    payment_status?: string | null;
    workspace_status?: string | null;
  } | null;
  tenant_subscriptions?: {
    plan_code?: string | null;
    status?: string | null;
    billing_cycle?: string | null;
  } | null;
  invoice_items?: InvoiceItem[];
  payment_attempts?: PaymentAttempt[];
};

type InvoiceStatusFilter =
  | "all"
  | "draft"
  | "issued"
  | "overdue"
  | "paid"
  | "void";

function money(
  value: number | null,
  currency?: string | null,
) {
  return `${currency || "RWF"} ${Number(
    value || 0,
  ).toLocaleString()}`;
}

function normalizeStatus(
  value?: string | null,
) {
  return value?.trim().toLowerCase() || "";
}

function formatDateTime(
  value?: string | null,
) {
  if (!value) return "No date";

  return new Date(value).toLocaleString();
}

function formatDate(
  value?: string | null,
) {
  if (!value) return "Not set";

  return new Date(value).toLocaleDateString();
}

function isOverdue(invoice: Invoice) {
  if (!invoice.due_date) return false;

  return (
    normalizeStatus(invoice.status) !== "paid" &&
    normalizeStatus(invoice.status) !== "void" &&
    new Date(invoice.due_date).getTime() <
      Date.now()
  );
}

function escapeCsv(
  value: string | number | null | undefined,
) {
  const safe = String(value ?? "").replace(
    /"/g,
    '""',
  );

  return `"${safe}"`;
}



export default function Invoices() {
  const { t, formatDate, formatDateTime } = useTranslation();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<InvoiceStatusFilter>("all");
  const [selectedTenantId, setSelectedTenantId] =
    useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] =
    useState<Invoice | null>(null);

  const invoicesQ = useQuery({
    queryKey: ["platform-engine-invoices"],
    queryFn: async (): Promise<Invoice[]> => {
      const { data, error } = await (
        supabase as any
      )
        .from("subscription_invoices")
        .select(`
          id,
          tenant_id,
          subscription_id,
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
          tenants (
            name,
            subscription_plan,
            subscription_status,
            payment_status,
            workspace_status
          ),
          tenant_subscriptions (
            plan_code,
            status,
            billing_cycle
          ),
          invoice_items (
            id,
            description,
            quantity,
            unit_price,
            total
          ),
          payment_attempts (
            id,
            amount,
            currency,
            payment_method,
            provider,
            provider_reference,
            status,
            attempted_at,
            verified_at
          )
        `)
        .order("created_at", {
          ascending: false,
        });

      if (error) throw error;

      return data ?? [];
    },
    refetchInterval: 30000,
  });

  const refreshBilling = () => {
    qc.invalidateQueries({
      queryKey: [
        "platform-engine-invoices",
      ],
    });
    qc.invalidateQueries({
      queryKey: [
        "platform-subscription-engine",
      ],
    });
    qc.invalidateQueries({
      queryKey: [
        "platform-payment-attempts",
      ],
    });
    qc.invalidateQueries({
      queryKey: [
        "platform-dashboard-commercial",
      ],
    });
    qc.invalidateQueries({
      queryKey: ["tenant-360"],
    });
  };

  const markPaid = useMutation({
    mutationFn: async (
      invoiceId: string,
    ) => {
      const { error } = await (
        supabase as any
      ).rpc(
        "mark_subscription_invoice_paid",
        {
          p_invoice_id: invoiceId,
          p_payment_method: "manual",
          p_provider: "platform_admin",
          p_provider_reference: `ADMIN-${Date.now()}`,
        },
      );

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(
        "Invoice verified and marked as paid.",
      );
      refreshBilling();
    },
    onError: (error: any) =>
      toast.error(
        error?.message ||
          "Could not mark invoice as paid.",
      ),
  });

  const voidInvoice = useMutation({
    mutationFn: async (
      invoice: Invoice,
    ) => {
      const confirmed = window.confirm(
        `Void invoice ${
          invoice.invoice_no || invoice.id
        }? Paid invoices cannot be voided.`,
      );

      if (!confirmed) {
        return { cancelled: true };
      }

      const { error } = await (
        supabase as any
      ).rpc("void_subscription_invoice", {
        p_invoice_id: invoice.id,
        p_reason:
          "Voided from Platform Admin invoice center.",
      });

      if (error) throw error;

      return { cancelled: false };
    },
    onSuccess: (result) => {
      if (result?.cancelled) return;

      toast.success("Invoice voided.");
      refreshBilling();
    },
    onError: (error: any) =>
      toast.error(
        error?.message ||
          "Could not void invoice.",
      ),
  });

  const invoices = invoicesQ.data ?? [];

  const rows = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return invoices.filter((invoice) => {
      const derivedStatus = isOverdue(invoice)
        ? "overdue"
        : normalizeStatus(invoice.status);

      const matchesStatus =
        statusFilter === "all" ||
        derivedStatus === statusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        invoice.invoice_no
          ?.toLowerCase()
          .includes(query) ||
        invoice.tenants?.name
          ?.toLowerCase()
          .includes(query) ||
        invoice.status
          ?.toLowerCase()
          .includes(query) ||
        invoice.currency
          ?.toLowerCase()
          .includes(query) ||
        invoice.tenant_subscriptions?.plan_code
          ?.toLowerCase()
          .includes(query) ||
        invoice.payment_attempts?.some(
          (attempt) =>
            attempt.provider_reference
              ?.toLowerCase()
              .includes(query) ||
            attempt.provider
              ?.toLowerCase()
              .includes(query) ||
            attempt.payment_method
              ?.toLowerCase()
              .includes(query),
        )
      );
    });
  }, [
    search,
    statusFilter,
    invoices,
  ]);

  const stats = useMemo(() => {
    const paidInvoices = invoices.filter(
      (invoice) =>
        normalizeStatus(invoice.status) ===
        "paid",
    );

    const overdueInvoices =
      invoices.filter(isOverdue);

    const pendingInvoices =
      invoices.filter((invoice) => {
        const status = normalizeStatus(
          invoice.status,
        );

        return ![
          "paid",
          "void",
        ].includes(status);
      });

    const verifiedAttempts =
      invoices.flatMap(
        (invoice) =>
          invoice.payment_attempts ?? [],
      ).filter((attempt) =>
        [
          "paid",
          "verified",
          "completed",
          "successful",
        ].includes(
          normalizeStatus(
            attempt.status,
          ),
        ),
      );

    return {
      total: invoices.length,
      paid: paidInvoices.length,
      pending: pendingInvoices.length,
      overdue: overdueInvoices.length,
      revenue: paidInvoices.reduce(
        (sum, invoice) =>
          sum +
          Number(invoice.total || 0),
        0,
      ),
      verifiedAttempts:
        verifiedAttempts.length,
    };
  }, [invoices]);

  const busy =
    markPaid.isPending ||
    voidInvoice.isPending;

  const exportCsv = () => {
    if (!rows.length) {
      toast.error(
        "There are no invoices to export.",
      );
      return;
    }

    const header = [
      "Invoice Number",
      "Workspace",
      "Plan",
      "Billing Cycle",
      "Status",
      "Currency",
      "Subtotal",
      "Tax",
      "Discount",
      "Total",
      "Due Date",
      "Paid At",
      "Created At",
      "Payment Attempts",
    ];

    const body = rows.map((invoice) => [
      invoice.invoice_no || invoice.id,
      invoice.tenants?.name || "Unknown",
      invoice.tenant_subscriptions
        ?.plan_code ||
        invoice.tenants
          ?.subscription_plan ||
        "",
      invoice.tenant_subscriptions
        ?.billing_cycle || "",
      isOverdue(invoice)
        ? "overdue"
        : invoice.status,
      invoice.currency,
      invoice.subtotal,
      invoice.tax_total,
      invoice.discount_total,
      invoice.total,
      invoice.due_date || "",
      invoice.paid_at || "",
      invoice.created_at || "",
      invoice.payment_attempts?.length || 0,
    ]);

    const csv = [
      header.map(escapeCsv).join(","),
      ...body.map((row) =>
        row.map(escapeCsv).join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement("a");

    anchor.href = url;
    anchor.download = `shopcore-subscription-invoices-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);

    toast.success(
      "Invoice report exported.",
    );
  };

  const statusOptions: Array<{
    value: InvoiceStatusFilter;
    label: string;
  }> = [
    { value: "all", label: "All statuses" },
    { value: "draft", label: "Draft" },
    { value: "issued", label: "Issued" },
    { value: "overdue", label: "Overdue" },
    { value: "paid", label: "Paid" },
    { value: "void", label: "Void" },
  ];

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        eyebrow={t("platformAdmin.pages.invoices.eyebrow")}
        title={t("platformAdmin.pages.invoices.title")}
        description={t("platformAdmin.pages.invoices.description")}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={exportCsv}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Export CSV
            </Button>

            <Button
              className="rounded-xl bg-[#070b67] font-black hover:bg-[#050950]"
              onClick={() => {
                invoicesQ.refetch();
                toast.info(
                  "Refreshing subscription invoices...",
                );
              }}
              disabled={invoicesQ.isFetching}
            >
              <RefreshCw
                className={[
                  "mr-2 h-4 w-4",
                  invoicesQ.isFetching
                    ? "animate-spin"
                    : "",
                ].join(" ")}
              />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <PlatformKpiCard
          icon={
            <ReceiptText className="h-6 w-6" />
          }
          label="Invoices"
          value={stats.total.toLocaleString()}
          tone="blue"
        />

        <PlatformKpiCard
          icon={
            <CheckCircle2 className="h-6 w-6" />
          }
          label="Paid"
          value={stats.paid.toLocaleString()}
          tone="emerald"
        />

        <PlatformKpiCard
          icon={
            <FileText className="h-6 w-6" />
          }
          label="Pending"
          value={stats.pending.toLocaleString()}
          tone="orange"
        />

        <PlatformKpiCard
          icon={
            <AlertTriangle className="h-6 w-6" />
          }
          label="Overdue"
          value={stats.overdue.toLocaleString()}
          tone="rose"
        />

        <PlatformKpiCard
          icon={
            <CreditCard className="h-6 w-6" />
          }
          label="Verified Revenue"
          value={money(stats.revenue)}
          tone="violet"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_auto]">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 dark:bg-blue-950/35 p-5">
          <div className="flex items-start gap-3">
            <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />

            <div>
              <p className="text-sm font-black text-blue-950">
                Trusted verification control
              </p>

              <p className="mt-1 text-xs font-medium leading-5 text-blue-800">
                “Mark Paid” must remain restricted to Platform Admin,
                trusted Edge Functions, provider webhooks or service-role
                backend processes. Customer-facing pages must never call
                the activation RPC directly.
              </p>
            </div>
          </div>
        </div>

        <Button
          asChild
          variant="outline"
          className="h-auto rounded-2xl px-5 py-4"
        >
          <Link to="/platform-admin/payment-attempts">
            <WalletCards className="mr-2 h-5 w-5" />
            Payment Attempts
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="rounded-[2rem] border border-border bg-card p-5 shadow-sm">
        <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search invoice number, workspace, plan, provider reference..."
              className="h-11 rounded-xl pl-10"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />

            {statusOptions.map(
              (option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setStatusFilter(
                      option.value,
                    )
                  }
                  className={[
                    "rounded-xl border px-3 py-2 text-xs font-black transition",
                    statusFilter ===
                    option.value
                      ? "border-blue-200 bg-blue-50 dark:bg-blue-950/35 text-blue-700"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/40",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              ),
            )}
          </div>
        </div>

        {invoicesQ.isLoading ? (
          <div className="py-12 text-center font-bold text-muted-foreground">
            Loading subscription invoices...
          </div>
        ) : invoicesQ.isError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-950/35 p-5 text-sm font-bold text-rose-700">
            {invoicesQ.error instanceof Error
              ? invoicesQ.error.message
              : "Subscription invoices could not be loaded."}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center font-bold text-muted-foreground">
            No subscription invoices match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[1650px]">
              <thead className="bg-muted/40 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">
                    Invoice
                  </th>
                  <th className="px-4 py-3 text-left">
                    Workspace
                  </th>
                  <th className="px-4 py-3 text-left">
                    Package
                  </th>
                  <th className="px-4 py-3 text-left">
                    Items
                  </th>
                  <th className="px-4 py-3 text-left">
                    Subtotal
                  </th>
                  <th className="px-4 py-3 text-left">
                    Tax
                  </th>
                  <th className="px-4 py-3 text-left">
                    Discount
                  </th>
                  <th className="px-4 py-3 text-left">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left">
                    Due Date
                  </th>
                  <th className="px-4 py-3 text-left">
                    Payment Attempts
                  </th>
                  <th className="px-4 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((invoice) => {
                  const normalized =
                    normalizeStatus(
                      invoice.status,
                    );

                  const paid =
                    normalized === "paid";

                  const voided =
                    normalized === "void";

                  const overdue =
                    isOverdue(invoice);

                  const attempts =
                    invoice.payment_attempts ??
                    [];

                  const latestAttempt =
                    attempts[0];

                  const displayStatus =
                    overdue
                      ? "overdue"
                      : invoice.status ||
                        "draft";

                  return (
                    <tr
                      key={invoice.id}
                      className="border-t border-border align-top"
                    >
                      <td className="px-4 py-4">
                        <p className="font-black text-foreground">
                          {invoice.invoice_no ||
                            invoice.id}
                        </p>

                        <p className="mt-1 text-xs font-bold text-muted-foreground">
                          {formatDateTime(
                            invoice.created_at,
                          )}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <button
                          type="button"
                          className="font-bold text-blue-700 hover:text-blue-900 disabled:text-muted-foreground"
                          onClick={() =>
                            setSelectedTenantId(
                              invoice.tenant_id,
                            )
                          }
                          disabled={
                            !invoice.tenant_id
                          }
                        >
                          {invoice.tenants
                            ?.name ||
                            "Unknown"}
                        </button>

                        <p className="mt-1 text-xs font-medium capitalize text-muted-foreground">
                          {String(
                            invoice.tenants
                              ?.workspace_status ||
                              "unknown",
                          ).replace(
                            /_/g,
                            " ",
                          )}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <p className="font-black capitalize text-foreground">
                          {String(
                            invoice
                              .tenant_subscriptions
                              ?.plan_code ||
                              invoice.tenants
                                ?.subscription_plan ||
                              "unassigned",
                          ).replace(
                            /_/g,
                            " ",
                          )}
                        </p>

                        <p className="mt-1 text-xs font-medium capitalize text-muted-foreground">
                          {String(
                            invoice
                              .tenant_subscriptions
                              ?.billing_cycle ||
                              "monthly",
                          ).replace(
                            /_/g,
                            " ",
                          )}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <div className="max-w-[260px] space-y-1">
                          {(
                            invoice.invoice_items ??
                            []
                          )
                            .slice(0, 2)
                            .map((item) => (
                              <p
                                key={item.id}
                                className="truncate text-xs font-bold text-muted-foreground"
                              >
                                {
                                  item.description
                                }
                              </p>
                            ))}

                          {!invoice.invoice_items
                            ?.length && (
                            <p className="text-xs font-bold text-muted-foreground">
                              No items
                            </p>
                          )}

                          {(invoice
                            .invoice_items
                            ?.length || 0) >
                            2 && (
                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-blue-600">
                              +
                              {(invoice
                                .invoice_items
                                ?.length ||
                                0) - 2}{" "}
                              more
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4 font-bold">
                        {money(
                          invoice.subtotal,
                          invoice.currency,
                        )}
                      </td>

                      <td className="px-4 py-4 font-bold">
                        {money(
                          invoice.tax_total,
                          invoice.currency,
                        )}
                      </td>

                      <td className="px-4 py-4 font-bold">
                        {money(
                          invoice.discount_total,
                          invoice.currency,
                        )}
                      </td>

                      <td className="px-4 py-4 font-black text-foreground">
                        {money(
                          invoice.total,
                          invoice.currency,
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <PlatformStatusBadge
                          status={displayStatus}
                        />

                        {paid &&
                          invoice.paid_at && (
                            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-600">
                              Paid{" "}
                              {formatDate(
                                invoice.paid_at,
                              )}
                            </p>
                          )}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-start gap-2">
                          <CalendarClock className="mt-0.5 h-4 w-4 text-muted-foreground" />

                          <div>
                            <p
                              className={[
                                "font-bold",
                                overdue
                                  ? "text-rose-700"
                                  : "text-foreground",
                              ].join(" ")}
                            >
                              {formatDate(
                                invoice.due_date,
                              )}
                            </p>

                            {overdue && (
                              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-rose-600">
                                Payment overdue
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="min-w-[190px]">
                          <p className="font-black text-foreground">
                            {attempts.length}{" "}
                            attempt
                            {attempts.length === 1
                              ? ""
                              : "s"}
                          </p>

                          {latestAttempt ? (
                            <>
                              <p className="mt-1 text-xs font-medium capitalize text-muted-foreground">
                                {String(
                                  latestAttempt.payment_method ||
                                    "unknown",
                                ).replace(
                                  /_/g,
                                  " ",
                                )}
                                {" · "}
                                {String(
                                  latestAttempt.status ||
                                    "pending",
                                ).replace(
                                  /_/g,
                                  " ",
                                )}
                              </p>

                              {latestAttempt.provider_reference && (
                                <p className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">
                                  {
                                    latestAttempt.provider_reference
                                  }
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="mt-1 text-xs font-medium text-muted-foreground">
                              No attempt recorded
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              setSelectedInvoice(
                                invoice,
                              )
                            }
                            title="Preview invoice"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              setSelectedInvoice(
                                invoice,
                              )
                            }
                            title="Download invoice"
                          >
                            <Download className="h-4 w-4" />
                          </Button>

                          <Button
                            className="rounded-xl bg-emerald-600 font-black hover:bg-emerald-700"
                            disabled={
                              paid ||
                              voided ||
                              busy
                            }
                            onClick={() =>
                              markPaid.mutate(
                                invoice.id,
                              )
                            }
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {paid
                              ? "Paid"
                              : "Verify Payment"}
                          </Button>

                          <Button
                            variant="outline"
                            className="rounded-xl border-rose-200 bg-rose-50 dark:bg-rose-950/35 font-black text-rose-700 hover:bg-rose-100"
                            disabled={
                              paid ||
                              voided ||
                              busy
                            }
                            onClick={() =>
                              voidInvoice.mutate(
                                invoice,
                              )
                            }
                          >
                            <Ban className="mr-2 h-4 w-4" />
                            {voided
                              ? "Voided"
                              : "Void"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <InvoicePreviewModal
        open={!!selectedInvoice}
        invoice={selectedInvoice}
        onClose={() =>
          setSelectedInvoice(null)
        }
      />

      <Tenant360Drawer
        open={!!selectedTenantId}
        tenantId={selectedTenantId}
        onClose={() =>
          setSelectedTenantId(null)
        }
      />
    </div>
  );
}
