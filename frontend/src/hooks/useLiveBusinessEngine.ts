import { useEffect, useMemo, useState } from "react";
import type { LandingModuleId } from "@/data/landingDemoData";
import type { BusinessScenario } from "@/data/BusinessScenarios";
import { demoBusiness, getDemoWorkflow } from "@/data/landingDemoData";
import { useScenarioBusinessEngine } from "@/hooks/useScenarioBusinessEngine";

type Tone = "blue" | "emerald" | "orange" | "rose" | "violet" | "cyan";

export type LiveBusinessMetrics = {
  revenue: number;
  profit: number;
  orders: number;
  customers: number;
  inventoryValue: number;
  margin: number;
  receipts: number;
  stockAlerts: number;
  offlineQueue: number;
  transfers: number;
  cashCollected: number;
};

export type LiveBusinessEvent = {
  id: string;
  title: string;
  detail: string;
  time: string;
  module: LandingModuleId;
  branchId: string;
  tone: Tone;
};

export type LiveNotification = {
  id: string;
  title: string;
  message: string;
  module: LandingModuleId;
  branchId: string;
  priority: "low" | "medium" | "high";
  tone: Tone;
};

export type LiveBranchHealth = {
  id: string;
  name: string;
  status: "Online" | "Active" | "Syncing" | "Review";
  load: number;
  tone: Tone;
};

export type LiveWarehouseCapacity = {
  id: string;
  name: string;
  location: string;
  capacity: number;
  status: "Healthy" | "Active" | "Review";
  tone: Tone;
};

export type LiveExecutiveSignal = {
  id: string;
  title: string;
  detail: string;
  action: string;
  tone: Tone;
};

export type LiveBusinessEngineState = {
  tick: number;
  metrics: LiveBusinessMetrics;
  events: LiveBusinessEvent[];
  notifications: LiveNotification[];
  activityFeed: LiveBusinessEvent[];
  chartSeries: number[];
  branchHealth: LiveBranchHealth[];
  warehouseCapacity: LiveWarehouseCapacity[];
  executiveSignals: LiveExecutiveSignal[];
};

type UseLiveBusinessEngineOptions = {
  selectedModule: LandingModuleId;
  activeBranch: string;
  demoMode: boolean;
  scenario?: BusinessScenario;
};

type ScenarioEngine = ReturnType<typeof useScenarioBusinessEngine>;

const MODULE_SEQUENCE: LandingModuleId[] = [
  "pos",
  "inventory",
  "warehouse",
  "crm",
  "procurement",
  "finance",
  "analytics",
  "offline",
  "ebm",
  "security",
];

const eventTemplates: Array<{
  module: LandingModuleId;
  title: string;
  detail: string;
  tone: Tone;
}> = [
  {
    module: "pos",
    title: "Sale completed",
    detail: "Checkout posted, receipt saved and stock deducted.",
    tone: "emerald",
  },
  {
    module: "inventory",
    title: "Stock position updated",
    detail: "Inventory balance refreshed after operating movement.",
    tone: "blue",
  },
  {
    module: "warehouse",
    title: "Transfer approved",
    detail: "Warehouse movement released for branch replenishment.",
    tone: "orange",
  },
  {
    module: "crm",
    title: "Customer profile updated",
    detail: "Purchase history and loyalty status refreshed.",
    tone: "violet",
  },
  {
    module: "procurement",
    title: "Purchase signal generated",
    detail: "Replenishment demand prepared for supplier review.",
    tone: "cyan",
  },
  {
    module: "finance",
    title: "Margin recalculated",
    detail: "Revenue, cost and profit indicators updated.",
    tone: "emerald",
  },
  {
    module: "analytics",
    title: "Executive dashboard refreshed",
    detail: "KPIs, branch indicators and reporting signals updated.",
    tone: "violet",
  },
  {
    module: "offline",
    title: "Offline queue synchronized",
    detail: "Pending local records validated and cleared safely.",
    tone: "cyan",
  },
  {
    module: "ebm",
    title: "Fiscal queue verified",
    detail: "Receipt submission status checked for configured tenants.",
    tone: "blue",
  },
  {
    module: "security",
    title: "Access control checked",
    detail: "Role boundaries and protected operations verified.",
    tone: "emerald",
  },
];

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

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const slugify = (value: string, fallback: string) => {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  return slug || fallback;
};

