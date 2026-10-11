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

/**
 * Every module a permission can name.
 *
 * This is the list the client hides menus by, so it has to be the *whole*
 * list — a module missing from here is a screen that either never appears or
 * is gated on a key nothing ever grants. `categories`, `brands`, `units`,
 * `branches` and `warehouses` were all absent while `ALL_PERMISSIONS` below
 * happily granted `categories.view` and friends.
 */
export const PERMISSION_MODULES = [
  "dashboard",
  "pos",
  "sales",
  "products",
  "categories",
  "brands",
  "units",
  "inventory",
  "purchases",
  "suppliers",
  "customers",
  "expenses",
  "reports",
  "staff",
  "users",
  "branches",
  "warehouses",
  "settings",
  "activity",
  "notifications",
  "support",
  "loyalty",
  "qa",
  "ebm_settings",
  "workspace_chat",
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];

/**
 * Every permission the application recognises.
 *
 * ## Only permissions something actually enforces
 *
 * This list used to carry a tail of entries added to make a four-column
 * View/Create/Edit/Delete grid line up — `dashboard.create`, `pos.view`,
 * `sales.delete`, `reports.update`, `activity.delete` and twenty more. No
 * route checked any of them and no screen read any of them, so each one was a
 * switch in the permission editor that an owner could flip all day without
 * changing what anybody could do. That is worse than a missing switch: a
 * missing one is a feature request, a dead one is a promise the product does
 * not keep.
 *
 * The rule now is that a permission appears here only if something enforces
 * it. Some modules therefore have one action and some have six, because the
 * model is about what the shop can do and not about filling a grid — a
 * dashboard is read or it is not, and `sales.refund` exists precisely because
 * it is not "edit a sale".
 */
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

  "categories.view",
  "categories.create",
  "categories.update",
  "categories.delete",

  "brands.view",
  "brands.create",
  "brands.update",
  "brands.delete",

  "units.view",
  "units.create",
  "units.update",
  "units.delete",

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

  // Reading the branch list is not a settings privilege: a till has to know
  // which shop it is standing in before it can sell anything, so every role
  // gets the read. Deciding what shops exist is an administrative act, and
  // that is the half kept back.
  "branches.view",
  "branches.manage",

  // Warehouses are stock locations and follow branches exactly: everyone may
  // read the list because a stock movement has to name a destination, and
  // deciding what locations exist stays administrative. There was no
  // `warehouses` permission at all before this, which meant the Warehouses
  // screen was gated on a key nothing could ever grant — invisible to every
  // role and refused to every role that reached it by URL.
  "warehouses.view",
  "warehouses.manage",

  "settings.view",
  "settings.update",
  "settings.billing",

  "activity.view",

  /*
   * Your own notifications, and the help screen.
   *
   * These were the last two entries in the sidebar that no permission
   * governed: `moduleForRoute` returned null for both, so they were drawn for
   * everybody unconditionally. That made "this role may do nothing" a menu
   * with two items in it — and left an owner with no way to take them away.
   *
   * They are granted to every role below, so nothing changes for anyone who
   * has not asked for it. What changes is that a workspace can now decide,
   * and that a role stripped to nothing renders nothing.
   *
   * Note what is deliberately NOT here: `/profile`. Your own account, your own
   * password and the sign-out button are yours by virtue of having one, and
   * gating them is how somebody ends up locked into a workspace they cannot
   * even leave.
   */
  "notifications.view",

  "support.view",

  "loyalty.view",
  "loyalty.create",
  "loyalty.update",
  "loyalty.delete",

  "qa.view",
  "qa.create",
  "qa.update",
  "qa.delete",

  "ebm_settings.view",
  "ebm_settings.create",
  "ebm_settings.update",
  "ebm_settings.delete",

  "workspace_chat.view",
  "workspace_chat.create",
  "workspace_chat.update",
  "workspace_chat.delete",

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

/**
 * Human-readable role name. The stored value is a key ("inventory_officer");
 * anything shown to a person — an email, an export — should read
 * "Inventory Officer" instead.
 */
