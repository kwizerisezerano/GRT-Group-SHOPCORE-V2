import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Clock,
  Headphones,
  RefreshCw,
  ShieldCheck,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PlatformStatusBadge } from "@/pages/platform-admin/components/PlatformStatusBadge";

function formatDateTime(value?: string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleString();
}

function remainingMinutes(expiresAt?: string | null) {
  if (!expiresAt) return 0;

  return Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 60000),
  );
}

export default function ActiveSupportSessions() {
  const sessionsQ = useQuery({
    queryKey: ["platform-active-support-sessions"],
    queryFn: async () => {
      await (supabase as any).rpc("expire_platform_impersonation_sessions");

      const { data, error } = await (supabase as any)
        .from("platform_active_support_sessions")
        .select("*")
        .order("started_at", { ascending: false });

      if (error) throw error;

      return data ?? [];
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("platform-active-support-sessions-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "platform_impersonation_sessions",
        },
        () => {
          sessionsQ.refetch();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionsQ]);

  const metrics = useMemo(() => {
    const sessions = sessionsQ.data ?? [];

    return {
      active: sessions.length,
      readonly: sessions.filter((item: any) => item.access_level === "readonly")
        .length,
      support: sessions.filter((item: any) => item.access_level === "support")
        .length,
      full: sessions.filter((item: any) => item.access_level === "full").length,
    };
  }, [sessionsQ.data]);

  const endSession = async (sessionId: string) => {
    try {
      const { error } = await (supabase as any).rpc(
        "end_platform_impersonation",
        {
          p_session_id: sessionId,
        },
      );

      if (error) throw error;

      toast.success("Support session ended.");
      await sessionsQ.refetch();
    } catch (error: any) {
      toast.error(error?.message || "Could not end support session.");
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-blue-200 bg-blue-50 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
              Platform Support Monitoring
            </p>

            <h1 className="mt-2 text-3xl font-black text-slate-950">
              Active Support Sessions
            </h1>

            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-blue-800">
              Live view of platform support access currently opened across
              customer workspaces.
            </p>
          </div>

          <Button
            variant="outline"
            className="rounded-xl border-blue-200 bg-white font-black text-blue-700 hover:bg-blue-100"
            onClick={() => sessionsQ.refetch()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Active Sessions" value={metrics.active} tone="blue" />
        <Metric label="Read-only" value={metrics.readonly} tone="cyan" />
        <Metric label="Support" value={metrics.support} tone="orange" />
        <Metric label="Full Access" value={metrics.full} tone="rose" />
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
            <Headphones className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-lg font-black text-slate-950">
              Live Sessions
            </h2>

            <p className="text-xs font-bold text-slate-500">
              Updates live and auto-refreshes every 30 seconds.
            </p>
          </div>
        </div>

        {sessionsQ.isLoading ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-700">
            Loading active support sessions...
          </div>
        ) : sessionsQ.isError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
            Failed to load active support sessions.
          </div>
        ) : !sessionsQ.data?.length ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">
            No active support sessions right now.
          </div>
        ) : (
          <div className="space-y-3">
            {sessionsQ.data.map((session: any) => (
              <div
                key={session.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-slate-950">
                        {session.tenant_name || "Customer Workspace"}
                      </p>

                      <PlatformStatusBadge status={session.status} />

                      <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-orange-700">
                        {session.access_level || "support"}
                      </span>
                    </div>

                    <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                      {session.reason || "Support access"}
                    </p>

                    <div className="mt-3 grid gap-2 text-xs font-bold text-slate-500 md:grid-cols-2 xl:grid-cols-4">
                      <Info
                        icon={<User className="h-4 w-4" />}
                        label="Admin"
                        value={
                          session.platform_admin_name ||
                          session.platform_admin_email ||
                          "Platform admin"
                        }
                      />

                      <Info
                        icon={<Activity className="h-4 w-4" />}
                        label="Started"
                        value={formatDateTime(session.started_at)}
                      />

                      <Info
                        icon={<Clock className="h-4 w-4" />}
                        label="Remaining"
                        value={`${remainingMinutes(session.expires_at)} min`}
                      />

                      <Info
                        icon={<ShieldCheck className="h-4 w-4" />}
                        label="Last Seen"
                        value={formatDateTime(session.last_seen_at)}
                      />
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="rounded-xl border-rose-200 bg-white font-black text-rose-700 hover:bg-rose-50"
                    onClick={() => endSession(session.id)}
                  >
                    End Session
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "blue" | "cyan" | "orange" | "rose";
}) {
  const colors: Record<string, string> = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-700",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>

      <p
        className={`mt-3 inline-flex rounded-xl border px-3 py-2 text-2xl font-black ${colors[tone]}`}
      >
        {value}
      </p>
    </div>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-white px-3 py-2">
      <span className="mt-0.5 text-slate-400">{icon}</span>

      <span>
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
          {label}
        </p>

        <p className="mt-1 text-xs font-bold text-slate-700">{value}</p>
      </span>
    </div>
  );
}