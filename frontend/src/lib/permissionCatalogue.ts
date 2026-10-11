/**
 * The permission editor's structure, derived from the server's own catalogue.
 *
 * ## Why this is derived rather than written down
 *
 * The editor used to hold its own list of modules and offer every one of them
 * the same four checkboxes — View, Create, Edit, Delete — then translate each
 * back to a `module.action` string on the way out. Three things went wrong,
 * and all three ended as "I ticked the box and nothing happened":
 *
 *   1. **Checkboxes the API rejects.** Branches and Warehouses have no
 *      `.create`/`.update`/`.delete`; they have `.manage`. Six switches in the
 *      grid posted permissions that failed validation with 400.
 *
 *   2. **A checkbox wired to the wrong permission.** Reports' "View" was
 *      mapped to `reports.viewProfit`. Unticking it left `reports.view`
 *      untouched, so the module stayed visible and the revocation appeared to
 *      do nothing — while ticking it handed out margin visibility, the most
 *      sensitive number in the business, under a label that said "View".
 *
 *   3. **Permissions with no checkbox at all.** `sales.refund`,
 *      `products.viewCost`, `products.setPrice`, `inventory.adjust`,
 *      `settings.billing` and the whole `users.*` group were unreachable, so
 *      they could not be granted or revoked from the UI at all.
 *
 * A four-column grid cannot express this permission model, because the model
 * is deliberately not four columns — `sales.refund` exists precisely because
 * it is not "edit a sale". So the editor is built from `ALL_PERMISSIONS` as
 * the server reports it: one switch per real permission, and no switch that
 * does not correspond to one. New permissions appear in the UI the release
 * they ship, with no second list to update.
 */

export type CatalogueAction = {
  /** The exact string the API accepts, e.g. `sales.refund`. */
  permission: string;
  /** The action half, e.g. `refund`. */
  action: string;
  /** What to put next to the switch. */
  label: string;
  /** Shown under sensitive actions so nobody grants one by accident. */
  hint?: string;
};

export type CatalogueModule = {
  module: string;
  label: string;
  actions: CatalogueAction[];
};

/**
 * Which tab a module sits under. Modules the server reports but that are not
 * listed here still appear, under "Other" — a new module must never become
 * invisible just because this list was not updated.
 */
export const PERMISSION_GROUPS: { key: string; label: string; modules: string[] }[] = [
  {
    key: "core",
    label: "Core",
    modules: ["dashboard", "settings", "notifications", "support", "activity", "qa"],
  },
  { key: "sales", label: "Sales", modules: ["pos", "sales", "customers", "loyalty"] },
  { key: "catalog", label: "Catalog", modules: ["products", "categories", "brands", "units"] },
  { key: "inventory", label: "Inventory", modules: ["inventory", "suppliers", "warehouses"] },
  { key: "finance", label: "Finance", modules: ["purchases", "expenses", "reports"] },
  {
    key: "admin",
    label: "Enterprise",
    modules: ["users", "staff", "branches", "ebm_settings", "workspace_chat"],
  },
];

const MODULE_LABELS: Record<string, string> = {
  pos: "POS",
  support: "Help & Support",
  qa: "QA",
  ebm_settings: "EBM Settings",
  workspace_chat: "Workspace Chat",
  activity: "Activity Logs",
  users: "User Management",
};

/**
 * Action labels. Anything unlisted is de-camel-cased, so a permission added
 * later reads sensibly without an entry here.
 */
const ACTION_LABELS: Record<string, string> = {
  view: "View",
  create: "Create",
  update: "Edit",
  delete: "Delete",
  use: "Use",
  manage: "Manage",
  export: "Export",
  invite: "Invite",
  remove: "Remove",
  count: "Count",
  adjust: "Adjust",
  transfer: "Transfer",
  refund: "Refund",
  billing: "Billing",
  viewCost: "View cost",
  setPrice: "Set price",
  viewProfit: "View profit",
  voidCompleted: "Void completed sale",
  assignRole: "Assign role",
  managePermissions: "Manage permissions",
};

/**
 * The ones worth a second's thought before granting. These are the reason the
 * model is not four columns, so the editor says out loud what each one means.
 */
const ACTION_HINTS: Record<string, string> = {
  "products.viewCost": "Sees what the shop pays, not just what it charges.",
  "products.setPrice": "Decides selling prices.",
  "reports.viewProfit": "Sees margin — the most sensitive figure in the workspace.",
  "sales.refund": "Money leaving the till.",
  "sales.voidCompleted": "Unmakes a completed sale record.",
  "settings.billing": "Changes the subscription and payment details.",
  "users.assignRole": "Changes what other members may do.",
  "users.managePermissions": "Edits this permission matrix itself.",
  "users.remove": "Removes members from the workspace.",
  "branches.manage": "Creates, edits and deletes branches.",
  "warehouses.manage": "Creates, edits and deletes warehouses.",
  "staff.manage": "Full control of staff records.",
};

/** Order actions predictably: the everyday four first, specials after. */
const ACTION_ORDER = [
  "view", "use", "create", "update", "delete",
  "manage", "adjust", "count", "transfer",
  "refund", "voidCompleted", "setPrice", "viewCost",
  "viewProfit", "export",
  "invite", "assignRole", "remove", "managePermissions", "billing",
];

function actionLabel(action: string) {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];

  const spaced = action.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function moduleLabel(module: string) {
  return (
    MODULE_LABELS[module] ??
    module.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/**
 * Groups the server's flat permission list into modules and ordered actions.
 *
 * Everything the server reports gets a switch; nothing else does. That is the
 * whole guarantee — the editor cannot offer a permission the API will refuse,
 * and cannot hide one it will accept.
 */
export function buildCatalogue(catalogue: readonly string[]): CatalogueModule[] {
  const byModule = new Map<string, CatalogueAction[]>();

  for (const permission of catalogue) {
    const separator = permission.indexOf(".");
    if (separator < 1) continue;

    const module = permission.slice(0, separator);
    const action = permission.slice(separator + 1);

    const actions = byModule.get(module) ?? [];
    if (actions.some((existing) => existing.permission === permission)) continue;

    actions.push({
      permission,
      action,
      label: actionLabel(action),
      hint: ACTION_HINTS[permission],
    });

    byModule.set(module, actions);
  }

  const rank = (action: string) => {
    const index = ACTION_ORDER.indexOf(action);
    return index === -1 ? ACTION_ORDER.length : index;
  };

  return [...byModule.entries()]
    .map(([module, actions]) => ({
      module,
      label: moduleLabel(module),
      actions: actions.sort((a, b) => rank(a.action) - rank(b.action) || a.action.localeCompare(b.action)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Splits the catalogue across the group tabs, keeping a module out of more
 * than one tab and sweeping anything unlisted into "Other".
 */
export function groupCatalogue(modules: CatalogueModule[]) {
  const byKey = new Map(modules.map((entry) => [entry.module, entry]));
  const placed = new Set<string>();

  const groups = PERMISSION_GROUPS.map((group) => {
    const items = group.modules
      .map((module) => byKey.get(module))
      .filter((entry): entry is CatalogueModule => Boolean(entry));

    for (const item of items) placed.add(item.module);

    return { key: group.key, label: group.label, modules: items };
  }).filter((group) => group.modules.length > 0);

  const leftovers = modules.filter((entry) => !placed.has(entry.module));
  if (leftovers.length > 0) {
    groups.push({ key: "other", label: "Other", modules: leftovers });
  }

  return groups;
}
