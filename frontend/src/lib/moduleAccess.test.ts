import { describe, expect, it } from "vitest";
import {
  moduleAllowed,
  moduleForRoute,
  normalizePermissions,
  permissionForRoute,
  routeAllowed,
} from "./moduleAccess";

/**
 * The bug class this file exists to keep out.
 *
 * Every defect that made "permissions don't work" was the same shape: a screen
 * gated on a module key that the server never grants. The key was spelled
 * differently (`activity_logs` vs `activity`), or named a module that did not
 * exist (`warehouses`), or named the wrong one (`/user-management` on `staff`
 * when its API enforces `users.*`). None of them are visible by reading one
 * file, so they are asserted here instead.
 */

/** Module halves of the backend catalogue — backend/src/lib/permissions.ts. */
const BACKEND_MODULES = new Set([
  "dashboard", "pos", "sales", "products", "categories", "brands", "units",
  "inventory", "purchases", "suppliers", "customers", "expenses", "reports",
  "staff", "users", "branches", "warehouses", "settings", "activity",
  "notifications", "support",
  "loyalty", "qa", "ebm_settings", "workspace_chat",
]);

/** Every route the application gates, from App.tsx. */
const GATED_ROUTES = [
  "/dashboard", "/products", "/categories", "/brands", "/units",
  "/inventory", "/stock-adjustments", "/stock-counts", "/stock-movements",
  "/transfers", "/pos", "/sales", "/quotations", "/purchases", "/suppliers",
  "/customers", "/loyalty", "/staff", "/expenses", "/reports", "/branches",
  "/warehouses", "/workspace-chat", "/workspace", "/settings", "/billing",
  "/ebm-settings", "/activity-logs", "/qa", "/user-management",
];

describe("moduleForRoute", () => {
  it("resolves every gated route to a module the backend actually grants", () => {
    for (const route of GATED_ROUTES) {
      const module = moduleForRoute(route);

      expect(module, `${route} resolves to no module`).not.toBeNull();
      expect(
        BACKEND_MODULES.has(module!),
        `${route} -> "${module}" is not a backend permission module`
      ).toBe(true);
    }
  });

  it("maps the screens whose route name differs from their module", () => {
    // The server grants `activity.view`, never `activity_logs.view`.
    expect(moduleForRoute("/activity-logs")).toBe("activity");
    // The User Management screen drives the `users.*` API, not `staff.*`.
    expect(moduleForRoute("/user-management")).toBe("users");
    // Every stock screen is one module.
    expect(moduleForRoute("/stock-adjustments")).toBe("inventory");
    expect(moduleForRoute("/transfers")).toBe("inventory");
  });

  it("leaves your own account ungated, and nothing else", () => {
    /*
     * Your profile is yours because you have an account — gating it on
     * `settings` locked a cashier out of their own password.
     *
     * Notifications and Support are not in that category, though they used to
     * be treated as if they were. Being unmapped meant they were drawn
     * unconditionally, so a role holding nothing still got a two-item menu and
     * no workspace could take them away. They have permissions now, granted to
     * every role by default.
     */
    expect(moduleForRoute("/profile")).toBeNull();
    expect(moduleForRoute("/notifications")).toBe("notifications");
    expect(moduleForRoute("/support")).toBe("support");
  });

  it("judges a detail route by its parent module", () => {
    expect(moduleForRoute("/products/abc-123")).toBe("products");
    expect(moduleForRoute("/sales/2026/invoice-9")).toBe("sales");
  });

  it("ignores trailing slashes and query strings", () => {
    expect(moduleForRoute("/products/")).toBe("products");
    expect(moduleForRoute("/products?page=2")).toBe("products");
    expect(moduleForRoute("/products#top")).toBe("products");
  });

  it("does not invent a permission for an unmapped path", () => {
    expect(moduleForRoute("/nowhere")).toBeNull();
  });
});

describe("moduleAllowed", () => {
  it("shows a module when any action on it is held", () => {
    expect(moduleAllowed(["expenses.create"], "expenses")).toBe(true);
    expect(moduleAllowed(["pos.use"], "pos")).toBe(true);
    expect(moduleAllowed(["reports.viewProfit"], "reports")).toBe(true);
  });

  it("hides a module when no permission for it is open", () => {
    expect(moduleAllowed(["products.view", "sales.view"], "expenses")).toBe(false);
    expect(moduleAllowed([], "products")).toBe(false);
  });

  it("does not match a module by prefix alone", () => {
    // `products.view` must not light up a hypothetical `product` module, and
    // `warehouses.view` must not be read as `warehouse`.
    expect(moduleAllowed(["products.view"], "product")).toBe(false);
    expect(moduleAllowed(["warehouses.view"], "warehouse")).toBe(false);
  });

  it("allows a route that needs no module", () => {
    expect(moduleAllowed([], null)).toBe(true);
  });
});

