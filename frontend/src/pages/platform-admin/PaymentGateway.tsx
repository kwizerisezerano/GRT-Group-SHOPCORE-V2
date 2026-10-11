import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  ServerCog,
  Smartphone,
  TrendingUp,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { PlatformStatusBadge } from "@/pages/platform-admin/components/PlatformStatusBadge";
import {
  platformSubscriptionApi,
  type PaymentLogEntry,
  type PaymentTransaction,
} from "@/lib/subscriptionApi";

/**
 * The payment gateway, from the inside.
 *
 * Two panels because support asks two different questions. The ledger answers
 * "did this workspace pay"; the log answers "then why did nothing happen" —
 * the request we sent, what LMBTech answered, and every callback it posted
 * afterwards, in order, with the payer's details masked.
 *
 * The manual reconcile is here rather than hidden in a script because the
 * case it exists for is common and time-sensitive: a bank transfer landed,
 * the gateway will never call back about it, and somebody is waiting to get
 * into their workspace.
 */

const money = (value: string | number | null | undefined, currency = "RWF") =>
  value === null || value === undefined
    ? "—"
    : `${currency} ${Math.round(Number(value)).toLocaleString()}`;

const dateTime = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";

const STATUS_TONES: Record<string, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  pending: "text-amber-600 dark:text-amber-400",
  failed: "text-rose-600 dark:text-rose-400",
  cancelled: "text-muted-foreground",
};

const DIRECTION_META: Record<
  string,
  { label: string; icon: React.ReactNode; tone: string }
