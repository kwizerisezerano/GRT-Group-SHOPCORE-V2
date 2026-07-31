import { Activity, LockKeyhole, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlatformStatusBadge } from "@/pages/platform-admin/components/PlatformStatusBadge";
import { formatDateTime } from "../tenant360Utils";
import {
  DataList,
  RowCard,
  ScoreCard,
  Section,
} from "../components/Tenant360Primitives";
import type { Tenant360PendingAction } from "../components/Tenant360Types";

export function SecurityTab({
  data,
  metrics,
  busy,
  setPendingAction,
  setConfirmationText,
}: {
  data: any;
  metrics: any;
  busy: boolean;
  setPendingAction: (value: Tenant360PendingAction) => void;
  setConfirmationText: (value: string) => void;
}) {
  return (
    <>
      <ScoreCard
        title="Security Score"
        score={metrics.securityScore}
        tone="emerald"
        items={[
          "Support access governance",
          "User access visibility",
          "Session review",
          "Audit coverage",
        ]}
      />

      <Section
        title="Support Access Sessions"
        icon={<LockKeyhole className="h-5 w-5" />}
      >
        <DataList
          items={data?.impersonationSessions ?? []}
          empty="No support access sessions recorded."
          render={(session: any) => (
            <RowCard key={session.id}>
              <div>
                <p className="font-black text-slate-950">
                  {session.reason || "Support access"}
                </p>

                <p className="mt-1 text-xs font-bold text-slate-500">
                  Started: {formatDateTime(session.started_at)}
                  {session.expires_at
                    ? ` · Expires: ${formatDateTime(session.expires_at)}`
                    : ""}
                  {session.last_seen_at
                    ? ` · Last seen: ${formatDateTime(session.last_seen_at)}`
                    : ""}
                </p>

                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                  Access level: {session.access_level || "support"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <PlatformStatusBadge status={session.status} />

                {session.status === "active" && (
                  <Button
                    variant="outline"
                    className="rounded-xl border-rose-200 bg-rose-50 font-black text-rose-700 hover:bg-rose-100"
                    disabled={busy}
                    onClick={() => {
                      setConfirmationText("");
                      setPendingAction({
                        type: "end_support_access",
                        title: "End support access?",
                        description:
                          "This will close the active support access session for this workspace.",
                        sessionId: session.id,
                        confirmText: "END",
                      });
                    }}
                  >
                    <StopCircle className="mr-2 h-4 w-4" />
                    End
                  </Button>
                )}
              </div>
            </RowCard>
          )}
        />
      </Section>

      <Section
        title="Support Access Audit Trail"
        icon={<Activity className="h-5 w-5" />}
      >
        <DataList
          items={data?.impersonationLogs ?? []}
          empty="No support access audit records found."
          render={(log: any) => (
            <RowCard key={log.id}>
              <div>
                <p className="font-black text-slate-950">
                  {log.action || "Support access event"}
                </p>

                <p className="mt-1 text-xs font-medium text-slate-500">
                  {log.description || "Security activity recorded."}
                </p>

                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                  {formatDateTime(log.created_at)}
                </p>
              </div>
            </RowCard>
          )}
        />
      </Section>
    </>
  );
}