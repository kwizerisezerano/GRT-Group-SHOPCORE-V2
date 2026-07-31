import { Building2, CheckCircle2, Clock, ListChecks, XCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DataPanel,
  EmptyState,
  MetricCard,
  PageShell,
  StatusPill,
  dateTime,
  usePlatformQuery,
} from "./PlatformOperationsSuite";

type RequestStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "completed";

export default function WorkspaceRequests() {
  const requestsQ = usePlatformQuery({
    key: "platform-workspace-requests",
    query: async () => {
      const { data, error } = await (supabase as any)
        .from("platform_workspace_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const updateRequest = useMutation({
    mutationFn: async ({
      requestId,
      status,
      notes,
    }: {
      requestId: string;
      status: RequestStatus;
      notes?: string;
    }) => {
      const { error } = await (supabase as any).rpc(
        "update_platform_workspace_request_status",
        {
          p_request_id: requestId,
          p_status: status,
          p_notes: notes ?? null,
        },
      );

      if (error) throw error;
    },
    onSuccess: async (_, variables) => {
      toast.success(`Workspace request marked as ${variables.status}.`);
      await Promise.all([
        requestsQ.refetch(),
      ]);
    },
    onError: (error: any) =>
      toast.error(error?.message || "Workspace request update failed."),
  });

  const requests = requestsQ.data ?? [];
  const pending = requests.filter((item: any) =>
    ["pending", "in_review"].includes(item.status),
  ).length;
  const urgent = requests.filter((item: any) => item.priority === "urgent").length;
  const approved = requests.filter((item: any) => item.status === "approved").length;

  const handleStatus = (requestId: string, status: RequestStatus) => {
    updateRequest.mutate({ requestId, status });
  };

  return (
    <PageShell
      eyebrow="Customer Success"
      title="Workspace Requests"
      description="Manage workspace provisioning, trial requests, upgrades, onboarding, and enterprise workspace approvals."
      icon={<Building2 className="h-7 w-7" />}
      onRefresh={() => requestsQ.refetch()}
    >
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Total Requests" value={requests.length} />
        <MetricCard label="Open Review" value={pending} tone="orange" />
        <MetricCard label="Urgent" value={urgent} tone="rose" />
        <MetricCard label="Approved" value={approved} tone="emerald" />
      </section>

      <DataPanel title="Request Queue">
        {requestsQ.isLoading ? (
          <EmptyState text="Loading workspace requests..." />
        ) : !requests.length ? (
          <EmptyState text="No workspace requests found." />
        ) : (
          <div className="space-y-3">
            {requests.map((item: any) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-slate-950">
                        {item.company_name ||
                          item.requester_name ||
                          "Workspace request"}
                      </p>

                      <StatusPill status={item.priority} />
                      <StatusPill status={item.status} />
                    </div>

                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {item.request_type} · {item.requester_email || "No email"} ·{" "}
                      {dateTime(item.created_at)}
                    </p>

                    <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                      {item.notes ||
                        item.requested_plan ||
                        "No request notes provided."}
                    </p>

                    {item.requested_plan && (
                      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Requested plan: {item.requested_plan}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    {item.status === "pending" && (
                      <ActionButton
                        label="Review"
                        icon={<Clock className="h-4 w-4" />}
                        tone="orange"
                        disabled={updateRequest.isPending}
                        onClick={() => handleStatus(item.id, "in_review")}
                      />
                    )}

                    {["pending", "in_review"].includes(item.status) && (
                      <>
                        <ActionButton
                          label="Approve"
                          icon={<CheckCircle2 className="h-4 w-4" />}
                          tone="emerald"
                          disabled={updateRequest.isPending}
                          onClick={() => handleStatus(item.id, "approved")}
                        />

                        <ActionButton
                          label="Reject"
                          icon={<XCircle className="h-4 w-4" />}
                          tone="rose"
                          disabled={updateRequest.isPending}
                          onClick={() => handleStatus(item.id, "rejected")}
                        />
                      </>
                    )}

                    {item.status === "approved" && (
                      <ActionButton
                        label="Complete"
                        icon={<ListChecks className="h-4 w-4" />}
                        tone="blue"
                        disabled={updateRequest.isPending}
                        onClick={() => handleStatus(item.id, "completed")}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DataPanel>
    </PageShell>
  );
}

function ActionButton({
  label,
  icon,
  tone,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  tone: "blue" | "emerald" | "orange" | "rose";
  disabled?: boolean;
  onClick: () => void;
}) {
  const tones: Record<string, string> = {
    blue: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    orange:
      "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100",
    rose: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-60",
        tones[tone],
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}