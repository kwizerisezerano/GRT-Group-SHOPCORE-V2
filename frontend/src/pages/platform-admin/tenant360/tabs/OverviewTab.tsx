import {
  Activity,
  AlertTriangle,
  Building2,
  CalendarClock,
  CreditCard,
  Headphones,
  ShieldCheck,
  Users,
} from "lucide-react";
import { PlatformStatusBadge } from "@/pages/platform-admin/components/PlatformStatusBadge";
import { formatDate, formatDateTime, money } from "../tenant360Utils";
import {
  DataList,
  InfoItem,
  RowCard,
  ScoreCard,
  Section,
} from "../components/Tenant360Primitives";

export function OverviewTab({ data, metrics }: { data: any; metrics: any }) {
  const healthStatus = metrics.healthStatus || "healthy";

  const healthDrivers = [
    metrics.outstanding > 0
      ? `Billing review required: ${money(metrics.outstanding)} outstanding`
      : "Billing position clear",
    metrics.tickets > 0
      ? `${metrics.tickets} support ticket(s) require attention`
      : "Support backlog clear",
    metrics.members === 0
      ? "Workspace setup incomplete: no members found"
      : `${metrics.members} workspace user(s) configured`,
    metrics.liveSupportSessions > 0
      ? `${metrics.liveSupportSessions} live support session(s) active`
      : "No live support session active",
  ];

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoItem
          icon={<Building2 className="h-5 w-5" />}
          label="Workspace"
          value={data?.tenant?.name || "Unknown"}
        />

        <InfoItem
          icon={<ShieldCheck className="h-5 w-5" />}
          label="Health Status"
          value={
            <div className="flex items-center gap-2">
              <PlatformStatusBadge status={healthStatus} />
              <span>{metrics.healthScore}%</span>
            </div>
          }
        />

        <InfoItem
          icon={<CalendarClock className="h-5 w-5" />}
          label="Renewal / Period End"
          value={formatDate(data?.subscription?.current_period_end)}
        />

        <InfoItem
          icon={<CreditCard className="h-5 w-5" />}
          label="Outstanding"
          value={money(metrics.outstanding)}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ScoreCard
          title="Workspace Health"
          score={metrics.healthScore}
          tone="blue"
          items={healthDrivers}
        />

        <ScoreCard
          title="Security Position"
          score={metrics.securityScore}
          tone="emerald"
          items={[
            metrics.liveSupportSessions > 0
              ? "Live support access is currently active"
              : "No active support access",
            "Support access control enabled",
            "Session audit trail available",
            "Platform activity monitoring enabled",
          ]}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoItem
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Health Risk"
          value={String(healthStatus).replace(/_/g, " ")}
        />

        <InfoItem
          icon={<Users className="h-5 w-5" />}
          label="Workspace Users"
          value={metrics.members}
        />

        <InfoItem
          icon={<Headphones className="h-5 w-5" />}
          label="Live Support"
          value={metrics.liveSupportSessions || 0}
        />

        <InfoItem
          icon={<ShieldCheck className="h-5 w-5" />}
          label="Subscription"
          value={
            data?.subscription?.plan_code ||
            data?.tenant?.subscription_plan ||
            "Pending"
          }
        />
      </section>

      <Section title="Recent Activity" icon={<Activity className="h-5 w-5" />}>
        <DataList
          items={(data?.events ?? []).slice(0, 8)}
          empty="No activity events found."
          render={(event: any) => (
            <RowCard key={event.id}>
              <div>
                <p className="font-black text-slate-950">
                  {event.title || event.event_type || "Workspace event"}
                </p>

                <p className="mt-1 text-xs font-medium text-slate-500">
                  {event.description || event.event_type || "Activity recorded"}
                </p>

                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                  {formatDateTime(event.created_at)}
                </p>
              </div>

              <PlatformStatusBadge
                status={event.status || event.event_type || "event"}
              />
            </RowCard>
          )}
        />
      </Section>
    </>
  );
}