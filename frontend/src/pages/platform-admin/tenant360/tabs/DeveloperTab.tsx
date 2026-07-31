import { Database, KeyRound, Webhook } from "lucide-react";
import { PlatformStatusBadge } from "@/pages/platform-admin/components/PlatformStatusBadge";
import {
  DataList,
  InfoItem,
  RowCard,
  Section,
} from "../components/Tenant360Primitives";
import { formatDateTime } from "../tenant360Utils";

export function DeveloperTab({ data, metrics }: { data: any; metrics: any }) {
  const enterprise = data?.enterprise ?? {};

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoItem
          icon={<KeyRound className="h-5 w-5" />}
          label="Active API Keys"
          value={enterprise.active_api_keys ?? data?.apiKeys?.length ?? 0}
        />

        <InfoItem
          icon={<Webhook className="h-5 w-5" />}
          label="Active Webhooks"
          value={enterprise.active_webhooks ?? data?.webhooks?.length ?? 0}
        />

        <InfoItem
          icon={<Database className="h-5 w-5" />}
          label="API Usage"
          value={Number(metrics.apiRequests || 0).toLocaleString()}
        />

        <InfoItem
          icon={<Database className="h-5 w-5" />}
          label="Storage"
          value={`${Number(metrics.storageGb || 0).toFixed(2)} GB`}
        />
      </section>

      <Section title="API Keys" icon={<KeyRound className="h-5 w-5" />}>
        <DataList
          items={data?.apiKeys ?? []}
          empty="No API keys configured yet."
          render={(key: any) => (
            <RowCard key={key.id}>
              <div>
                <p className="font-black text-slate-950">
                  {key.key_name || "API key"}
                </p>

                <p className="mt-1 text-xs font-bold text-slate-500">
                  Prefix: {key.key_prefix || "Hidden"} · Scopes:{" "}
                  {(key.scopes ?? []).length || 0}
                </p>

                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                  Created: {formatDateTime(key.created_at)}
                  {key.last_used_at
                    ? ` · Last used: ${formatDateTime(key.last_used_at)}`
                    : ""}
                </p>
              </div>

              <PlatformStatusBadge status={key.status || "active"} />
            </RowCard>
          )}
        />
      </Section>

      <Section title="Webhooks" icon={<Webhook className="h-5 w-5" />}>
        <DataList
          items={data?.webhooks ?? []}
          empty="No webhooks configured yet."
          render={(hook: any) => (
            <RowCard key={hook.id}>
              <div>
                <p className="font-black text-slate-950">
                  {hook.name || "Webhook endpoint"}
                </p>

                <p className="mt-1 text-xs font-bold text-slate-500">
                  {hook.endpoint_url || "No endpoint URL"} · Events:{" "}
                  {(hook.events ?? []).length || 0}
                </p>

                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                  Failures: {hook.failure_count || 0}
                  {hook.last_delivery_at
                    ? ` · Last delivery: ${formatDateTime(hook.last_delivery_at)}`
                    : ""}
                </p>
              </div>

              <PlatformStatusBadge status={hook.status || "active"} />
            </RowCard>
          )}
        />
      </Section>
    </>
  );
}