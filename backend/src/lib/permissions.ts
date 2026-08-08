/**
 * What each role in a workspace is allowed to do.
 *
 * ## Why this exists
 *
 * Roles were previously a label and nothing more. `requireAuth` read a role off
 * the token and no code anywhere ever looked at it, so every authenticated
 * member of a workspace could call every endpoint: a cashier could delete
 * products, read cost prices and margins, receive stock, or change what things
 * sell for. The UI hid those screens, which is worth doing but is not security
 * — the API is the boundary, and it had none.
 *
 * ## The shape
 *
 * A permission is `module.action`. Modules match what a shop actually thinks
 * about (products, sales, reports) and actions are mostly the obvious four,
 * plus a few that exist because they protect something specific:
 *
 *   products.viewCost   seeing what the shop pays is not the same as seeing
 *                       what it charges; a cashier needs the second and has no
 *                       business with the first
 *   reports.viewProfit  margin is the most sensitive number in the building
 *   sales.refund        money leaving the till, as opposed to entering it
 *   sales.voidCompleted a completed sale is a record; unmaking one is not an
 *                       ordinary edit
 *
 * ## Defaults, and the tenant's own choices
 *
 * The matrix below ships with the application: it is what a role means when
 * nobody has said otherwise, and it evolves with the product. A workspace can
 * then grant or revoke individual permissions per role, and those overrides
 * live in the database (`role_permissions`). Resolution is:
 *
 *     effective = defaults(role) + granted(tenant, role) - revoked(tenant, role)
 *
 * Keeping defaults in code rather than seeding them into every tenant matters:
 * when a new module ships, every existing workspace gets sensible access to it
 * without a data migration, and a workspace that has customised one role does
 * not get frozen out of everything added afterwards.
 */

export const PERMISSION_MODULES = [
  "dashboard",
  "pos",
  "sales",
  "products",
  "inventory",
  "purchases",
  "suppliers",
  "customers",
  "expenses",
  "reports",
  "staff",
  "users",
  "settings",
  "activity",
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];

/** Every permission the application recognises. */
export const ALL_PERMISSIONS = [
  "dashboard.view",

  "pos.use",

  "sales.view",
  "sales.create",
  "sales.refund",
  "sales.voidCompleted",

  "products.view",
  "products.create",
  "products.update",
  "products.delete",
  "products.viewCost",
  "products.setPrice",

  "inventory.view",
  "inventory.adjust",
  "inventory.count",
  "inventory.transfer",

  "purchases.view",
  "purchases.create",
  "purchases.update",
  "purchases.delete",

  "suppliers.view",
  "suppliers.create",
  "suppliers.update",
  "suppliers.delete",

  "customers.view",
  "customers.create",
  "customers.update",
  "customers.delete",

  "expenses.view",
  "expenses.create",
  "expenses.update",
  "expenses.delete",

  "reports.view",
  "reports.viewProfit",
  "reports.export",

  "staff.view",
  "staff.manage",

  "users.view",
  "users.invite",
  "users.assignRole",
  "users.remove",
  "users.managePermissions",

  "settings.view",
  "settings.update",
  "settings.billing",

  "activity.view",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

const PERMISSION_SET: ReadonlySet<string> = new Set(ALL_PERMISSIONS);

export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value);
}

/** The roles a workspace member can hold, weakest first. */
export const ROLES = [
  "viewer",
  "staff",
  "sales_staff",
  "cashier",
  "inventory_officer",
  "accountant",
  "manager",
  "admin",
  "owner",
] as const;

export type Role = (typeof ROLES)[number];

const ROLE_SET: ReadonlySet<string> = new Set(ROLES);

export function isRole(value: string): value is Role {
  return ROLE_SET.has(value);
}

/**
 * How senior a role is. Used for one rule only, but an important one: nobody
 * may hand out a role at or above their own, or act on a member who outranks
 * them. Without it, a manager could promote themselves to owner, which makes
 * every other check decorative.
 */
