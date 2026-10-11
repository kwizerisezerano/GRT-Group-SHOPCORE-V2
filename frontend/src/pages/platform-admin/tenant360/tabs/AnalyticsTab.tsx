import { BarChart3, Package, TrendingUp, Users } from "lucide-react";
import { money } from "../tenant360Utils";
import { InfoItem } from "../components/Tenant360Primitives";

export function AnalyticsTab({ metrics }: { metrics: any }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <InfoItem
        icon={<TrendingUp className="h-5 w-5" />}
        label="Sales Revenue"
        value={money(metrics.salesRevenue)}
      />

      <InfoItem
        icon={<Package className="h-5 w-5" />}
        label="Inventory Value"
        value={money(metrics.stockValue)}
      />

      <InfoItem
        icon={<Users className="h-5 w-5" />}
        label="User Adoption"
        value={`${metrics.members} users`}
      />

      <InfoItem
        icon={<BarChart3 className="h-5 w-5" />}
        label="Workspace Health"
        value={`${metrics.healthScore}%`}
      />
    </section>
  );
}