export function roleLabel(role: string): string {
  return role
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

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

const VIEWER: Permission[] = [
  "dashboard.view",
  "products.view",
  "categories.view",
  "brands.view",
  "units.view",
  "sales.view",
  "reports.view",
  // Every other role list is built on this one, so this is how "everybody can
  // see which branches exist" is expressed.
  "branches.view",
  "warehouses.view",
  /*
   * Collaboration is not a privilege. Chat was owner-only by omission, which
   * made the one feature whose entire point is that everybody is in it visible
   * to exactly one person per workspace. Reading and posting are here;
   * editing and deleting other people's messages is moderation and sits with
   * managers.
   */
  "workspace_chat.view",
  "workspace_chat.create",
  // Everybody starts with their own notifications and the help screen. They
  // are in the catalogue so they can be revoked, not so they are withheld.
  "notifications.view",
  "support.view",
];

const SALES_STAFF: Permission[] = [
  ...VIEWER,
  "pos.use",
  "sales.create",
  "customers.view",
  "customers.create",
  "customers.update",
  // Whoever is serving the customer is who needs to see their points balance.
  "loyalty.view",
];

/**
 * A cashier runs the till and keeps the sellable catalogue usable during a
 * shift. They may add/edit products and correct/count stock, but may not
 * delete catalogue records, decide prices/costs, unmake completed sales, or
 * see the margin.
 */
const CASHIER: Permission[] = [
  ...SALES_STAFF,
  "sales.refund",
  "products.create",
  "products.update",
  "categories.create",
  "categories.update",
  "brands.create",
  "brands.update",
  "units.create",
  "units.update",
  "inventory.view",
  "inventory.adjust",
  "inventory.count",
];

const INVENTORY_OFFICER: Permission[] = [
  ...VIEWER,
  "products.create",
  "products.update",
  "products.viewCost",
  "categories.create",
  "categories.update",
  "brands.create",
  "brands.update",
  "units.create",
  "units.update",
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
  "categories.delete",
  "brands.delete",
  "units.delete",
  "purchases.delete",
    "suppliers.delete",
    "customers.delete",
    "staff.view",
    "settings.view",
    "loyalty.create",
    "loyalty.update",
    "loyalty.delete",
    "workspace_chat.update",
    "workspace_chat.delete",
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
    "branches.manage",
    "warehouses.manage",
    "settings.update",
    /*
     * Setting up the RRA EBM link is administration, not ownership — it was
     * owner-only by omission, so the person who actually configures a shop's
     * tax integration could not open the screen. Removing one is still an
     * owner's call.
     */
    "ebm_settings.view",
    "ebm_settings.create",
    "ebm_settings.update",
    // Reading the diagnostics screen; changing what it holds stays with the owner.
    "qa.view",
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
  overrides: readonly PermissionOverride[] = [],
  userOverrides: readonly PermissionOverride[] = []
): Permission[] {
  if (!isRole(role)) return [];

  const effective = new Set<Permission>(DEFAULT_ROLE_PERMISSIONS[role]);

  for (const override of overrides) {
    if (!isPermission(override.permission)) continue;
    if (override.granted) effective.add(override.permission);
    else effective.delete(override.permission);
  }

  for (const override of userOverrides) {
    if (!isPermission(override.permission)) continue;
    if (override.granted) effective.add(override.permission);
    else effective.delete(override.permission);
  }

  return [...effective].sort();
}

/**
 * The override rows that make a role hold exactly the permissions asked for.
 *
 * ## Why this is a diff and not a dump
 *
 * The obvious implementation of "set this role's permissions" writes one row
 * per permission — a hundred and change rows saying `granted: true` or
 * `granted: false`. It works today and rots tomorrow: a role written that way
 * is frozen against the shipped defaults forever, so when a new module ships
 * every workspace that ever pressed a bulk button is locked out of it until
 * somebody notices and edits the role by hand. That is the exact failure
 * `resolvePermissions` was designed to avoid, and a bulk endpoint is the
 * easiest possible way to reintroduce it at scale.
 *
 * So only disagreements with the defaults are stored. "Grant everything" on a
 * cashier writes rows for the permissions a cashier does not normally have and
 * nothing else; "reset to defaults" writes no rows at all. A workspace that
 * has never customised a role keeps tracking the product, which is what a
 * workspace that has never customised a role should do.
 *
 * Permissions the application does not recognise are dropped rather than
 * stored — a client sending a stale name from an older build must not be able
 * to plant a row that means nothing.
 */
export function overridesForPermissionSet(
  role: string,
  desired: Iterable<string>
): PermissionOverride[] {
  if (!isRole(role)) return [];

  const wanted = new Set<string>();
  for (const permission of desired) {
    if (isPermission(permission)) wanted.add(permission);
  }

  const defaults = new Set<string>(DEFAULT_ROLE_PERMISSIONS[role]);

  const rows: PermissionOverride[] = [];
  for (const permission of ALL_PERMISSIONS) {
    const granted = wanted.has(permission);
    if (granted !== defaults.has(permission)) rows.push({ permission, granted });
  }

  return rows;
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

export function overridesForMemberPermissionSet(
  role: string,
  desired: Iterable<string>,
  roleOverrides: readonly PermissionOverride[] = []
): PermissionOverride[] {
  if (!isRole(role)) return [];

  const wanted = new Set<string>();
  for (const permission of desired) {
    if (isPermission(permission)) wanted.add(permission);
  }

  const roleEffective = new Set<string>(resolvePermissions(role, roleOverrides));

  const rows: PermissionOverride[] = [];
  for (const permission of ALL_PERMISSIONS) {
    const granted = wanted.has(permission);
    if (granted !== roleEffective.has(permission)) rows.push({ permission, granted });
  }

  return rows;
}
