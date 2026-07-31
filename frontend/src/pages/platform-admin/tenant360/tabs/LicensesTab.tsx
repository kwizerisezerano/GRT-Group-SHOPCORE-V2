import { BadgeCheck, Boxes, LockKeyhole, Users } from "lucide-react";
import { PlatformStatusBadge } from "@/pages/platform-admin/components/PlatformStatusBadge";
import {
  DataList,
  InfoItem,
  RowCard,
  Section,
} from "../components/Tenant360Primitives";

export function LicensesTab({ data }: { data: any }) {
  const enterprise = data?.enterprise ?? {};

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoItem
          icon={<Users className="h-5 w-5" />}
          label="Seats Used"
          value={`${enterprise.seats_used ?? 0}/${enterprise.seats_total ?? 0}`}
        />

        <InfoItem
          icon={<Boxes className="h-5 w-5" />}
          label="Enabled Modules"
          value={enterprise.enabled_modules ?? 0}
        />

        <InfoItem
          icon={<LockKeyhole className="h-5 w-5" />}
          label="Locked Modules"
          value={enterprise.locked_modules ?? 0}
        />

        <InfoItem
          icon={<BadgeCheck className="h-5 w-5" />}
          label="License Records"
          value={data?.licenses?.length ?? 0}
        />
      </section>

      <Section title="License Allocations" icon={<BadgeCheck className="h-5 w-5" />}>
        <DataList
          items={data?.licenses ?? []}
          empty="No license allocations found."
          render={(license: any) => (
            <RowCard key={license.id}>
              <div>
                <p className="font-black text-slate-950">
                  {license.license_type || "Workspace license"}
                </p>

                <p className="mt-1 text-xs font-bold text-slate-500">
                  Seats: {license.seats_used || 0}/{license.seats_total || 0}
                </p>
              </div>

              <PlatformStatusBadge status={license.status || "active"} />
            </RowCard>
          )}
        />
      </Section>

      <Section title="Module Entitlements" icon={<Boxes className="h-5 w-5" />}>
        <DataList
          items={data?.moduleEntitlements ?? []}
          empty="No module entitlements configured yet."
          render={(module: any) => (
            <RowCard key={module.id}>
              <div>
                <p className="font-black text-slate-950">
                  {module.module_name || module.module_key}
                </p>

                <p className="mt-1 text-xs font-bold text-slate-500">
                  Seats: {module.seats_used || 0}/{module.seats_included || 0} ·
                  Usage: {Number(module.usage_count || 0).toLocaleString()}
                </p>
              </div>

              <PlatformStatusBadge status={module.status || "enabled"} />
            </RowCard>
          )}
        />
      </Section>
    </>
  );
}