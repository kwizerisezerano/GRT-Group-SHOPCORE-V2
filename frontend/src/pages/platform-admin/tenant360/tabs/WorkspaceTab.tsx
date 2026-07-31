import { Building2 } from "lucide-react";
import { Detail, Section } from "../components/Tenant360Primitives";

export function WorkspaceTab({ data, metrics }: { data: any; metrics: any }) {
  return (
    <Section title="Workspace Profile" icon={<Building2 className="h-5 w-5" />}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Detail label="Workspace Name" value={data?.tenant?.name || "Unknown"} />
        <Detail
          label="Workspace Status"
          value={data?.tenant?.workspace_status || "pending"}
        />
        <Detail
          label="Subscription Status"
          value={data?.tenant?.subscription_status || "pending"}
        />
        <Detail
          label="Plan"
          value={
            data?.subscription?.plan_code ||
            data?.tenant?.subscription_plan ||
            "Pending"
          }
        />
        <Detail label="Country" value={data?.tenant?.country || "Rwanda"} />
        <Detail label="Currency" value={data?.tenant?.currency || "RWF"} />
        <Detail label="Branches" value={metrics.branches} />
        <Detail label="Warehouses" value={metrics.warehouses} />
        <Detail label="Products" value={metrics.products} />
      </div>
    </Section>
  );
}