import {
  CheckCircle2,
  Clock,
  Lock,
  ShieldAlert,
  ShieldOff,
} from "lucide-react";
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

type SessionStatus = "active" | "expired" | "revoked" | "blocked";

export default function LoginSessions() {
  const sessionsQ = usePlatformQuery({
    key: "platform-login-sessions-suite",
    query: async () => {
      const { data, error } = await (supabase as any)
        .from("platform_login_sessions")
        .select("*")
        .order("last_seen_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const updateSession = useMutation({
    mutationFn: async ({
      sessionId,
      status,
    }: {
      sessionId: string;
      status: SessionStatus;
    }) => {
      const { error } = await (supabase as any).rpc(
        "update_platform_login_session_status",
        {
          p_session_id: sessionId,
          p_status: status,
        },
      );

      if (error) throw error;
    },
    onSuccess: async (_, variables) => {
      toast.success(`Login session marked as ${variables.status}.`);
      await sessionsQ.refetch();
    },
    onError: (error: any) =>
      toast.error(error?.message || "Login session update failed."),
  });

  const sessions = sessionsQ.data ?? [];
  const risky = sessions.filter((s: any) => Number(s.risk_score || 0) >= 45)
    .length;

  return (
    <PageShell
      eyebrow="Security Center"
      title="Login Sessions"
      description="Monitor active platform sessions, devices, browsers, IP addresses, MFA state, locations, and session risk."
      icon={<Lock className="h-7 w-7" />}
      onRefresh={() => sessionsQ.refetch()}
    >
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Sessions" value={sessions.length} />
        <MetricCard
          label="Active"
          value={sessions.filter((s: any) => s.status === "active").length}
          tone="emerald"
        />
        <MetricCard label="Risk Review" value={risky} tone="orange" />
        <MetricCard
          label="MFA Verified"
          value={sessions.filter((s: any) => s.mfa_verified).length}
          tone="blue"
        />
      </section>

      <DataPanel title="Session Directory">
        {sessionsQ.isLoading ? (
          <EmptyState text="Loading login sessions..." />
        ) : !sessions.length ? (
          <EmptyState text="No platform login sessions recorded yet." />
        ) : (
          <div className="space-y-3">
            {sessions.map((session: any) => (
              <div
                key={session.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-slate-950">
                        {session.email || "Platform user"}
                      </p>

                      <StatusPill status={session.status} />

                      {session.mfa_verified && (
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-blue-700">
                          MFA Verified
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {session.browser || "Browser"} ·{" "}
                      {session.operating_system || "OS"} ·{" "}
                      {session.device_type || "browser"} ·{" "}
                      {session.ip_address || "No IP"}
                    </p>

                    <p className="mt-2 text-xs font-bold text-slate-500">
                      {session.city || "Unknown city"} ·{" "}
                      {session.country || "Unknown country"} ·{" "}
                      {session.isp || "Unknown ISP"} · Risk{" "}
                      {session.risk_score || 0}/100
                    </p>

                    <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                      Started {dateTime(session.started_at)} · Last seen{" "}
                      {dateTime(session.last_seen_at)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    {session.status !== "active" && (
                      <ActionButton
                        label="Restore"
                        tone="emerald"
                        icon={<CheckCircle2 className="h-4 w-4" />}
                        disabled={updateSession.isPending}
                        onClick={() =>
                          updateSession.mutate({
                            sessionId: session.id,
                            status: "active",
                          })
                        }
                      />
                    )}

                    {session.status === "active" && (
                      <>
                        <ActionButton
                          label="Expire"
                          tone="orange"
                          icon={<Clock className="h-4 w-4" />}
                          disabled={updateSession.isPending}
                          onClick={() =>
                            updateSession.mutate({
                              sessionId: session.id,
                              status: "expired",
                            })
                          }
                        />

                        <ActionButton
                          label="Revoke"
                          tone="rose"
                          icon={<ShieldOff className="h-4 w-4" />}
                          disabled={updateSession.isPending}
                          onClick={() =>
                            updateSession.mutate({
                              sessionId: session.id,
                              status: "revoked",
                            })
                          }
                        />

                        <ActionButton
                          label="Block"
                          tone="rose"
                          icon={<ShieldAlert className="h-4 w-4" />}
                          disabled={updateSession.isPending}
                          onClick={() =>
                            updateSession.mutate({
                              sessionId: session.id,
                              status: "blocked",
                            })
                          }
                        />
                      </>
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
  tone: "emerald" | "orange" | "rose";
  disabled?: boolean;
  onClick: () => void;
}) {
  const tones: Record<string, string> = {
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