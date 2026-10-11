/**
 * Which permission module each screen belongs to — the one place that says so.
 *
 * ## Why this file exists
 *
 * The answer used to be written down three times: once in `AppSidebar` as a
 * `roleModule` on every nav item, once in `RoleGate` as a route table, and
 * once — authoritatively — in the backend's `ALL_PERMISSIONS`. They drifted,
 * and every way they can drift is a bug someone reports:
 *
 *   - the sidebar said `activity_logs`, the server grants `activity.view`, so
 *     an accountant who *had* the permission never saw the menu and was
 *     refused the page;
 *   - both said `warehouses`, which no permission anywhere ever granted, so
 *     that screen was invisible to everyone;
 *   - `/user-management` was gated on `staff` while its API enforces `users.*`,
 *     so a manager saw the menu and then watched every request come back 403;
 *   - `/profile` was gated on `settings`, so a cashier could not open their
 *     own profile.
 *
 * Now the sidebar derives a nav item's module from its `url` through this map,
 * and `RoleGate` resolves the current path through the same one. There is no
 * second copy left to disagree with.
 *
 * ## This is not the security boundary
 *
 * Everything here decides what to *draw*. The server re-checks every request
 * (`requirePermission`), including when offline work is replayed. Hiding a
 * menu is a courtesy; it is not a control.
 */

/**
 * The screens no permission governs.
 *
 * This is deliberately one route. Your own account — your password, your
 * language, the button that signs you out — is yours by virtue of having one,
 * and gating it is how somebody ends up locked into a workspace they cannot
 * even leave.
 *
 * Notifications and Support used to be here too, and that was the reason a
 * role holding nothing still drew a two-item menu: `moduleForRoute` returned
 * null for both, `moduleAllowed(null)` returns true, so they were drawn
 * unconditionally and no workspace could take them away. They now have
 * permissions of their own (`notifications.view`, `support.view`), granted to
 * every role by default — so nothing changed for anyone who has not asked for
 * it, and "this role may do nothing" now renders nothing.
 */
const SELF_SERVICE_ROUTES = new Set(["/profile"]);

/**
 * Route → permission module. Keys are the module halves of the backend's
 * `module.action` permissions; nothing else is a valid value here.
 */
const ROUTE_MODULES: Record<string, string> = {
  "/dashboard": "dashboard",

  "/products": "products",
  "/categories": "categories",
  "/brands": "brands",
  "/units": "units",

  "/inventory": "inventory",
  "/stock-adjustments": "inventory",
  "/stock-counts": "inventory",
  "/stock-movements": "inventory",
  "/transfers": "inventory",

  "/pos": "pos",
  "/sales": "sales",
  "/quotations": "sales",

  "/purchases": "purchases",
  "/suppliers": "suppliers",

  "/customers": "customers",
  "/loyalty": "loyalty",
  "/staff": "staff",

  "/expenses": "expenses",
  "/reports": "reports",

  "/branches": "branches",
  "/warehouses": "warehouses",

  "/workspace-chat": "workspace_chat",

  "/workspace": "settings",
  "/settings": "settings",
  "/billing": "settings",
  "/notifications": "notifications",
  "/support": "support",
  "/ebm-settings": "ebm_settings",
  "/activity-logs": "activity",
  "/qa": "qa",
  // The screen is called User Management, but the API it drives enforces
  // `users.*`. Gating it on `staff` showed it to managers, who then could not
  // load a single row.
  "/user-management": "users",
};

/**
 * Routes gated on one specific permission rather than on "any action in this
 * module".
 *
 * The module rule is right almost everywhere: a screen is worth showing if you
 * can do anything at all on it. Billing is the exception the permission model
 * already anticipated — `settings.billing` exists precisely because changing
 * the subscription and the card on file is not the same act as reading the
 * workspace's name. Gating `/billing` on the `settings` module meant anyone
 * with `settings.view` got the menu entry and the portal behind it.
 *
 * Keep this map small. Every entry is a place where the menu and the module
 * disagree, and each one has to earn that.
 */
const ROUTE_PERMISSIONS: Record<string, string> = {
  "/billing": "settings.billing",
};

function normalisePath(pathname: string) {
  const path = pathname.split("?")[0].split("#")[0];
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

/**
 * The permission module a path belongs to, or `null` when it needs none.
 *
 * `null` covers both self-service screens and anything outside the map — an
 * unmapped path is a 404 or a public page, and inventing a permission for it
 * would only lock people out of screens nobody meant to protect.
 *
 * Detail routes resolve to their parent: `/products/abc123` is the products
 * module, so a deep link is judged by the same rule as the list it came from.
 */
export function moduleForRoute(pathname: string): string | null {
  const path = normalisePath(pathname);

  if (SELF_SERVICE_ROUTES.has(path)) return null;
  if (ROUTE_MODULES[path]) return ROUTE_MODULES[path];

  for (const [route, module] of Object.entries(ROUTE_MODULES)) {
    if (path.startsWith(`${route}/`)) return module;
  }

  return null;
}

/**
 * Whether a module should appear at all.
 *
 * True if the user holds *any* action on it — this is the rule that hides a
 * menu when no permission for that module is open. Deliberately not a
 * whitelist of "viewing" actions: the sidebar used to require one of
 * `view`/`use`/`viewProfit`/`manage` while the route guard accepted anything,
 * so a role granted only `expenses.create` got no menu entry and a page that
 * opened fine when typed into the address bar.
 */
export function moduleAllowed(
  permissions: readonly string[],
  module: string | null
): boolean {
  if (!module) return true;

  const prefix = `${module}.`;
  return permissions.some((permission) => permission.startsWith(prefix));
}

/**
 * The exact permission a route demands, when "any action on its module" is
 * not the right question. Null means the module rule applies.
 */
export function permissionForRoute(pathname: string): string | null {
  return ROUTE_PERMISSIONS[normalisePath(pathname)] ?? null;
}

/**
 * Whether a route should be offered at all — the one question the sidebar,
 * the command palette and the route guard all ask.
 *
 * They used to ask it three different ways, and the command palette did not
 * ask it at all: pressing ⌘K listed every screen in the product regardless of
 * role, so the destinations the sidebar carefully hid were one keystroke away.
 * Nothing leaked — the guard refused the page and the API refused the data —
 * but a menu that offers what the next screen denies is its own kind of
 * broken.
 *
 * `true` for a route nothing governs (your own profile) and for anything
 * outside the map, which is a 404 or a public page: inventing a permission for
 * those would only lock people out of screens nobody meant to protect.
 */
export function routeAllowed(permissions: readonly string[], pathname: string): boolean {
  const required = permissionForRoute(pathname);
  if (required) return permissions.includes(required);

  return moduleAllowed(permissions, moduleForRoute(pathname));
}

/**
 * Accepts both the current `module.action` API shape and the legacy module
 * matrix, so a cached session written by an older build still resolves.
 */
export function normalizePermissions(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  const result = new Set<string>();

  for (const item of input) {
    if (typeof item === "string") {
      result.add(item);
      continue;
    }

    if (!item || typeof item !== "object") continue;
    const value = item as Record<string, unknown>;

    const module =
      typeof value.module === "string"
        ? value.module
        : typeof value.module_key === "string"
          ? value.module_key
          : null;

    if (!module) continue;

    const actions: Array<[string, string]> = [
      ["can_view", "view"],
      ["can_create", "create"],
      ["can_edit", "update"],
      ["can_delete", "delete"],
      ["can_approve", "approve"],
    ];

    for (const [flag, action] of actions) {
      if (value[flag] === true) result.add(`${module}.${action}`);
    }
  }

  return [...result];
}
