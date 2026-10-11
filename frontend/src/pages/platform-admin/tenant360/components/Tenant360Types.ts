export type Tenant360TabKey =
  | "overview"
  | "workspace"
  | "people"
  | "security"
  | "applications"
  | "infrastructure"
  | "billing"
  | "support"
  | "analytics"
  | "usage"
  | "licenses"
  | "devices"
  | "audit"
  | "automation"
  | "developer"
  | "notes";

export type Tenant360PendingAction =
  | null
  | {
      type: "activate";
      title: string;
      description: string;
      confirmText: "ACTIVATE";
    }
  | {
      type: "approve";
      title: string;
      description: string;
      days: number;
      confirmText?: never;
    }
  | {
      type: "extend";
      title: string;
      description: string;
      days: number;
      confirmText?: never;
    }
  | {
      type: "suspend";
      title: string;
      description: string;
      confirmText: "SUSPEND";
    }
  | {
      type: "support_access";
      title: string;
      description: string;
      confirmText: "SUPPORT";
    }
  | {
      type: "end_support_access";
      title: string;
      description: string;
      sessionId: string;
      confirmText: "END";
    };

export type Tenant360Metrics = {
  members: number;
  branches: number;
  warehouses: number;
  products: number;
  invoices: number;
  revenue: number;
  outstanding: number;
  salesRevenue: number;
  stockValue: number;
  tickets: number;
  activeSupportSessions: number;
  liveSupportSessions: number;
  failedPayments: number;
  healthScore: number;
  healthStatus: string;
  securityScore: number;
  apiRequests: number;
  storageGb: number;
};

export type Tenant360Data = {
  tenant: any | null;
  subscription: any | null;
  invoices: any[];
  payments: any[];
  events: any[];
  support: any[];
  members: any[];
  branches: any[];
  warehouses: any[];
  products: any[];
  sales: any[];
  notes: any[];
  impersonationSessions: any[];
  impersonationLogs: any[];
  health: any | null;
  enterprise: any | null;
  moduleEntitlements: any[];
  devices: any[];
  apiKeys: any[];
  webhooks: any[];
  licenses: any[];
  usageSnapshots: any[];
  deviceSecurityEvents: any[];
};