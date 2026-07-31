import { money } from "../tenant360Utils";
import { KpiCard } from "./Tenant360Primitives";

export function ExecutiveKPIs({ metrics }: { metrics: any }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
      <KpiCard
        label="Health Score"
        value={`${metrics.healthScore}%`}
        tone="blue"
        trend="Operational"
      />

      <KpiCard
        label="Security Score"
        value={`${metrics.securityScore}%`}
        tone="emerald"
        trend="Low risk"
      />

      <KpiCard
        label="Invoice Revenue"
        value={money(metrics.revenue)}
        tone="emerald"
        trend="Paid invoices"
      />

      <KpiCard
        label="Outstanding"
        value={money(metrics.outstanding)}
        tone="rose"
        trend="Open balance"
      />

      <KpiCard
        label="Users"
        value={metrics.members}
        tone="blue"
        trend="Workspace access"
      />

      <KpiCard
        label="Products"
        value={metrics.products}
        tone="violet"
        trend="Catalog records"
      />

      <KpiCard
        label="Branches"
        value={metrics.branches}
        tone="cyan"
        trend="Operating sites"
      />

      <KpiCard
        label="Warehouses"
        value={metrics.warehouses}
        tone="orange"
        trend="Storage points"
      />

      <KpiCard
        label="Stock Value"
        value={money(metrics.stockValue)}
        tone="violet"
        trend="Inventory estimate"
      />

      <KpiCard
        label="Storage"
        value={`${metrics.storageGb.toFixed(1)} GB`}
        tone="cyan"
        trend="Estimated usage"
      />

      <KpiCard
        label="API Requests"
        value={metrics.apiRequests.toLocaleString()}
        tone="blue"
        trend="Estimated load"
      />

      <KpiCard
  label="Live Support"
  value={metrics.liveSupportSessions || 0}
  tone={metrics.liveSupportSessions > 0 ? "orange" : "cyan"}
  trend={metrics.liveSupportSessions > 0 ? "Session active" : "No active session"}
/>
    </section>
  );
}