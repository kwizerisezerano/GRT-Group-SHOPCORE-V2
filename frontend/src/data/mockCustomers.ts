export interface Customer {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  type: "retail" | "wholesale" | "corporate" | "walk-in";
  group: string;
  totalPurchases: number;
  totalSpent: number;
  outstandingBalance: number;
  creditLimit: number;
  loyaltyPoints: number;
  loyaltyTier: "bronze" | "silver" | "gold" | "platinum";
  status: "active" | "inactive" | "blocked";
  address: string;
  city: string;
  joinDate: string;
  lastPurchase: string;
  notes?: string;
}

export const customerGroups = [
  "General",
  "VIP",
  "Wholesale",
  "Corporate",
  "Staff",
];

export const customerTypes = [
  "retail",
  "wholesale",
  "corporate",
  "walk-in",
] as const;

/**
 * Production build:
 * Customer data comes from Supabase.
 * No demo customers should exist.
 */
export const mockCustomers: Customer[] = [];