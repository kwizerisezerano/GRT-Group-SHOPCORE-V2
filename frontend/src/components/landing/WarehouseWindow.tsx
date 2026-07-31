import {
  ArrowRightLeft,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Forklift,
  MapPinned,
  PackageOpen,
  Truck,
  Warehouse,
} from "lucide-react";
import { useLandingExperience } from "@/contexts/LandingExperienceContext";
import { demoBusiness } from "@/data/landingDemoData";
import WindowFrame from "./WindowFrame";
import StatCard from "./StatCard";
import AnimatedCounter from "./live/AnimatedCounter";

type Tone = "blue" | "emerald" | "orange" | "rose" | "violet" | "cyan";

const fallbackTransferRows = [
  {
    ref: "TRF-2041",
    route: "Central → Remera",
    items: "42 items",
    status: "Approved",
    tone: "blue",
  },
  {
    ref: "TRF-2042",
    route: "Central → Huye",
    items: "118 items",
    status: "In transit",
    tone: "blue",
  },
  {
    ref: "TRF-2043",
    route: "Musanze → Kigali",
    items: "16 items",
    status: "Review",
    tone: "blue",
  },
] satisfies Array<{
  ref: string;
  route: string;
  items: string;
  status: string;
  tone: Tone;
}>;

const toneMap: Record<Tone, string> = {
  emerald: "bg-blue-500",
  blue: "bg-blue-500",
  orange: "bg-blue-500",
  rose: "bg-blue-500",
  cyan: "bg-blue-500",
  violet: "bg-blue-500",
};

const badgeMap: Record<Tone, string> = {
  emerald: "border-border bg-muted text-foreground",
  blue: "border-border bg-muted text-foreground",
  orange: "border-border bg-muted text-foreground",
  rose: "border-border bg-muted text-foreground",
  cyan: "border-border bg-muted text-foreground",
  violet: "border-border bg-muted text-foreground",
};

const moduleWarehouseText: Record<string, string> = {
  pos: "POS demand informs warehouse replenishment and branch transfer priorities.",
  inventory:
    "Inventory visibility connects warehouse capacity, receiving and product availability.",
  warehouse:
    "Warehouse operations coordinate receiving, transfers, counts and branch replenishment.",
  procurement:
    "Purchase receiving flows into warehouse capacity and stock availability.",
  finance:
    "Warehouse value and stock movement influence cost control and margin visibility.",
  analytics:
    "Warehouse movement contributes to branch performance and executive intelligence.",
  offline:
    "Warehouse transfers and counts can remain protected through offline queue handling.",
  ebm: "Receipt activity stays aligned with stock deduction and warehouse replenishment signals.",
  security:
    "Warehouse receiving, transfer approval and stock movement remain permission-controlled.",
};

const getText = (source: unknown, keys: string[], fallback: string) => {
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record?.[key];

    if (typeof value === "string" && value.trim()) return value;
  }

  return fallback;
};

