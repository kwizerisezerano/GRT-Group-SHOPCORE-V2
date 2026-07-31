import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Clock, CheckCircle, XCircle, User, Building2, Calendar, CreditCard } from "lucide-react";
import { format } from "date-fns";

export default function SubscriptionApprovals() {
  const queryClient = useQueryClient();
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null);

  const { data: pendingSubscriptions, isLoading } = useQuery({
    queryKey: ["pending-subscription-approvals"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tenant_subscriptions")
        .select(`
          *,
          public_subscription_plan_catalogs (
            code,
            name
          ),
          tenant:tenants(id, name),
          requester:auth.users(id, email)
        `)
        .eq("approval_status", "pending")
        .order("requested_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const { data, error } = await (supabase as any).rpc("approve_subscription", {
        p_subscription_id: subscriptionId,
        p_admin_user_id: (await supabase.auth.getUser()).data.user?.id,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Subscription approved successfully");
      queryClient.invalidateQueries({ queryKey: ["pending-subscription-approvals"] });
      setSelectedSubscription(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to approve subscription");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ subscriptionId, reason }: { subscriptionId: string; reason: string }) => {
      const { data, error } = await (supabase as any).rpc("reject_subscription", {
        p_subscription_id: subscriptionId,
        p_admin_user_id: (await supabase.auth.getUser()).data.user?.id,
        p_rejection_reason: reason,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Subscription rejected");
      queryClient.invalidateQueries({ queryKey: ["pending-subscription-approvals"] });
      setSelectedSubscription(null);
      setRejectionReason("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to reject subscription");
    },
  });

  const handleApprove = (subscriptionId: string) => {
    approveMutation.mutate(subscriptionId);
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    rejectMutation.mutate({
      subscriptionId: selectedSubscription.id,
      reason: rejectionReason,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Subscription Approvals</h2>
          <p className="text-muted-foreground">
            Review and approve pending subscription requests
          </p>
        </div>
        <Badge variant="outline" className="text-lg">
          {pendingSubscriptions?.length || 0} Pending
        </Badge>
      </div>

      {!pendingSubscriptions || pendingSubscriptions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No pending subscription requests</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pendingSubscriptions.map((subscription: any) => (
            <Card key={subscription.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">
                        {subscription.public_subscription_plan_catalogs?.name || 'Unknown Plan'} Plan
                      </CardTitle>
                      <Badge variant="outline">Pending</Badge>
                    </div>
                    <CardDescription className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {subscription.requester?.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Building2 className="h-4 w-4" />
                        {subscription.tenant?.name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(subscription.requested_at), "MMM d, yyyy")}
                      </span>
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">
                      {new Intl.NumberFormat('rw-RW', {
                        style: 'currency',
                        currency: subscription.subscription_currency || 'RWF',
                      }).format(subscription.subscription_amount)}
                    </p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {subscription.billing_cycle.replace('_', ' ')}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Plan Code</p>
                    <p className="font-semibold capitalize">{subscription.public_subscription_plan_catalogs?.code || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Billing Cycle</p>
                    <p className="font-semibold capitalize">{subscription.billing_cycle.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Billing Months</p>
                    <p className="font-semibold">{subscription.billing_months}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Discount</p>
                    <p className="font-semibold">{subscription.subscription_discount_percent}%</p>
                  </div>
                </div>

                {selectedSubscription?.id === subscription.id ? (
                  <div className="space-y-4 border-t pt-4">
                    <div>
                      <Label htmlFor="rejection-reason">Rejection Reason</Label>
                      <Textarea
                        id="rejection-reason"
                        placeholder="Please provide a reason for rejecting this subscription request"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleReject()}
                        disabled={rejectMutation.isPending}
                        variant="destructive"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                      <Button
                        onClick={() => setSelectedSubscription(null)}
                        variant="outline"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 border-t pt-4">
                    <Button
                      onClick={() => handleApprove(subscription.id)}
                      disabled={approveMutation.isPending}
                      className="flex-1"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => setSelectedSubscription(subscription)}
                      disabled={approveMutation.isPending}
                      variant="outline"
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