const createBaseMetrics = (): LiveBusinessMetrics => {
  const kpis = (demoBusiness as Record<string, unknown>).kpis;

  return {
    revenue: getNumber(kpis, ["revenue", "todayRevenue", "sales"], 8420000),
    profit: getNumber(kpis, ["profit", "netProfit"], 2840000),
    orders: getNumber(kpis, ["orders", "todayOrders"], 1284),
    customers: getNumber(kpis, ["customers", "customerCount"], 18940),
    inventoryValue: getNumber(kpis, ["stockValue", "inventoryValue"], 214000000),
    margin: getNumber(kpis, ["margin", "grossMargin"], 34.8),
    receipts: getNumber(kpis, ["fiscalReceipts", "receipts"], 1118),
    stockAlerts: getNumber(kpis, ["stockAlerts", "alerts"], 38),
    offlineQueue: getNumber(kpis, ["offlineQueue", "queue"], 0),
    transfers: getNumber(kpis, ["transfers", "transferCount"], 126),
    cashCollected: getNumber(kpis, ["cashCollected", "cash"], 5910000),
  };
};

const getScenarioMultiplier = (scenario?: BusinessScenario) => {
  switch (scenario?.id) {
    case "supermarket":
      return 1.45;
    case "pharmacy":
      return 0.88;
    case "hardware":
      return 1.22;
    case "electronics":
      return 1.12;
    case "fashion":
      return 0.96;
    case "wholesale":
      return 1.68;
    case "restaurant":
      return 0.82;
    default:
      return 1;
  }
};

const buildBranchHealth = (
  activeBranch: string,
  tick: number,
  scenarioEngine: ScenarioEngine,
): LiveBranchHealth[] => {
  const scenarioBranches = scenarioEngine.branches.map((name, index) => ({
    id: ["kigali-main", "remera", "musanze", "huye"][index] ?? slugify(name, `branch-${index}`),
    name,
  }));

  const fallback = [
    { id: "kigali-main", name: "Kigali Main" },
    { id: "remera", name: "Remera" },
    { id: "musanze", name: "Musanze" },
    { id: "huye", name: "Huye" },
  ];

  const records = scenarioBranches.length > 0 ? scenarioBranches : fallback;

  return records.slice(0, 4).map((branch, index) => {
    const baseLoad = [94, 87, 72, 61][index] ?? 70;
    const load = clamp(baseLoad + Math.round(Math.sin((tick + index) / 2) * 3), 45, 99);
    const isActive = branch.id === activeBranch;

    return {
      id: branch.id,
      name: branch.name,
      load,
      status: isActive
        ? "Active"
        : index === 2
          ? "Syncing"
          : index === 3
            ? "Review"
            : "Online",
      tone: isActive || index < 2 ? "emerald" : index === 2 ? "cyan" : "orange",
    };
  });
};

const buildWarehouseCapacity = (
  tick: number,
  scenarioEngine: ScenarioEngine,
): LiveWarehouseCapacity[] => {
  const fallback = [
    {
      id: "central",
      name: "Central Warehouse",
      location: scenarioEngine.branches[0] ?? "Kigali Logistics Hub",
      capacity: 82,
    },
    {
      id: "store-room",
      name: "Branch Storage",
      location: scenarioEngine.branches[1] ?? "Retail distribution",
      capacity: 64,
    },
    {
      id: "depot",
      name: "Reserve Depot",
      location: scenarioEngine.branches[2] ?? "Regional supply",
      capacity: 91,
    },
  ];

  return fallback.map((warehouse, index) => {
    const capacity = clamp(
      warehouse.capacity + Math.round(Math.sin((tick + index) / 2.4) * 2),
      40,
      96,
    );

    return {
      id: warehouse.id,
      name: warehouse.name,
      location: warehouse.location,
      capacity,
      status: capacity >= 88 ? "Review" : capacity >= 72 ? "Active" : "Healthy",
      tone: capacity >= 88 ? "orange" : capacity >= 72 ? "emerald" : "blue",
    };
  });
};