export const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  staff: 1,
  sales_staff: 2,
  cashier: 3,
  inventory_officer: 4,
  accountant: 5,
  manager: 6,
  admin: 7,
  owner: 8,
};

const VIEWER: Permission[] = ["dashboard.view", "products.view", "sales.view", "reports.view"];

const SALES_STAFF: Permission[] = [
  ...VIEWER,
  "pos.use",
  "sales.create",
  "customers.view",
  "customers.create",
  "customers.update",
];

/**
 * A cashier runs the till. They may take money and record a sale, and they may
 * not decide what things cost, unmake a completed sale, or see the margin.
 */
const CASHIER: Permission[] = [...SALES_STAFF, "sales.refund", "inventory.view"];

const INVENTORY_OFFICER: Permission[] = [
  ...VIEWER,
  "products.create",
  "products.update",
  "products.viewCost",
  "inventory.view",
  "inventory.adjust",
  "inventory.count",
  "inventory.transfer",
  "purchases.view",
  "purchases.create",
  "purchases.update",
  "suppliers.view",
  "suppliers.create",
  "suppliers.update",
];

/**
 * An accountant reads everything about money and changes almost none of it.
 * Expenses are theirs; stock and prices are not.
 */
const ACCOUNTANT: Permission[] = [
  ...VIEWER,
  "products.viewCost",
  "purchases.view",
  "suppliers.view",
  "customers.view",
  "expenses.view",
  "expenses.create",
  "expenses.update",
  "expenses.delete",
  "reports.viewProfit",
  "reports.export",
  "activity.view",
];

const MANAGER: Permission[] = [
  ...new Set<Permission>([
    ...CASHIER,
    ...INVENTORY_OFFICER,
    ...ACCOUNTANT,
    "sales.voidCompleted",
    "products.delete",
    "products.setPrice",
    "purchases.delete",
    "suppliers.delete",
    "customers.delete",
    "staff.view",
    "settings.view",
  ]),
];

/** Everything except the things that decide who owns the workspace and who pays. */
const ADMIN: Permission[] = [
  ...new Set<Permission>([
    ...MANAGER,
    "staff.manage",
    "users.view",
    "users.invite",
    "users.assignRole",
    "users.remove",
    "users.managePermissions",
    "settings.update",
  ]),
];

const OWNER: Permission[] = [...ALL_PERMISSIONS];

/** Bare workspace access. A body in the building with no job assigned yet. */
const STAFF: Permission[] = [...VIEWER];

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  viewer: VIEWER,
  staff: STAFF,
  sales_staff: SALES_STAFF,
  cashier: CASHIER,
  inventory_officer: INVENTORY_OFFICER,
  accountant: ACCOUNTANT,
  manager: MANAGER,
  admin: ADMIN,
  owner: OWNER,
};

export type PermissionOverride = { permission: string; granted: boolean };

/**
 * The permissions a role actually has in a given workspace: the shipped
 * defaults, plus anything that workspace granted, minus anything it revoked.
 *
 * Overrides naming a permission the application no longer has are ignored
 * rather than trusted — a stale row from a removed feature must not resurrect
 * it or crash a login.
 */
export function resolvePermissions(
  role: string,
  overrides: readonly PermissionOverride[] = []
): Permission[] {
  if (!isRole(role)) return [];

  const effective = new Set<Permission>(DEFAULT_ROLE_PERMISSIONS[role]);

  for (const override of overrides) {
    if (!isPermission(override.permission)) continue;
    if (override.granted) effective.add(override.permission);
    else effective.delete(override.permission);
  }

  return [...effective].sort();
}

/**
 * Whether one member may act on another, or hand out a given role.
 *
 * Strictly greater, not greater-or-equal: an admin cannot demote a fellow
 * admin, and cannot mint another owner. Peers do not get to overrule each
 * other, which is what stops a role change from being a way to seize a
 * workspace.
 */
export function outranks(actorRole: string, targetRole: string): boolean {
  if (!isRole(actorRole) || !isRole(targetRole)) return false;
  return ROLE_RANK[actorRole] > ROLE_RANK[targetRole];
}
