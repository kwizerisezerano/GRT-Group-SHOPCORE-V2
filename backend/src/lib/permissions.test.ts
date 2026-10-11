import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_MODULES,
  ROLES,
  overridesForPermissionSet,
  resolvePermissions,
} from "./permissions";

/**
 * The permission model, checked without a database.
 *
 * Everything here is about one property: what an owner sees on the permission
 * screen, what the API stores, and what the member is then allowed to do have
 * to be the same answer. Each test below is a way that used to come apart.
 */

describe("the catalogue itself", () => {
  it("has no duplicates", () => {
    // A duplicate is two switches for one permission, and they disagree the
    // moment either is flipped.
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);
  });

  it("names a declared module in every permission", () => {
    /*
     * The client hides menus by module, so a permission whose module is not in
     * PERMISSION_MODULES is a permission that can be granted and still leaves
     * the screen invisible.
     */
    const modules = new Set<string>(PERMISSION_MODULES);

    for (const permission of ALL_PERMISSIONS) {
      const [module, action] = permission.split(".");
      expect(modules.has(module), `${permission} names an unknown module`).toBe(true);
      expect(action, `${permission} has no action`).toBeTruthy();
    }
  });

  it("gives every declared module at least one permission", () => {
    // The reverse failure: a module nothing can ever grant is a screen nobody
    // can ever reach. `warehouses` was exactly this before it had keys.
    for (const module of PERMISSION_MODULES) {
      const owned = ALL_PERMISSIONS.filter((p) => p.startsWith(`${module}.`));
      expect(owned.length, `${module} has no permissions`).toBeGreaterThan(0);
    }
  });

  it("keeps every role's defaults inside the catalogue", () => {
    const known = new Set<string>(ALL_PERMISSIONS);

    for (const role of ROLES) {
      for (const permission of DEFAULT_ROLE_PERMISSIONS[role]) {
        expect(known.has(permission), `${role} defaults to unknown ${permission}`).toBe(true);
      }
    }
  });

  it("gives every role its own notifications and the help screen", () => {
    /*
     * These arrived in the catalogue so that a workspace could revoke them,
     * not so that anybody would lose them. Every role builds on VIEWER, so
     * every role has them until someone decides otherwise — and the sidebar
     * looks exactly as it did before for anyone who has not.
     */
    for (const role of ROLES) {
      expect(DEFAULT_ROLE_PERMISSIONS[role], role).toContain("notifications.view");
      expect(DEFAULT_ROLE_PERMISSIONS[role], role).toContain("support.view");
    }
  });

  it("keeps the account screen out of the catalogue entirely", () => {
    /*
     * There is deliberately no `profile.*`. Your own password and the sign-out
     * button are yours by virtue of having an account; a permission for them
     * is a way to lock somebody inside a workspace they cannot use and cannot
     * leave.
     */
    expect(ALL_PERMISSIONS.some((p) => p.startsWith("profile."))).toBe(false);
    expect(PERMISSION_MODULES).not.toContain("profile");
  });

  it("gives the owner everything", () => {
    expect([...DEFAULT_ROLE_PERMISSIONS.owner].sort()).toEqual([...ALL_PERMISSIONS].sort());
  });
});

describe("resolvePermissions", () => {
  it("returns the shipped defaults when nothing is customised", () => {
    expect(resolvePermissions("cashier")).toEqual(
      [...DEFAULT_ROLE_PERMISSIONS.cashier].sort()
    );
  });

  it("adds a grant and removes a revocation", () => {
    const resolved = resolvePermissions("cashier", [
      { permission: "products.delete", granted: true },
      { permission: "pos.use", granted: false },
    ]);

    expect(resolved).toContain("products.delete");
    expect(resolved).not.toContain("pos.use");
  });

  it("ignores overrides naming a permission that no longer exists", () => {
    /*
     * A row left behind by a removed feature must not resurrect it or crash a
     * login. This is not hypothetical: the dead `pos.view`/`dashboard.create`
     * family was removed from the catalogue while workspaces may still hold
     * rows for them.
     */
    const resolved = resolvePermissions("cashier", [
      { permission: "pos.view", granted: true },
      { permission: "dashboard.create", granted: true },
    ]);

    expect(resolved).not.toContain("pos.view");
    expect(resolved).not.toContain("dashboard.create");
    expect(resolved).toEqual([...DEFAULT_ROLE_PERMISSIONS.cashier].sort());
  });

  it("gives an unknown role nothing at all", () => {
    // Fail closed: a role we cannot recognise is not a role we should guess at.
    expect(resolvePermissions("superuser")).toEqual([]);
  });
});

describe("overridesForPermissionSet", () => {
  it("stores nothing when the target set is already the default", () => {
    /*
     * The whole point. Writing today's defaults in as rows would freeze the
     * role against every module released afterwards, so "reset to defaults" —
     * and any bulk write that happens to land on them — must produce no rows.
     */
    expect(overridesForPermissionSet("cashier", DEFAULT_ROLE_PERMISSIONS.cashier)).toEqual([]);
  });

  it("stores only the difference when granting everything", () => {
    const rows = overridesForPermissionSet("cashier", ALL_PERMISSIONS);

    expect(rows.every((row) => row.granted)).toBe(true);
    expect(rows.length).toBe(ALL_PERMISSIONS.length - DEFAULT_ROLE_PERMISSIONS.cashier.length);
    // Nothing the role already had by default is restated.
    for (const row of rows) {
      expect(DEFAULT_ROLE_PERMISSIONS.cashier).not.toContain(row.permission);
    }
  });

  it("stores only the difference when revoking everything", () => {
    const rows = overridesForPermissionSet("cashier", []);

    expect(rows.every((row) => !row.granted)).toBe(true);
    expect(rows.length).toBe(DEFAULT_ROLE_PERMISSIONS.cashier.length);
  });

  it("round-trips: resolving its own rows gives back exactly the target set", () => {
    /*
     * The property the bulk endpoint depends on. If this ever fails, an owner
     * presses a button and the role ends up holding something other than what
     * the screen said it would.
     */
    for (const role of ROLES) {
      for (const target of [
        [...ALL_PERMISSIONS],
        [],
        [...DEFAULT_ROLE_PERMISSIONS[role]],
        ["pos.use", "sales.create", "reports.viewProfit"],
      ]) {
        const rows = overridesForPermissionSet(role, target);
        expect(resolvePermissions(role, rows), `${role} did not round-trip`).toEqual(
          [...new Set(target)].sort()
        );
      }
    }
  });

  it("drops permissions the application does not recognise", () => {
    // A client on an older build must not be able to plant a meaningless row.
    const rows = overridesForPermissionSet("cashier", ["pos.use", "sales.deleteEverything"]);

    expect(rows.some((row) => row.permission === "sales.deleteEverything")).toBe(false);
    expect(resolvePermissions("cashier", rows)).toEqual(["pos.use"]);
  });

  it("gives an unknown role no rows", () => {
    expect(overridesForPermissionSet("superuser", ALL_PERMISSIONS)).toEqual([]);
  });
});
