import { Activity, Database, HardDrive, Users } from "lucide-react";
import { InfoItem, Section } from "../components/Tenant360Primitives";

export function UsageTab({ data }: { data: any }) {
  const enterprise = data?.enterprise ?? {};
  const latest = data?.usageSnapshots?.[0] ?? {};

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoItem
          icon={<Users className="h-5 w-5" />}
          label="Active Users"
          value={enterprise.active_users ?? latest.active_users ?? 0}
        />

        <InfoItem
          icon={<Database className="h-5 w-5" />}
          label="API Requests"
          value={Number(
            enterprise.api_requests ?? latest.api_requests ?? 0,
          ).toLocaleString()}
        />

        <InfoItem
          icon={<HardDrive className="h-5 w-5" />}
          label="Storage Usage"
          value={`${Number(enterprise.storage_gb ?? latest.storage_gb ?? 0).toFixed(
            2,
          )} GB`}
        />

        <InfoItem
          icon={<Activity className="h-5 w-5" />}
          label="Snapshots"
          value={data?.usageSnapshots?.length ?? 0}
        />
      </section>

      <Section title="Usage History" icon={<Activity className="h-5 w-5" />}>
        <div className="space-y-3">
          {(data?.usageSnapshots ?? []).length ? (
            data.usageSnapshots.map((item: any) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <p className="font-black text-slate-950">
                  {item.snapshot_date}
                </p>

                <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
                  Active users: {item.active_users} · API requests:{" "}
                  {Number(item.api_requests || 0).toLocaleString()} · Storage:{" "}
                  {Number(item.storage_gb || 0).toFixed(2)} GB
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">
              No usage snapshots recorded yet.
            </div>
          )}
        </div>
      </Section>
    </>
  );
}