> = {
  request: {
    label: "Sent",
    icon: <ArrowUpRight className="h-3.5 w-3.5" />,
    tone: "border-blue-500/25 bg-blue-500/10 text-primary dark:text-blue-300",
  },
  response: {
    label: "Answered",
    icon: <ArrowDownLeft className="h-3.5 w-3.5" />,
    tone: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  callback: {
    label: "Callback",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    tone: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  status_check: {
    label: "Polled",
    icon: <RefreshCw className="h-3.5 w-3.5" />,
    tone: "border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  },
  error: {
    label: "Error",
    icon: <XCircle className="h-3.5 w-3.5" />,
    tone: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
};

export default function PaymentGateway() {
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"payments" | "logs">("payments");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [openReference, setOpenReference] = useState<string | null>(null);

  const paymentsQuery = useQuery({
    queryKey: ["platform", "payments", statusFilter, search],
    queryFn: () => platformSubscriptionApi.payments({ status: statusFilter, search }),
    enabled: tab === "payments",
  });

  const logsQuery = useQuery({
    queryKey: ["platform", "payment-logs", directionFilter],
    queryFn: () => platformSubscriptionApi.paymentLogs({ direction: directionFilter }),
    enabled: tab === "logs",
  });

  const payments = paymentsQuery.data?.payments ?? [];
  const totals = paymentsQuery.data?.totals ?? [];
  const gateway = paymentsQuery.data?.gateway;

  const summary = useMemo(() => {
    const byStatus = new Map(totals.map((total) => [total.status, total]));
    return {
      collected: Number(byStatus.get("success")?.amount ?? 0),
      successCount: byStatus.get("success")?.count ?? 0,
      pending: byStatus.get("pending")?.count ?? 0,
      failed: byStatus.get("failed")?.count ?? 0,
    };
  }, [totals]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["platform", "payments"] });
    queryClient.invalidateQueries({ queryKey: ["platform", "payment-logs"] });
  };

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        eyebrow="Money"
        title="Payment gateway"
        description="Every subscription charge that has gone through LMBTech Pay — MTN Mobile Money, Airtel Money and card — with the full request, response and callback trail behind each one."
        actions={
          <Button variant="outline" className="rounded-xl font-bold" onClick={refresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {gateway && !gateway.configured && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              The live gateway is selected but has no credentials
            </p>
            <p className="mt-1 text-xs font-semibold leading-5 text-amber-700 dark:text-amber-300">
              Set LMB_APP_KEY and LMB_SECRET_KEY on the API. Until then every charge is refused
              locally rather than sent unauthenticated.
            </p>
          </div>
        </div>
      )}

      {gateway?.driver === "mock" && (
        <div className="flex items-start gap-3 rounded-2xl border border-blue-500/25 bg-blue-500/10 p-4">
          <ServerCog className="mt-0.5 h-5 w-5 shrink-0 text-primary dark:text-blue-400" />
          <div>
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
              Running on the simulator
            </p>
            <p className="mt-1 text-xs font-semibold leading-5 text-primary dark:text-blue-300">
              PAYMENTS_DRIVER is set to <code className="font-mono">mock</code>: charges settle
              themselves a few seconds after they start, and no real money moves. Switch to{" "}
              <code className="font-mono">lmbtech</code> to go live.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PlatformKpiCard
          tone="emerald"
          icon={<TrendingUp className="h-5 w-5" />}
          label="Collected"
          value={money(summary.collected)}
          helper={`${summary.successCount} successful payments`}
        />
        <PlatformKpiCard
          tone="orange"
          icon={<Clock3 className="h-5 w-5" />}
          label="In flight"
          value={String(summary.pending)}
          helper="Awaiting a PIN or a callback"
        />
        <PlatformKpiCard
          tone="rose"
          icon={<XCircle className="h-5 w-5" />}
          label="Failed"
          value={String(summary.failed)}
          helper="Declined, cancelled or timed out"
        />
        <PlatformKpiCard
          tone="blue"
          icon={<ServerCog className="h-5 w-5" />}
          label="Driver"
          value={gateway?.driver === "mock" ? "Simulator" : "LMBTech Pay"}
          helper={gateway?.configured ? "Configured" : "Missing credentials"}
        />
      </div>

      <div className="rounded-3xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="flex rounded-xl border border-border p-1">
            {(["payments", "logs"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={`rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                  tab === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {value === "payments" ? "Ledger" : "Gateway log"}
              </button>
            ))}
          </div>

          {tab === "payments" ? (
            <>
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search reference or workspace…"
                  className="h-11 rounded-xl pl-10"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-11 w-44 rounded-xl font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="success">Successful</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </>
          ) : (
            <Select value={directionFilter} onValueChange={setDirectionFilter}>
              <SelectTrigger className="h-11 w-48 rounded-xl font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everything</SelectItem>
                <SelectItem value="request">Requests sent</SelectItem>
                <SelectItem value="response">Gateway answers</SelectItem>
                <SelectItem value="callback">Callbacks received</SelectItem>
                <SelectItem value="status_check">Status polls</SelectItem>
                <SelectItem value="error">Errors</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {tab === "payments" ? (
          <PaymentsTable
            payments={payments}
            loading={paymentsQuery.isLoading}
            onOpen={setOpenReference}
          />
        ) : (
          <LogsTable logs={logsQuery.data ?? []} loading={logsQuery.isLoading} onOpen={setOpenReference} />
        )}
      </div>

      {openReference && (
        <PaymentDetailDialog
          referenceId={openReference}
          onClose={() => setOpenReference(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

function PaymentsTable({
  payments,
  loading,
  onOpen,
}: {
  payments: PaymentTransaction[];
  loading: boolean;
  onOpen: (referenceId: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="p-16 text-center">
        <Wallet className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-4 text-sm font-semibold text-foreground">No payments yet</p>
        <p className="mt-1 text-xs font-semibold text-muted-foreground">
          Charges appear here the moment a workspace starts one.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px]">
        <thead>
          <tr className="border-b border-border text-left">
            {["Reference", "Workspace", "Method", "Amount", "Status", "Started", ""].map((heading) => (
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
          {payments.map((payment) => (
            <tr
              key={payment.id}
              className="cursor-pointer border-b border-border/60 transition last:border-0 hover:bg-muted/40"
              onClick={() => onOpen(payment.reference_id)}
            >
              <td className="px-4 py-3.5">
                <p className="font-mono text-xs font-bold text-foreground">{payment.reference_id}</p>
                {payment.provider_txn_id && (
                  <p className="mt-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
                    {payment.provider_txn_id}
                  </p>
                )}
              </td>

              <td className="px-4 py-3.5">
                <p className="text-xs font-semibold text-foreground">{payment.tenant_name ?? "—"}</p>
                <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
                  {payment.plan_code ?? "—"}
                </p>
              </td>

              <td className="px-4 py-3.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold capitalize text-foreground">
                  {payment.gateway_method === "card" ? (
                    <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  {(payment.payment_method_code ?? "—").replace(/_/g, " ")}
                </span>
              </td>

              <td className="px-4 py-3.5 font-data text-xs font-semibold text-foreground">
                {money(payment.amount, payment.currency)}
              </td>

              <td className="px-4 py-3.5">
                <PlatformStatusBadge status={payment.status} />
              </td>

              <td className="px-4 py-3.5 text-[11px] font-semibold text-muted-foreground">
                {dateTime(payment.initiated_at)}
              </td>

              <td className="px-4 py-3.5 text-right">
                <Button variant="ghost" size="sm" className="rounded-lg font-bold">
                  <FileText className="mr-1.5 h-3.5 w-3.5" />
                  Trail
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LogsTable({
  logs,
  loading,
  onOpen,
}: {
  logs: PaymentLogEntry[];
  loading: boolean;
  onOpen: (referenceId: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="p-16 text-center">
        <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-4 text-sm font-semibold text-foreground">Nothing logged yet</p>
        <p className="mt-1 text-xs font-semibold text-muted-foreground">
          Every exchange with the gateway lands here — requests, answers, callbacks and failures.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {logs.map((log) => {
        const meta = DIRECTION_META[log.direction] ?? DIRECTION_META.request;

        return (
          <button
            key={log.id}
            type="button"
            onClick={() => log.reference_id && onOpen(log.reference_id)}
            className="flex w-full items-start gap-4 p-4 text-left transition hover:bg-muted/40"
          >
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${meta.tone}`}
            >
              {meta.icon}
              {meta.label}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-foreground">{log.event}</span>
                {log.reference_id && (
                  <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                    {log.reference_id}
                  </span>
                )}
                {log.result_status && (
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wide ${
                      STATUS_TONES[log.result_status] ?? "text-muted-foreground"
                    }`}
                  >
                    {log.result_status}
                  </span>
                )}
              </div>

              <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">
                {log.error_message ?? log.message ?? "—"}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-[11px] font-bold text-muted-foreground">{dateTime(log.created_at)}</p>
              <p className="mt-0.5 font-data text-[10px] font-semibold text-muted-foreground">
                {log.http_status ? `HTTP ${log.http_status}` : ""}
                {log.duration_ms !== null && log.duration_ms !== undefined
                  ? ` · ${log.duration_ms}ms`
                  : ""}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PaymentDetailDialog({
  referenceId,
  onClose,
  onChanged,
}: {
  referenceId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [reconciling, setReconciling] = useState(false);
  const [note, setNote] = useState("");

  const detailQuery = useQuery({
    queryKey: ["platform", "payment", referenceId],
    queryFn: () => platformSubscriptionApi.payment(referenceId),
  });

  const refresh = useMutation({
    mutationFn: () => platformSubscriptionApi.refreshPayment(referenceId),
    onSuccess: () => {
      toast.success("Asked the gateway again.");
      queryClient.invalidateQueries({ queryKey: ["platform", "payment", referenceId] });
      onChanged();
    },
    onError: (error: any) => toast.error(error?.message ?? "The gateway could not be reached."),
  });

  const reconcile = useMutation({
    mutationFn: () =>
      platformSubscriptionApi.reconcilePayment(referenceId, { status: "success", note }),
    onSuccess: () => {
      toast.success("Marked as paid. The workspace has been opened.");
      setReconciling(false);
      queryClient.invalidateQueries({ queryKey: ["platform", "payment", referenceId] });
      onChanged();
    },
    onError: (error: any) => toast.error(error?.message ?? "The payment could not be reconciled."),
  });

  const detail = detailQuery.data;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-3xl">
        {detailQuery.isLoading || !detail ? (
          <div className="flex items-center justify-center p-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-3 text-lg font-semibold">
                <span className="font-mono">{detail.payment.reference_id}</span>
                <PlatformStatusBadge status={detail.payment.status} />
              </DialogTitle>
              <DialogDescription className="font-medium">
                {detail.payment.tenant_name ?? "Unknown workspace"} ·{" "}
                {money(detail.payment.amount, detail.payment.currency)} ·{" "}
                {(detail.payment.payment_method_code ?? "").replace(/_/g, " ")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailRow label="Gateway transaction" value={detail.payment.provider_txn_id ?? "—"} mono />
                <DetailRow label="Payer" value={detail.payment.payer_email ?? "—"} />
                <DetailRow label="Started" value={dateTime(detail.payment.initiated_at)} />
                <DetailRow label="Completed" value={dateTime(detail.payment.completed_at)} />
                <DetailRow label="Callbacks received" value={String(detail.payment.callback_count)} />
                <DetailRow label="Gateway said" value={detail.payment.status_detail ?? "—"} />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl font-bold"
                  disabled={refresh.isPending}
                  onClick={() => refresh.mutate()}
                >
                  {refresh.isPending ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  )}
                  Ask the gateway again
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl font-bold"
                  onClick={() => {
                    navigator.clipboard?.writeText(detail.payment.reference_id);
                    toast.success("Reference copied.");
                  }}
                >
                  <Copy className="mr-2 h-3.5 w-3.5" />
                  Copy reference
                </Button>

                {detail.payment.status !== "success" && (
                  <Button
                    size="sm"
                    className="rounded-xl font-semibold"
                    onClick={() => setReconciling(true)}
                  >
                    <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                    Mark as paid
                  </Button>
                )}
              </div>

              {reconciling && (
                <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
                    <Ban className="h-4 w-4" />
                    Settling this by hand
                  </p>
                  <p className="mt-1.5 text-xs font-semibold leading-5 text-amber-700 dark:text-amber-300">
                    This opens the workspace exactly as a real callback would. Only do it when you have
                    confirmed the money arrived — a bank statement line, or the gateway's own
                    dashboard. The note below goes into the audit trail.
                  </p>

                  <Textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={2}
                    placeholder="e.g. BK transfer ref 88213 confirmed on the statement of 26 Aug"
                    className="mt-3 rounded-xl bg-card"
                  />

                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      className="rounded-xl font-semibold"
                      disabled={reconcile.isPending || note.trim().length < 4}
                      onClick={() => reconcile.mutate()}
                    >
                      {reconcile.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                      Confirm payment
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-xl font-bold"
                      onClick={() => setReconciling(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Gateway conversation
                </h3>

                <div className="mt-3 space-y-3">
                  {detail.logs.map((log) => (
                    <LogEntry key={log.id} log={log} />
                  ))}
                </div>
              </section>
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

function LogEntry({ log }: { log: PaymentLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const meta = DIRECTION_META[log.direction] ?? DIRECTION_META.request;
  const payload = log.response_payload ?? log.request_payload;

  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-3.5">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-start gap-3 text-left"
      >
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${meta.tone}`}
        >
          {meta.icon}
          {meta.label}
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs font-bold text-foreground">{log.event}</p>
          <p className="mt-0.5 text-xs font-semibold leading-5 text-muted-foreground">
            {log.error_message ?? log.message ?? "—"}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[10px] font-bold text-muted-foreground">{dateTime(log.created_at)}</p>
          {log.http_status && (
            <p className="font-data text-[10px] font-semibold text-muted-foreground">
              HTTP {log.http_status}
            </p>
          )}
        </div>
      </button>

      {expanded && payload !== null && payload !== undefined && (
        <pre className="mt-3 max-h-64 overflow-auto rounded-xl border border-border bg-card p-3 font-mono text-[11px] leading-5 text-foreground">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <p className={`mt-1 break-words text-xs font-bold text-foreground ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
    </div>
  );
}