const createEvent = (
  tick: number,
  selectedModule: LandingModuleId,
  activeBranch: string,
  scenarioEngine: ScenarioEngine,
): LiveBusinessEvent => {
  const selectedIndex = MODULE_SEQUENCE.indexOf(selectedModule);
  const templateIndex =
    selectedIndex >= 0
      ? (selectedIndex + tick) % eventTemplates.length
      : tick % eventTemplates.length;

  const baseTemplate =
    tick % 2 === 0
      ? eventTemplates.find((item) => item.module === selectedModule) ??
        eventTemplates[templateIndex]
      : eventTemplates[templateIndex];

  const scenarioAlert =
    scenarioEngine.alerts[tick % scenarioEngine.alerts.length] ??
    baseTemplate.title;

  const scenarioWorkflow =
    scenarioEngine.workflow[tick % scenarioEngine.workflow.length] ??
    baseTemplate.detail;

  const branches = buildBranchHealth(activeBranch, tick, scenarioEngine);
  const branch = branches.find((item) => item.id === activeBranch) ?? branches[0];

  const title =
    tick % 3 === 0
      ? scenarioAlert
      : baseTemplate.title;

  const detail =
    tick % 3 === 0
      ? `${scenarioEngine.businessName} · ${scenarioWorkflow}`
      : `${branch?.name ?? "Active branch"} · ${baseTemplate.detail}`;

  return {
    id: `event-${tick}-${Date.now()}-${baseTemplate.module}-${branch?.id ?? activeBranch}`,
    title,
    detail,
    time: tick === 0 ? "ready" : "now",
    module: baseTemplate.module,
    branchId: branch?.id ?? activeBranch,
    tone: baseTemplate.tone,
  };
};

const createNotifications = (
  events: LiveBusinessEvent[],
  selectedModule: LandingModuleId,
): LiveNotification[] => {
  return events.slice(0, 5).map((event, index) => ({
    id: `notification-${event.id}-${index}`,
    title: event.title,
    message: event.detail,
    module: event.module,
    branchId: event.branchId,
    priority:
      event.module === selectedModule
        ? "high"
        : index <= 1
          ? "medium"
          : "low",
    tone: event.tone,
  }));
};

const createExecutiveSignals = (
  selectedModule: LandingModuleId,
  scenarioEngine: ScenarioEngine,
): LiveExecutiveSignal[] => {
  const workflow = getDemoWorkflow(selectedModule) as Record<string, unknown>;

  const recommendation = getText(
    workflow,
    ["recommendation", "action", "summary"],
    `Review ${scenarioEngine.inventoryFocus.toLowerCase()} and prioritize the highest-impact workflow.`,
  );

  return [
    {
      id: `${selectedModule}-signal-1`,
      title: `${scenarioEngine.revenueLabel} signal`,
      detail: `${scenarioEngine.businessName} is currently operating in ${scenarioEngine.primaryModule.toUpperCase()} focus mode.`,
      action: recommendation,
      tone: "blue",
    },
    {
      id: `${selectedModule}-signal-2`,
      title: `${scenarioEngine.inventoryFocus} context`,
      detail: `${scenarioEngine.products.slice(0, 2).join(" and ")} are visible in the active scenario model.`,
      action: `Compare branch pressure, ${scenarioEngine.inventoryFocus.toLowerCase()} and revenue contribution.`,
      tone: "emerald",
    },
    {
      id: `${selectedModule}-signal-3`,
      title: `${scenarioEngine.customersLabel} visibility`,
      detail: `${scenarioEngine.customersLabel} activity remains connected to sales, reporting and retention workflows.`,
      action: "Maintain governance checks while business activity increases.",
      tone: "violet",
    },
  ];
};

