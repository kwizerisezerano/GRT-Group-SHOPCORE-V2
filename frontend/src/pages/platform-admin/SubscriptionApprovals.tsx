import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformApi, type PlatformSubscription } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlatformPageHeader } from "@/pages/platform-admin/components/PlatformPageHeader";
import { toast } from "sonner";
import {
  Clock,
  CheckCircle,
  XCircle,
  User,
  Building2,
  Calendar,
  Landmark,
  Hash,
  Loader2,
} from "lucide-react";

type Tab = "pending" | "approved" | "rejected";

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatAmount(amount: string | number | null, currency: string | null) {
  const value = Number(amount ?? 0);
  try {
    return new Intl.NumberFormat("en-RW", {
      style: "currency",
      currency: currency || "RWF",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value} ${currency || ""}`.trim();
  }
}

const TAB_META: Record<Tab, { label: string; empty: string; badgeClass: string }> = {
  pending: {
    label: "Pending review",
    empty: "No bank-transfer payments are waiting on review.",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  },
  approved: {
    label: "Approved",
    empty: "Nothing has been approved yet.",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  },
  rejected: {
    label: "Rejected",
    empty: "Nothing has been rejected.",
    badgeClass: "border-rose-500/30 bg-rose-500/10 text-rose-700",
  },
};

export default function SubscriptionApprovals() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("pending");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ["platform-subscriptions", tab],
    queryFn: () => platformApi.subscriptions(tab),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["platform-subscriptions"] });

  const approveMutation = useMutation({
    mutationFn: (id: string) => platformApi.approveSubscription(id),
    onSuccess: () => {
      toast.success("Payment approved. The workspace is now active.");
      invalidate();
    },
    onError: (error: any) => toast.error(error?.message || "Failed to approve this payment."),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => platformApi.rejectSubscription(id, reason),
    onSuccess: () => {
      toast.success("Payment rejected.");
      invalidate();
      setRejectingId(null);
      setRejectionReason("");
    },
    onError: (error: any) => toast.error(error?.message || "Failed to reject this payment."),
  });

  const handleReject = (id: string) => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejecting this payment.");
      return;
    }
    rejectMutation.mutate({ id, reason: rejectionReason.trim() });
  };

  const meta = TAB_META[tab];
  const items = subscriptions ?? [];

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        title="Payment Approvals"
        description="Review bank-transfer payments and activate workspaces once funds are confirmed."
        actions={
          <Badge variant="outline" className={`rounded-full px-3 py-1 text-sm ${meta.badgeClass}`}>
            {isLoading ? "…" : items.length} {meta.label.toLowerCase()}
          </Badge>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="rounded-2xl bg-muted/60 p-1">
          <TabsTrigger value="pending" className="rounded-xl px-4">Pending</TabsTrigger>
          <TabsTrigger value="approved" className="rounded-xl px-4">Approved</TabsTrigger>
          <TabsTrigger value="rejected" className="rounded-xl px-4">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex items-center justify-center rounded-3xl border border-dashed py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading payments...
        </div>
      ) : items.length === 0 ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <Clock className="mb-4 h-10 w-10 text-muted-foreground/50" />
            <p className="text-muted-foreground">{meta.empty}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {items.map((subscription: PlatformSubscription) => {
            const isRejectingThis = rejectingId === subscription.id;
            const isBankTransfer = subscription.payment_method_code === "bank_transfer";

            return (
              <Card key={subscription.id} className="overflow-hidden rounded-3xl shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-lg">{subscription.plan_name} Plan</CardTitle>
                        <Badge variant="outline" className={`rounded-full ${meta.badgeClass}`}>
                          {subscription.approval_status}
                        </Badge>
                        {isBankTransfer && (
                          <Badge variant="outline" className="rounded-full gap-1 border-sky-500/30 bg-sky-500/10 text-sky-700">
                            <Landmark className="h-3 w-3" />
                            Bank transfer
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" />
                          {subscription.tenant_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {subscription.requested_by_name || subscription.requested_by_email || "Unknown"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          Requested {formatDate(subscription.requested_at)}
                        </span>
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold">
                        {formatAmount(subscription.amount, subscription.currency)}
                      </p>
                      <p className="text-sm capitalize text-muted-foreground">
                        {subscription.billing_cycle.replace("_", " ")}
                      </p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 rounded-2xl border bg-muted/30 p-4 md:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Payment method</p>
                      <p className="font-semibold">{subscription.payment_method_name || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Reference</p>
                      <p className="flex items-center gap-1 font-semibold font-mono text-sm">
                        {subscription.payment_reference ? (
                          <>
                            <Hash className="h-3 w-3 text-muted-foreground" />
                            {subscription.payment_reference}
                          </>
                        ) : (
                          "—"
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Subscription start</p>
                      <p className="font-semibold">{formatDate(subscription.current_period_start)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Subscription end</p>
                      <p className="font-semibold">{formatDate(subscription.current_period_end)}</p>
                    </div>
                  </div>

                  {subscription.approval_status === "rejected" && subscription.rejection_reason && (
                    <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">
                      <span className="font-semibold">Rejection reason: </span>
                      {subscription.rejection_reason}
                    </div>
                  )}

                  {subscription.approval_status === "pending" && (
                    isRejectingThis ? (
                      <div className="space-y-3 border-t pt-4">
                        <div>
                          <Label htmlFor={`reason-${subscription.id}`}>Rejection reason</Label>
                          <Textarea
                            id={`reason-${subscription.id}`}
                            placeholder="Explain why this payment could not be verified..."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            rows={3}
                            className="mt-1 rounded-2xl"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleReject(subscription.id)}
                            disabled={rejectMutation.isPending}
                            variant="destructive"
                            className="rounded-2xl"
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Confirm rejection
                          </Button>
                          <Button
                            onClick={() => {
                              setRejectingId(null);
                              setRejectionReason("");
                            }}
                            variant="outline"
                            className="rounded-2xl"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 border-t pt-4">
                        <Button
                          onClick={() => approveMutation.mutate(subscription.id)}
                          disabled={approveMutation.isPending}
                          className="flex-1 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve & open workspace
                        </Button>
                        <Button
                          onClick={() => setRejectingId(subscription.id)}
                          disabled={approveMutation.isPending}
                          variant="outline"
                          className="flex-1 rounded-2xl"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    )
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