describe("normalizePermissions", () => {
  it("passes through the current module.action shape", () => {
    expect(normalizePermissions(["products.view", "sales.create"])).toEqual([
      "products.view",
      "sales.create",
    ]);
  });

  it("converts the legacy module matrix", () => {
    const legacy = [
      { module: "products", can_view: true, can_edit: true, can_delete: false },
    ];

    expect(normalizePermissions(legacy).sort()).toEqual([
      "products.update",
      "products.view",
    ]);
  });

  it("returns an empty list for anything unusable", () => {
    expect(normalizePermissions(null)).toEqual([]);
    expect(normalizePermissions(undefined)).toEqual([]);
    expect(normalizePermissions([null, 42, {}])).toEqual([]);
  });
});

describe("routeAllowed", () => {
  it("offers nothing at all to a role holding nothing", () => {
    /*
     * The whole point of this change. "This role may do nothing" has to render
     * an empty application — no menu, no ⌘K destinations, no reachable screen
     * — or it does not mean anything. Two routes used to survive it.
     */
    const everySidebarRoute = [
      "/dashboard",
      "/products", "/categories", "/brands", "/units",
      "/inventory", "/stock-adjustments", "/transfers", "/stock-counts", "/stock-movements",
      "/pos", "/sales", "/quotations",
      "/purchases", "/suppliers",
      "/customers", "/loyalty", "/staff",
      "/expenses", "/reports",
      "/branches", "/warehouses",
      "/workspace-chat",
      "/workspace", "/notifications", "/billing", "/support",
      "/settings", "/ebm-settings", "/activity-logs", "/qa", "/user-management",
    ];

    for (const route of everySidebarRoute) {
      expect(routeAllowed([], route), `${route} was still offered`).toBe(false);
    }
  });

  it("still lets someone reach their own account", () => {
    // Otherwise a member stripped of everything cannot change their password
    // or sign out of a workspace they can no longer use.
    expect(routeAllowed([], "/profile")).toBe(true);
  });

  it("opens a route as soon as any action on its module is granted", () => {
    // Deliberately any action, not a whitelist of viewing ones: a role given
    // only `expenses.create` got no menu entry and a page that opened fine
    // when typed into the address bar.
    expect(routeAllowed(["expenses.create"], "/expenses")).toBe(true);
    expect(routeAllowed(["inventory.count"], "/stock-counts")).toBe(true);
    expect(routeAllowed(["notifications.view"], "/notifications")).toBe(true);
    expect(routeAllowed(["support.view"], "/support")).toBe(true);
  });

  it("holds billing to `settings.billing` rather than to the module", () => {
    /*
     * `/billing` on the `settings` module meant anyone who could read the
     * workspace's name was offered the subscription and payment portal. The
     * permission model already separated the two; the route map did not.
     */
    expect(routeAllowed(["settings.view", "settings.update"], "/billing")).toBe(false);
    expect(routeAllowed(["settings.billing"], "/billing")).toBe(true);

    // And the ordinary settings screens are unaffected by that stricter rule.
    expect(routeAllowed(["settings.view"], "/settings")).toBe(true);
    expect(routeAllowed(["settings.view"], "/workspace")).toBe(true);
  });

  it("names the specific permission only where one is needed", () => {
    expect(permissionForRoute("/billing")).toBe("settings.billing");
    expect(permissionForRoute("/settings")).toBeNull();
    expect(permissionForRoute("/products")).toBeNull();
  });

  it("does not lock anyone out of a page nobody meant to protect", () => {
    // An unmapped path is a 404 or a public page.
    expect(routeAllowed([], "/nowhere")).toBe(true);
  });

  it("judges a deep link by the same rule as the list it came from", () => {
    expect(routeAllowed(["products.view"], "/products/abc-123")).toBe(true);
    expect(routeAllowed(["sales.view"], "/products/abc-123")).toBe(false);
  });
});
