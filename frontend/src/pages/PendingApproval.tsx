import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function PendingApproval() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    fetchSubscriptionStatus();
  }, [user, navigate]);

  const fetchSubscriptionStatus = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("tenant_subscriptions")
        .select(`
          *,
          public_subscription_plan_catalogs (
            code,
            name
          )
        `)
        .eq("user_id", user.id)
        .eq("approval_status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      setSubscription(data);

      // If subscription is approved, show success and redirect to payment or dashboard
      if (data?.approval_status === "approved") {
        if (data.payment_status === "pending_payment") {
          // Get plan code from joined data
          const planCode = data.public_subscription_plan_catalogs?.code || data.plan_id;
          navigate(`/onboarding/payment/${data.tenant_id}?plan=${planCode}&billing=${data.billing_cycle}`);
        } else if (data.payment_status === "paid") {
          toast.success("Your plan has been upgraded successfully!");
          navigate("/dashboard");
        }
      } else if (data?.approval_status === "rejected") {
        // Show rejection message
      }
    } catch (error) {
      console.error("Error fetching subscription status:", error);
      toast.error("Failed to check subscription status");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchSubscriptionStatus();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>No Subscription Request Found</CardTitle>
            <CardDescription>
              You don't have any pending subscription requests.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/dashboard")} className="w-full">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
            <Clock className="h-8 w-8 text-blue-600 dark:text-blue-300" />
          </div>
          <CardTitle className="text-2xl">Subscription Pending Approval</CardTitle>
          <CardDescription>
            Your subscription request is being reviewed by an administrator
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Plan</span>
              <span className="font-semibold">{subscription.public_subscription_plan_catalogs?.name || 'Unknown Plan'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Billing Cycle</span>
              <span className="font-semibold capitalize">{subscription.billing_cycle.replace('_', ' ')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Amount</span>
              <span className="font-semibold">
                {new Intl.NumberFormat('rw-RW', {
                  style: 'currency',
                  currency: subscription.subscription_currency || 'RWF',
                }).format(subscription.subscription_amount)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Status</span>
              <Badge variant="outline" className="capitalize">
                {subscription.approval_status}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Requested</span>
              <span className="text-sm">
                {new Date(subscription.requested_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          {subscription.approval_status === "rejected" && subscription.rejection_reason && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900 dark:text-red-100">Request Rejected</p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    {subscription.rejection_reason}
                  </p>
                </div>
              </div>
            </div>
          )}

          {subscription.approval_status === "approved" && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-green-900 dark:text-green-100">Request Approved</p>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Your subscription has been approved. You can now proceed with payment.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={handleRefresh} variant="outline" className="flex-1">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            {subscription.approval_status === "approved" && (
              <Button onClick={() => navigate(`/onboarding/payment/${subscription.tenant_id}?plan=${subscription.plan_code}&billing=${subscription.billing_cycle}`)} className="flex-1">
                Proceed to Payment
              </Button>
            )}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Contact support if you need assistance with your subscription request.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