export function useLiveBusinessEngine({
  selectedModule,
  activeBranch,
  demoMode,
  scenario,
}: UseLiveBusinessEngineOptions): LiveBusinessEngineState {
  const scenarioEngine = useScenarioBusinessEngine(scenario);
  const [tick, setTick] = useState(0);

  const [metrics, setMetrics] = useState<LiveBusinessMetrics>(() => {
    const base = createBaseMetrics();
    const multiplier = getScenarioMultiplier(scenario);

    return {
      ...base,
      revenue: Math.round(base.revenue * multiplier),
      profit: Math.round(base.profit * multiplier),
      orders: Math.round(base.orders * multiplier),
      customers: Math.round(base.customers * multiplier),
      receipts: Math.round(base.receipts * multiplier),
      cashCollected: Math.round(base.cashCollected * multiplier),
    };
  });

  const [events, setEvents] = useState<LiveBusinessEvent[]>(() => [
    createEvent(0, selectedModule, activeBranch, scenarioEngine),
  ]);

  useEffect(() => {
    const base = createBaseMetrics();
    const multiplier = getScenarioMultiplier(scenario);

    setMetrics({
      ...base,
      revenue: Math.round(base.revenue * multiplier),
      profit: Math.round(base.profit * multiplier),
      orders: Math.round(base.orders * multiplier),
      customers: Math.round(base.customers * multiplier),
      receipts: Math.round(base.receipts * multiplier),
      cashCollected: Math.round(base.cashCollected * multiplier),
    });

    setEvents([createEvent(0, selectedModule, activeBranch, scenarioEngine)]);
    setTick(0);
  }, [activeBranch, scenario, scenarioEngine, selectedModule]);

  useEffect(() => {
    if (!demoMode) return;

    const timer = window.setInterval(() => {
      setTick((current) => current + 1);
    }, 2600);

    return () => window.clearInterval(timer);
  }, [demoMode]);

  useEffect(() => {
    const nextEvent = createEvent(
      tick + 1,
      selectedModule,
      activeBranch,
      scenarioEngine,
    );

    if (!demoMode) {
      setEvents((current) => {
        const currentFirst = current[0];

        if (
          currentFirst?.module === selectedModule &&
          currentFirst?.branchId === activeBranch
        ) {
          return current;
        }

        return [nextEvent, ...current].slice(0, 8);
      });

      return;
    }

    const moduleIndex = MODULE_SEQUENCE.indexOf(selectedModule);
    const multiplier = moduleIndex >= 0 ? moduleIndex + 1 : 1;
    const scenarioMultiplier = getScenarioMultiplier(scenario);

    setMetrics((current) => ({
      revenue: current.revenue + Math.round((8200 + multiplier * 900) * scenarioMultiplier),
      profit: current.profit + Math.round((2200 + multiplier * 240) * scenarioMultiplier),
      orders: current.orders + 1 + (tick % 3),
      customers: current.customers + (tick % 4 === 0 ? 1 : 0),
      inventoryValue:
        current.inventoryValue +
        (selectedModule === "inventory" ? 42000 : 12000),
      margin: clamp(
        Number((current.margin + (tick % 2 === 0 ? 0.1 : -0.04)).toFixed(1)),
        28,
        42,
      ),
      receipts:
        current.receipts +
        (selectedModule === "ebm" || selectedModule === "pos" ? 2 : 1),
      stockAlerts: clamp(
        current.stockAlerts +
          (selectedModule === "inventory" && tick % 3 === 0
            ? 1
            : tick % 5 === 0
              ? -1
              : 0),
        12,
        64,
      ),
      offlineQueue:
        selectedModule === "offline"
          ? clamp(current.offlineQueue + (tick % 2 === 0 ? 1 : -1), 0, 12)
          : clamp(current.offlineQueue + (tick % 6 === 0 ? 1 : -1), 0, 8),
      transfers:
        current.transfers +
        (selectedModule === "warehouse" ? 2 : tick % 4 === 0 ? 1 : 0),
      cashCollected:
        current.cashCollected + Math.round((4200 + multiplier * 320) * scenarioMultiplier),
    }));

    setEvents((current) => [nextEvent, ...current].slice(0, 8));
  }, [activeBranch, demoMode, scenario, scenarioEngine, selectedModule, tick]);

  const chartSeries = useMemo(() => {
    const base = [48, 64, 52, 78, 69, 91, 84, 98, 75, 88, 94, 100];

    return base.map((value, index) =>
      clamp(value + Math.round(Math.sin((tick + index) / 2) * 5), 24, 100),
    );
  }, [tick]);

  const branchHealth = useMemo(
    () => buildBranchHealth(activeBranch, tick, scenarioEngine),
    [activeBranch, scenarioEngine, tick],
  );

  const warehouseCapacity = useMemo(
    () => buildWarehouseCapacity(tick, scenarioEngine),
    [scenarioEngine, tick],
  );

  const notifications = useMemo(
    () => createNotifications(events, selectedModule),
    [events, selectedModule],
  );

  const executiveSignals = useMemo(
    () => createExecutiveSignals(selectedModule, scenarioEngine),
    [scenarioEngine, selectedModule],
  );

  return {
    tick,
    metrics,
    events,
    notifications,
    activityFeed: events,
    chartSeries,
    branchHealth,
    warehouseCapacity,
    executiveSignals,
  };
}