const getNumber = (source: unknown, keys: string[], fallback: number) => {
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record?.[key];

    if (typeof value === "number" && Number.isFinite(value)) return value;

    if (typeof value === "string") {
      const parsed = Number(value.replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return fallback;
};

const getArray = (source: unknown, keys: string[]) => {
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record?.[key];

    if (Array.isArray(value)) return value;
  }

  return [];
};

export default function WarehouseWindow() {
  const {
    selectedModule,
    activeBranch,
    demoMode,
    metrics,
    warehouseCapacity,
  } = useLandingExperience();

  const branches = getArray(demoBusiness, ["branches"]);
  const transfers = getArray(demoBusiness, ["transfers"]);

  const branch =
    branches.find((item) => getText(item, ["id", "key"], "") === activeBranch) ??
    branches[0];

  const branchName = getText(branch, ["name", "label", "title"], "Active branch");

  const warehouseRows =
    warehouseCapacity.length > 0
      ? warehouseCapacity.slice(0, 3)
      : [
          {
            id: "central",
            name: "Central Warehouse",
            location: "Kigali Logistics Hub",
            capacity: 82,
            status: "Active",
            tone: "blue",
          },
          {
            id: "remera-store",
            name: "Remera Storage",
            location: "Retail distribution",
            capacity: 64,
            status: "Healthy",
            tone: "blue",
          },
          {
            id: "musanze-depot",
            name: "Musanze Depot",
            location: "Northern branch supply",
            capacity: 91,
            status: "Review",
            tone: "blue",
          },
        ];

  const transferRows =
    transfers.length > 0
      ? transfers.slice(0, 3).map((transfer, index) => ({
          ref: getText(
            transfer,
            ["ref", "reference", "code"],
            `TRF-${2041 + index}`,
          ),
          route: getText(
            transfer,
            ["route", "name", "description"],
            ["Central → Remera", "Central → Huye", "Musanze → Kigali"][index] ??
              "Warehouse → Branch",
          ),
          items: `${getNumber(
            transfer,
            ["items", "itemCount", "quantity"],
            [42, 118, 16][index] ?? 24,
          )} items`,
          status: getText(
            transfer,
            ["status", "state"],
            index === 1 ? "In transit" : index === 2 ? "Review" : "Approved",
          ),
          tone: "blue",
        }))
      : fallbackTransferRows;

  const warehouseText =
    moduleWarehouseText[String(selectedModule)] ??
    moduleWarehouseText.warehouse;

  const reviewWarehouse =
    warehouseRows.find((warehouse) => warehouse.tone === "blue") ??
    warehouseRows[warehouseRows.length - 1];

  return (
    <WindowFrame
      title="Warehouse Operations"
      eyebrow={`${branchName} · Distribution control`}
      icon={Warehouse}
      status={`${warehouseRows.length || 9} warehouses`}
      statusTone="blue"
      bodyClassName="bg-muted/70 p-4"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Warehouse value"
          value={metrics.inventoryValue}
          valuePrefix="RWF "
          compactValue
          valueDecimals={2}
          icon={Boxes}
          trend="+9.4%"
          trendDirection="up"
          caption="Inventory under control"
        />

        <StatCard
          label="Transfers"
          value={metrics.transfers}
          icon={ArrowRightLeft}
          trend={demoMode ? "live board" : "24 today"}
          trendDirection="neutral"
          caption="Branch replenishment"
        />

        <StatCard
          label="Receiving"
          value={34}
          icon={ClipboardCheck}
          trend="On schedule"
          trendDirection="up"
          caption="Purchase deliveries"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Storage network
              </p>
              <h4 className="mt-1 text-sm font-black text-slate-900 dark:!text-blue-100">
                Capacity and fulfillment status
              </h4>
            </div>

            <MapPinned className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="space-y-3">
            {warehouseRows.map((row) => (
              <div
                key={row.id}
                className="rounded-xl border border-border bg-muted/80 p-3"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:!text-blue-100">
                      {row.name}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                      {row.location}
                    </p>
                  </div>

                  <span
                    className={[
                      "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                      badgeMap[row.tone],
                    ].join(" ")}
                  >
                    {row.status}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-border">
                    <div
                      className={[
                        "h-full rounded-full transition-all duration-700",
                        toneMap[row.tone],
                      ].join(" ")}
                      style={{ width: `${row.capacity}%` }}
                    />
                  </div>

                  <span className="text-xs font-black text-foreground">
                    <AnimatedCounter value={row.capacity} suffix="%" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Transfer board
                </p>
                <h4 className="mt-1 text-sm font-black text-slate-900 dark:!text-blue-100">
                  Movement approvals
                </h4>
              </div>

              <Truck className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="space-y-2.5">
              {transferRows.map((row) => (
                <div
                  key={row.ref}
                  className="rounded-xl border border-border bg-muted/80 px-3 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:!text-blue-100">
                        {row.ref}
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                        {row.route}
                      </p>
                    </div>

                    <span
                      className={[
                        "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                        badgeMap[row.tone],
                      ].join(" ")}
                    >
                      {row.status}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-2 text-xs font-bold text-muted-foreground">
                    <PackageOpen className="h-3.5 w-3.5" />
                    {row.items}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-muted p-4">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 items-center justify-center text-foreground">
                <CheckCircle2 className="h-4 w-4" />
              </div>

              <div>
                <p className="text-sm font-black text-slate-900 dark:!text-blue-100">
                  Receiving and transfer controls aligned
                </p>
                <p className="mt-1 text-xs font-medium leading-relaxed text-blue-700">
                  {warehouseText}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-muted p-4">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 items-center justify-center text-foreground">
                <Forklift className="h-4 w-4" />
              </div>

              <div>
                <p className="text-sm font-black text-slate-900 dark:!text-blue-100">
                  Capacity review required
                </p>
                <p className="mt-1 text-xs font-medium leading-relaxed text-muted-foreground">
                  {reviewWarehouse.name} is near the preferred storage
                  threshold and should be balanced through transfer planning.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </WindowFrame>
  );
}