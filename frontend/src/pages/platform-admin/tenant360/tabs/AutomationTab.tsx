import { Zap } from "lucide-react";
import { PlatformStatusBadge } from "@/pages/platform-admin/components/PlatformStatusBadge";
import { formatDateTime } from "../tenant360Utils";
import {
  DataList,
  RowCard,
  Section,
} from "../components/Tenant360Primitives";

export function AutomationTab({ data }: { data: any }) {
  return (
    <Section
      title="Tenant Automation Timeline"
      icon={<Zap className="h-5 w-5" />}
    >
      <DataList
        items={data?.events ?? []}
        empty="No automation events found."
        render={(event: any) => (
          <RowCard key={event.id}>
            <div>
              <p className="font-black text-slate-950">
                {event.title || event.event_type || "Automation event"}
              </p>

              <p className="mt-1 text-xs font-medium text-slate-500">
                {event.description || "Automation activity"}
              </p>

              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                {formatDateTime(event.created_at)}
              </p>
            </div>

            <PlatformStatusBadge status={event.status || "processed"} />
          </RowCard>
        )}
      />
    </Section>
  );
}