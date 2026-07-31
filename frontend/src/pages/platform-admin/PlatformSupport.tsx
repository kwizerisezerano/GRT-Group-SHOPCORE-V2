import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  Headset,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PlatformPageHeader } from "@/pages/platform-admin/components/PlatformPageHeader";
import { PlatformKpiCard } from "@/pages/platform-admin/components/PlatformKpiCard";
import { PlatformSearchBar } from "@/pages/platform-admin/components/PlatformSearchBar";
import { PlatformStatusBadge } from "@/pages/platform-admin/components/PlatformStatusBadge";
import Tenant360Drawer from "@/pages/platform-admin/components/Tenant360Drawer";
import { toast } from "sonner";

type SupportTicket = {
  id: string;
  ticket_no: string | null;
  tenant_id: string | null;
  subject: string;
  category: string;
  priority: string;
  status: string;
  message: string | null;
  created_at: string | null;
  tenants?: {
    name?: string | null;
  } | null;
};

export default function PlatformSupport() {
  const [search, setSearch] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  const ticketsQ = useQuery({
    queryKey: ["platform-support-tickets"],
    queryFn: async (): Promise<SupportTicket[]> => {
      const { data, error } = await (supabase as any)
        .from("platform_support_tickets")
        .select(
          `
          id,
          ticket_no,
          tenant_id,
          subject,
          category,
          priority,
          status,
          message,
          created_at,
          tenants (
            name
          )
        `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return (ticketsQ.data ?? []).filter((ticket) => {
      if (!q) return true;

      return (
        ticket.ticket_no?.toLowerCase().includes(q) ||
        ticket.tenants?.name?.toLowerCase().includes(q) ||
        ticket.subject.toLowerCase().includes(q) ||
        ticket.category.toLowerCase().includes(q) ||
        ticket.priority.toLowerCase().includes(q) ||
        ticket.status.toLowerCase().includes(q)
      );
    });
  }, [search, ticketsQ.data]);

  const stats = useMemo(() => {
    const tickets = ticketsQ.data ?? [];

    return {
      total: tickets.length,
      open: tickets.filter((ticket) => ticket.status === "open").length,
      review: tickets.filter((ticket) => ticket.status === "in_review").length,
      resolved: tickets.filter((ticket) => ticket.status === "resolved").length,
    };
  }, [ticketsQ.data]);

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        eyebrow="Customer Success"
        title="Support Center"
        description="Manage customer support requests, billing issues, onboarding questions, compliance help and platform incidents from one workspace."
        actions={
          <Button
            className="rounded-xl bg-[#070b67] font-black hover:bg-[#050950]"
            onClick={() => {
              ticketsQ.refetch();
              toast.info("Refreshing support tickets...");
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-1">
        <PlatformKpiCard icon={<Headset className="h-6 w-6" />} label="Total Tickets" value={stats.total.toLocaleString()} tone="blue" />
        <PlatformKpiCard icon={<AlertCircle className="h-6 w-6" />} label="Open" value={stats.open.toLocaleString()} tone="orange" />
        <PlatformKpiCard icon={<Clock className="h-6 w-6" />} label="In Review" value={stats.review.toLocaleString()} tone="violet" />
        <PlatformKpiCard icon={<CheckCircle2 className="h-6 w-6" />} label="Resolved" value={stats.resolved.toLocaleString()} tone="emerald" />
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <PlatformSearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search workspace, issue, category, priority or status..."
          />
        </div>

        {ticketsQ.isLoading ? (
          <div className="py-12 text-center text-sm font-bold text-slate-500">
            Loading support tickets...
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm font-bold text-slate-500">
            No support tickets found.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Ticket</th>
                  <th className="px-4 py-3">Workspace</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((ticket) => (
                  <tr key={ticket.id} className="border-t border-slate-200">
                    <td className="px-4 py-4">
                      <p className="font-black text-slate-950">
                        {ticket.ticket_no || ticket.id}
                      </p>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        {ticket.subject}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <button
                        type="button"
                        className="font-bold text-blue-700 hover:text-blue-900 disabled:text-slate-500"
                        disabled={!ticket.tenant_id}
                        onClick={() => setSelectedTenantId(ticket.tenant_id)}
                      >
                        {ticket.tenants?.name || "Unlinked workspace"}
                      </button>
                    </td>

                    <td className="px-4 py-4">{ticket.category}</td>

                    <td className="px-4 py-4">
                      <PlatformStatusBadge status={ticket.priority} />
                    </td>

                    <td className="px-4 py-4">
                      <PlatformStatusBadge status={ticket.status} />
                    </td>

                    <td className="px-4 py-4">
                      {ticket.created_at
                        ? new Date(ticket.created_at).toLocaleString()
                        : "—"}
                    </td>

                    <td className="px-4 py-4 text-right">
                      <Button
                        variant="outline"
                        className="rounded-xl border-blue-200 bg-blue-50 font-black text-blue-700 hover:bg-blue-100"
                        disabled={!ticket.tenant_id}
                        onClick={() => setSelectedTenantId(ticket.tenant_id)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Tenant360Drawer
        open={!!selectedTenantId}
        tenantId={selectedTenantId}
        onClose={() => setSelectedTenantId(null)}
      />
    </div>
  );
}