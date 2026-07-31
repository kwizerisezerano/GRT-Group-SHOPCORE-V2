export const landingModules = [
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
] as const;

export type LandingModuleId = (typeof landingModules)[number];

export const demoBusiness = {
  name: "KGTASTE Retail Inc",
  country: "Rwanda",
  currency: "RWF",

  branches: [
    {
      id: "kigali-main",
      name: "Kigali Main",
      location: "Central retail hub",
      revenueToday: "RWF 3.4M",
      status: "online",
      stockHealth: 96,
      warehouseLoad: 82,
    },
    {
      id: "remera",
      name: "Remera",
      location: "Urban branch",
      revenueToday: "RWF 1.8M",
      status: "online",
      stockHealth: 94,
      warehouseLoad: 68,
    },
    {
      id: "musanze",
      name: "Musanze",
      location: "Northern branch",
      revenueToday: "RWF 1.1M",
      status: "syncing",
      stockHealth: 87,
      warehouseLoad: 91,
    },
    {
      id: "huye",
      name: "Huye",
      location: "Southern branch",
      revenueToday: "RWF 920K",
      status: "review",
      stockHealth: 78,
      warehouseLoad: 74,
    },
  ],

  kpis: {
    revenueToday: "RWF 8.42M",
    ordersToday: "1,284",
    grossMargin: "34.8%",
    stockAlerts: "38",
    customers: "18,940",
    fiscalReceipts: "1,118",
    activeBranches: "18",
    warehouses: "9",
    syncStatus: "Healthy",
    decisionScore: "92%",
  },

  products: [
    {
      id: "rice-25kg",
      name: "Rice 25kg",
      sku: "INV-2401",
      stock: "184 bags",
      status: "reorder",
      branch: "huye",
    },
    {
      id: "cooking-oil-5l",
      name: "Cooking Oil 5L",
      sku: "INV-1884",
      stock: "92 cartons",
      status: "healthy",
      branch: "kigali-main",
    },
    {
      id: "laptop-charger",
      name: "Laptop Charger",
      sku: "EL-7302",
      stock: "18 pcs",
      status: "low",
      branch: "remera",
    },
    {
      id: "sugar-10kg",
      name: "Sugar 10kg",
      sku: "INV-4420",
      stock: "310 bags",
      status: "healthy",
      branch: "musanze",
    },
  ],

  transfers: [
    {
      id: "TRF-2041",
      route: "Central Warehouse → Remera",
      items: "42 items",
      status: "Approved",
    },
    {
      id: "TRF-2042",
      route: "Central Warehouse → Huye",
      items: "118 items",
      status: "In transit",
    },
    {
      id: "TRF-2043",
      route: "Musanze Depot → Kigali Main",
      items: "16 items",
      status: "Review",
    },
  ],

  notifications: [
    {
      title: "Sale completed",
      detail: "SC-1048 · Kigali Main · RWF 204,376",
      module: "pos",
      tone: "emerald",
    },
    {
      title: "Inventory alert",
      detail: "Rice 25kg reached reorder threshold",
      module: "inventory",
      tone: "orange",
    },
    {
      title: "Transfer completed",
      detail: "Central Warehouse → Remera · 42 items",
      module: "warehouse",
      tone: "blue",
    },
    {
      title: "Fiscal workflow ready",
      detail: "Tenant fiscal configuration verified",
      module: "ebm",
      tone: "violet",
    },
    {
      title: "Offline queue clear",
      detail: "All pending records synchronized successfully",
      module: "offline",
      tone: "cyan",
    },
  ],

  workflows: {
    pos: {
      title: "Checkout to business update flow",
      signal: "1,284 orders",
      steps: [
        "Sale completed",
        "Stock deducted",
        "Customer history updated",
        "Fiscal queue prepared",
        "Reports refreshed",
      ],
    },
    inventory: {
      title: "Stock alert to replenishment flow",
      signal: "38 alerts",
      steps: [
        "Low stock detected",
        "Purchase review",
        "Warehouse receiving",
        "Branch transfer",
        "POS availability updated",
      ],
    },
    warehouse: {
      title: "Receiving to branch transfer flow",
      signal: "126 transfers",
      steps: [
        "Goods received",
        "Batch valuation updated",
        "Capacity reviewed",
        "Transfer approved",
        "Branch stock updated",
      ],
    },
    crm: {
      title: "Customer loyalty to repeat sale flow",
      signal: "+4.8% growth",
      steps: [
        "Customer identified",
        "Loyalty applied",
        "Credit reviewed",
        "Retention signal",
        "Customer report updated",
      ],
    },
    procurement: {
      title: "Purchase order to receiving flow",
      signal: "34 receiving",
      steps: [
        "Demand signal created",
        "Supplier selected",
        "Purchase order prepared",
        "Receiving completed",
        "Stock valuation updated",
      ],
    },
    finance: {
      title: "Cash session to margin report flow",
      signal: "34.8% margin",
      steps: [
        "Cash session closed",
        "Expenses recorded",
        "Margins calculated",
        "Branch result reviewed",
        "Executive report ready",
      ],
    },
    analytics: {
      title: "Operations to executive KPI flow",
      signal: "24 reports",
      steps: [
        "Sales data captured",
        "Inventory data merged",
        "Customer data linked",
        "Branch comparison",
        "Management KPI refreshed",
      ],
    },
    offline: {
      title: "Offline queue to secure sync flow",
      signal: "Queue healthy",
      steps: [
        "Network unavailable",
        "Record queued",
        "Secure login restored",
        "Sync processed",
        "Reports updated",
      ],
    },
    ebm: {
      title: "Sale to fiscal receipt flow",
      signal: "Non-blocking",
      steps: [
        "Sale completed",
        "Tenant config checked",
        "Fiscal submission",
        "Retry queue available",
        "Receipt updated",
      ],
    },
    security: {
      title: "Role permission to audit trail flow",
      signal: "RBAC active",
      steps: [
        "User signs in",
        "Role checked",
        "Branch access applied",
        "Action completed",
        "Audit trail updated",
      ],
    },
  } satisfies Record<
    LandingModuleId,
    {
      title: string;
      signal: string;
      steps: string[];
    }
  >,
};

export const getDemoWorkflow = (moduleId: LandingModuleId) => {
  return demoBusiness.workflows[moduleId] ?? demoBusiness.workflows.pos;
};