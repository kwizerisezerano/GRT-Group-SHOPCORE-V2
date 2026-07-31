import type { AppRole } from "@/contexts/AuthContext";

/**
 * Minimum role required to access each route.
 * Routes not listed here fall back to "viewer" (any signed-in member).
 */
export const ROUTE_MIN_ROLE: Record<string, AppRole> = {
  // Catalog writes
  "/products": "staff",
  "/categories": "staff",
  "/brands": "staff",
  "/units": "staff",

  // Inventory
  "/inventory": "viewer",
  "/stock-adjustments": "staff",
  "/transfers": "staff",
  "/stock-counts": "staff",
  "/stock-movements": "viewer",

  // Sales
  "/pos": "staff",
  "/sales": "viewer",
  "/quotations": "staff",

  // Procurement
  "/purchases": "staff",
  "/suppliers": "staff",

  // People
  "/customers": "staff",
  "/loyalty": "staff",
  "/staff": "admin",

  // Finance
  "/expenses": "admin",
  "/reports": "viewer",

  // Org
  "/branches": "admin",
  "/warehouses": "admin",

  // System
  "/notifications": "viewer",
  "/support": "viewer",
  "/settings": "owner",
  "/workspace": "viewer",
  "/profile": "viewer",
  "/activity-logs": "admin",
  "/qa": "admin",
  "/dashboard": "viewer",
};

const ORDER: AppRole[] = ["viewer", "staff", "admin", "owner"];

export function canAccess(role: AppRole | null, route: string): boolean {
  if (!role) return false;
  const required = ROUTE_MIN_ROLE[route] ?? "viewer";
  return ORDER.indexOf(role) >= ORDER.indexOf(required);
}
