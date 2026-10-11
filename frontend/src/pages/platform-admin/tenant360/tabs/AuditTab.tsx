import { Activity } from "lucide-react";
import { PlatformStatusBadge } from "@/pages/platform-admin/components/PlatformStatusBadge";
import { formatDateTime } from "../tenant360Utils";
import {
  DataList,
  RowCard,
  Section,
} from "../components/Tenant360Primitives";

export function AuditTab({ data }: { data: any }) {
  return (
    <Section title="Audit Timeline" icon={<Activity className="h-5 w-5" />}>
      <DataList
        items={data?.events ?? []}
        empty="No audit events found."
        render={(event: any) => (
          <RowCard key={event.id}>
            <div>
              <p className="font-black text-slate-950">
                {event.title || event.event_type || "Audit event"}
              </p>

              <p className="mt-1 text-xs font-medium text-slate-500">
                {event.description || event.event_type || "Tenant activity"}
              </p>

              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                {formatDateTime(event.created_at)}
              </p>
            </div>

            <PlatformStatusBadge status={event.status || event.event_type || "event"} />
          </RowCard>
        )}
      />
    </Section>
  );
}