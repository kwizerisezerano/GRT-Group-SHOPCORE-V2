import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  CreditCard,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type WorkspaceRow = {
  id: string;
  name: string;
  subscription_plan: string | null;
  subscription_status: string | null;
  payment_status: string | null;
  workspace_status: string | null;
  trial_status: string | null;
  trial_ends_at: string | null;
  onboarding_completed: boolean | null;
  created_at?: string | null;
};

export default function SuperAdminSubscriptions() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const workspacesQ = useQuery({
    queryKey: ["super-admin-subscriptions"],
    queryFn: async (): Promise<WorkspaceRow[]> => {
      const { data, error } = await (supabase as any)
        .from("tenants")
        .select(
          "id, name, subscription_plan, subscription_status, payment_status, workspace_status, trial_status, trial_ends_at, onboarding_completed, created_at",
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const activatePayment = useMutation({
    mutationFn: async (tenantId: string) => {
      const { error } = await (supabase as any).rpc(
        "activate_workspace_after_payment",
        {
          p_tenant_id: tenantId,
          // One pass over the timestamp's separators. replaceAll is ES2021 and
          // this project compiles to ES2020, so the chain did not typecheck.
          //
          // The dash sits last in the character class deliberately. Leading
          // with it puts a bracket, a name, a colon and a value in that order,
          // which is exactly the shape of a Tailwind arbitrary property — so
          // the class scanner lifted it out of this file and emitted a
          // nonsense declaration into the bundled stylesheet, which esbuild
          // then warned about on every build. Same character set, no longer
          // mistakable for a utility class. Keep it this way round.
          p_payment_reference: `MANUAL-${new Date()
            .toISOString()
            .replace(/[:.TZ-]/g, "")
            .slice(0, 14)}`,
        },
      );

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Workspace activated successfully.");
      qc.invalidateQueries({ queryKey: ["super-admin-subscriptions"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Activation failed.");
    },
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return (workspacesQ.data ?? []).filter((row) => {
      if (!q) return true;
      return (
        row.name?.toLowerCase().includes(q) ||
        row.subscription_plan?.toLowerCase().includes(q) ||
        row.payment_status?.toLowerCase().includes(q) ||
        row.workspace_status?.toLowerCase().includes(q)
      );
    });
  }, [search, workspacesQ.data]);

  const pendingCount = rows.filter(
    (row) => row.workspace_status !== "active" && row.payment_status !== "paid",
  ).length;

  const activeCount = rows.filter(
    (row) => row.workspace_status === "active" || row.payment_status === "paid",
  ).length;

  return (
    <main className="min-h-screen bg-muted/40 px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-foreground">
              Super Admin
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground">
              Subscription Activation Center
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-muted-foreground">
              Review pending workspaces, confirm manual payments, and activate
              subscriptions after payment verification.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="rounded-xl border-border font-black"
              onClick={() =>
                qc.invalidateQueries({
                  queryKey: ["super-admin-subscriptions"],
                })
              }
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>

            <Button asChild className="rounded-xl bg-[#070b67] font-black">
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.5rem] border border-border bg-muted/40 p-5">
            <Store className="h-6 w-6 text-foreground" />
            <p className="mt-4 text-sm font-black text-foreground">
              Total Workspaces
            </p>
            <p className="mt-1 text-3xl font-black text-foreground">
              {rows.length}
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-orange-500/25 bg-orange-500/10 p-5">
            <CreditCard className="h-6 w-6 text-orange-700" />
            <p className="mt-4 text-sm font-black text-orange-800 dark:text-orange-200">
              Pending Activation
            </p>
            <p className="mt-1 text-3xl font-black text-orange-800 dark:text-orange-200">
              {pendingCount}
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-emerald-500/25 bg-emerald-500/10 p-5">
            <ShieldCheck className="h-6 w-6 text-emerald-700" />
            <p className="mt-4 text-sm font-black text-emerald-800 dark:text-emerald-200">
              Active Subscriptions
            </p>
            <p className="mt-1 text-3xl font-black text-emerald-800 dark:text-emerald-200">
              {activeCount}
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-5 flex min-h-12 items-center gap-3 rounded-2xl border border-border bg-muted/40 px-4">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search workspace, package, payment status, or workspace status..."
              className="border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
          </div>

          {workspacesQ.isLoading ? (
            <div className="py-12 text-center text-sm font-bold text-muted-foreground">
              Loading workspaces...
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-sm font-bold text-muted-foreground">
              No workspaces found.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="data-table" style={{ minWidth: 920 }}>
                <thead>
                  <tr>
                    <th>Workspace</th>
                    <th>Package</th>
                    <th>Payment</th>
                    <th>Workspace Status</th>
                    <th>Trial</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row) => {
                    const isActive =
                      row.payment_status === "paid" ||
                      row.workspace_status === "active";

                    return (
                      <tr key={row.id} className="border-t border-border">
                        <td>
                          <p className="font-black text-foreground">
                            {row.name}
                          </p>
                          <p className="mt-1 text-xs font-medium text-muted-foreground">
                            {row.id}
                          </p>
                        </td>

                        <td>
                          <Badge
                            variant="outline"
                            className="rounded-full capitalize"
                          >
                            {row.subscription_plan || "pending"}
                          </Badge>
                        </td>

                        <td>
                          <Badge
                            variant="outline"
                            className={
                              row.payment_status === "paid"
                                ? "rounded-full border-emerald-500/25 bg-emerald-500/10 text-emerald-700"
                                : "rounded-full border-orange-500/25 bg-orange-500/10 text-orange-700"
                            }
                          >
                            {row.payment_status || "unpaid"}
                          </Badge>
                        </td>

                        <td>
                          <Badge
                            variant="outline"
                            className={
                              row.workspace_status === "active"
                                ? "rounded-full border-emerald-500/25 bg-emerald-500/10 text-emerald-700"
                                : "rounded-full border-orange-500/25 bg-orange-500/10 text-orange-700"
                            }
                          >
                            {row.workspace_status || "pending"}
                          </Badge>
                        </td>

                        <td>
                          <p className="font-bold capitalize text-foreground">
                            {row.trial_status || "none"}
                          </p>
                          {row.trial_ends_at && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Ends:{" "}
                              {new Date(row.trial_ends_at).toLocaleDateString()}
                            </p>
                          )}
                        </td>

                        <td className="text-right">
                          <Button
                            className="rounded-xl bg-[#070b67] font-black"
                            disabled={isActive || activatePayment.isPending}
                            onClick={() => activatePayment.mutate(row.id)}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {isActive ? "Activated" : "Mark Paid"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
