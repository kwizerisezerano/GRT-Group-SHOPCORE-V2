import {
  AlertTriangle,
  Database,
  Globe2,
  PlugZap,
  RefreshCw,
  Server,
} from "lucide-react";
import { InfoItem } from "../components/Tenant360Primitives";

export function InfrastructureTab({ metrics }: { metrics: any }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <InfoItem
        icon={<Database className="h-5 w-5" />}
        label="Database Load"
        value={`${metrics.apiRequests.toLocaleString()} requests`}
      />

      <InfoItem
        icon={<Server className="h-5 w-5" />}
        label="Storage Usage"
        value={`${metrics.storageGb.toFixed(1)} GB`}
      />

      <InfoItem
        icon={<PlugZap className="h-5 w-5" />}
        label="Realtime"
        value="Ready"
      />

      <InfoItem
        icon={<RefreshCw className="h-5 w-5" />}
        label="Sync Queue"
        value="Operational"
      />

      <InfoItem
        icon={<Globe2 className="h-5 w-5" />}
        label="Workspace Region"
        value="Rwanda"
      />

      <InfoItem
        icon={<AlertTriangle className="h-5 w-5" />}
        label="Failed Payments"
        value={metrics.failedPayments}
      />
    </section>
  );
}