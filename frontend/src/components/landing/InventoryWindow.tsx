import {
  AlertTriangle,
  Boxes,
  PackageCheck,
  PackageSearch,
  TrendingDown,
  Warehouse,
} from "lucide-react";
import { useLandingExperience } from "@/contexts/LandingExperienceContext";
import { demoBusiness } from "@/data/landingDemoData";
import WindowFrame from "./WindowFrame";
import StatCard from "./StatCard";

type Tone = "blue" | "emerald" | "orange" | "rose" | "violet" | "cyan";

const fallbackStockRows = [
  { item: "Rice 25kg", sku: "INV-2401", stock: "184 bags", status: "Reorder", tone: "orange" },
  { item: "Cooking Oil 5L", sku: "INV-1884", stock: "92 cartons", status: "Healthy", tone: "emerald" },
  { item: "Laptop Charger", sku: "EL-7302", stock: "18 pcs", status: "Low", tone: "rose" },
  { item: "Sugar 10kg", sku: "INV-4420", stock: "310 bags", status: "Healthy", tone: "emerald" },
] satisfies Array<{
  item: string;
  sku: string;
  stock: string;
  status: string;
  tone: Tone;
}>;

const categories = [
  { label: "Fast moving", value: "42%", tone: "bg-blue-500" },
  { label: "Stable", value: "36%", tone: "bg-blue-500" },
  { label: "Slow moving", value: "14%", tone: "bg-blue-500" },
  { label: "Critical", value: "8%", tone: "bg-blue-500" },
];

const statusMap: Record<Tone, string> = {
  emerald: "border-border bg-muted text-foreground",
  orange: "border-border bg-muted text-foreground",
  rose: "border-border bg-muted text-foreground",
  blue: "border-border bg-muted text-foreground",
  cyan: "border-border bg-muted text-foreground",
  violet: "border-border bg-muted text-foreground",
};

const moduleInventoryText: Record<string, string> = {
  pos: "POS deductions update stock visibility immediately after sales activity.",
  inventory:
    "Inventory control is focused on stock health, movement speed and replenishment attention.",
  warehouse:
    "Warehouse receiving, transfers and counts feed the same inventory control layer.",
  procurement:
    "Purchasing decisions are connected to reorder pressure and product movement.",
  finance:
    "Stock value, product cost and margin impact remain visible to finance operations.",
  analytics:
    "Inventory movement contributes to executive analytics and branch performance signals.",
  offline:
    "Offline stock actions wait safely in the local queue before synchronization.",
  ebm: "Fiscal receipt activity remains connected to product sales and stock deductions.",
  security:
    "Inventory adjustments and stock controls remain protected by user permissions.",
};

const getText = (source: unknown, keys: string[], fallback: string) => {
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record?.[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return fallback;
};

const getNumber = (source: unknown, keys: string[], fallback: number) => {
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record?.[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value.replace(/[^0-9.-]/g, ""));

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return fallback;
};

const getArray = (source: unknown, keys: string[]) => {
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record?.[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
};

export default function InventoryWindow() {
  const {
    selectedModule,
    activeBranch,
    demoMode,
    metrics,
    warehouseCapacity,
  } = useLandingExperience();

  const products = getArray(demoBusiness, ["products"]);
  const branches = getArray(demoBusiness, ["branches"]);

  const branch =
    branches.find((item) => getText(item, ["id", "key"], "") === activeBranch) ??
    branches[0];

  const branchName = getText(branch, ["name", "label", "title"], "Active branch");

  const stockRows =
    products.length > 0
      ? products.slice(0, 4).map((product, index) => {
          const name = getText(
            product,
            ["name", "label", "title"],
            `Product ${index + 1}`,
          );
          const sku = getText(
            product,
            ["sku", "code", "barcode"],
            `INV-${2400 + index}`,
          );
          const quantity = getNumber(
            product,
            ["stock", "quantity", "qty"],
            [184, 92, 18, 310][index] ?? 40,
          );
          const unit = getText(product, ["unit", "unitName"], "pcs");

          const tone: Tone =
            quantity <= 20 ? "rose" : quantity <= 100 ? "orange" : "emerald";

          const status =
            quantity <= 20 ? "Low" : quantity <= 100 ? "Reorder" : "Healthy";

          return {
            item: name,
            sku,
            stock: `${quantity} ${unit}`,
            status,
            tone,
          };
        })
      : fallbackStockRows;

  const criticalItems =
    metrics.stockAlerts ||
    stockRows.filter((row) => row.tone === "orange" || row.tone === "rose")
      .length;

  const availableSkus = products.length || 12480;

  const inventoryText =
    moduleInventoryText[String(selectedModule)] ??
    "Branches, warehouses, purchase receiving, transfers and POS deductions update one inventory layer.";

  const warehouseCount = warehouseCapacity.length || 3;

  return (
    <WindowFrame
      title="Inventory Control"
      eyebrow={`${branchName} · Stock intelligence`}
      icon={Boxes}
      status={demoMode ? `${criticalItems} alerts` : "Stock view"}
      statusTone={criticalItems > 0 ? "orange" : "emerald"}
      bodyClassName="bg-muted/70 p-4"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Stock value"
          value={metrics.inventoryValue}
          valuePrefix="RWF "
          compactValue
          valueDecimals={2}
          icon={Warehouse}
          trend="+6.2%"
          trendDirection="up"
          caption={`${warehouseCount} warehouses connected`}
        />

        <StatCard
          label="Available SKUs"
          value={availableSkus}
          icon={PackageCheck}
          trend="98.4%"
          trendDirection="up"
          caption="Sellable inventory"
        />

        <StatCard
          label="Critical items"
          value={criticalItems}
          icon={AlertTriangle}
          trend="Review"
          trendDirection="neutral"
          caption="Needs replenishment"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Stock position
              </p>
              <h4 className="mt-1 text-sm font-black text-foreground">
                Items requiring operational attention
              </h4>
            </div>

            <PackageSearch className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="space-y-2.5">
            {stockRows.map((row) => (
              <div
                key={row.sku}
                className="grid grid-cols-[1fr_auto] gap-3 rounded-xl border border-border bg-muted/80 px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900 dark:!text-blue-100">
                    {row.item}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                    {row.sku} · {row.stock}
                  </p>
                </div>

                <span
                  className={[
                    "self-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                    statusMap[row.tone],
                  ].join(" ")}
                >
                  {row.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Movement profile
              </p>
              <h4 className="mt-1 text-sm font-black text-foreground">
                Inventory classification
              </h4>
            </div>

            <TrendingDown className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="space-y-4">
            {categories.map((item) => (
              <div key={item.label}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-bold text-muted-foreground">{item.label}</span>
                  <span className="font-black text-foreground">{item.value}</span>
                </div>

                <div className="h-2.5 overflow-hidden rounded-full bg-border">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${item.tone}`}
                    style={{ width: item.value }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-black text-blue-950">
              Stock visibility is centralized
            </p>
            <p className="mt-1 text-xs font-medium leading-relaxed text-blue-700 dark:text-blue-200">
              {inventoryText}
            </p>
          </div>
        </div>
      </div>
    </WindowFrame>
  );
}