import { beforeEach, describe, expect, it } from "vitest";
import {
  cachePermissions,
  cachedPermissions,
  cachedRole,
  can,
  clearCachedPermissions,
} from "@/lib/permissions";

/**
 * The cache decides what a disconnected till puts on screen. It is not a
 * security boundary — anything done offline is re-checked by the server at
 * sync — but showing a cashier a button that deletes the product catalogue is
 * still a bug, so the rules about when it answers and when it refuses matter.
 */

const USER = "user-1";
const TENANT = "tenant-1";

beforeEach(() => {
  localStorage.clear();
});

describe("caching what the server said", () => {
  it("gives back the permissions it was given", () => {
    cachePermissions({ userId: USER, tenantId: TENANT, role: "cashier", permissions: ["pos.use"] });

    expect(cachedPermissions(USER, TENANT)).toEqual(["pos.use"]);
    expect(cachedRole(USER, TENANT)).toBe("cashier");
  });

  it("gives nothing when there is nothing cached", () => {
    expect(cachedPermissions(USER, TENANT)).toEqual([]);
    expect(cachedRole(USER, TENANT)).toBeNull();
  });

  it("refuses to hand one user another's authority", () => {
    // A shared till that two people sign into must not leak the manager's
    // permissions to the cashier who logs in after them.
    cachePermissions({
      userId: "manager-user",
      tenantId: TENANT,
      role: "manager",
      permissions: ["products.delete"],
    });

    expect(cachedPermissions(USER, TENANT)).toEqual([]);
  });

  it("refuses to carry permissions across workspaces", () => {
    cachePermissions({
      userId: USER,
      tenantId: "other-tenant",
      role: "owner",
      permissions: ["users.remove"],
    });

    expect(cachedPermissions(USER, TENANT)).toEqual([]);
  });

  it("stops trusting an answer that has gone stale", () => {
    /*
     * A till that has been in a drawer for months should not still be showing
     * someone who left as a manager. Falling back to nothing forces one
     * connection, which is a far better outcome than stale authority.
     */
    cachePermissions({ userId: USER, tenantId: TENANT, role: "manager", permissions: ["products.delete"] });

    const stored = JSON.parse(localStorage.getItem("shopcore_permissions")!);
    stored.cachedAt = Date.now() - 40 * 24 * 60 * 60 * 1000;
    localStorage.setItem("shopcore_permissions", JSON.stringify(stored));

    expect(cachedPermissions(USER, TENANT)).toEqual([]);
  });

  it("survives a corrupted entry without throwing", () => {
    localStorage.setItem("shopcore_permissions", "{not json");
    expect(cachedPermissions(USER, TENANT)).toEqual([]);
  });

  it("forgets everything on sign-out", () => {
    cachePermissions({ userId: USER, tenantId: TENANT, role: "cashier", permissions: ["pos.use"] });
    clearCachedPermissions();
    expect(cachedPermissions(USER, TENANT)).toEqual([]);
  });
});

describe("deciding what to show", () => {
  it("prefers the live answer when there is one", () => {
    cachePermissions({ userId: USER, tenantId: TENANT, role: "cashier", permissions: ["pos.use"] });

    // Freshly demoted: the live list wins over the cache immediately.
    expect(can("pos.use", [], { userId: USER, tenantId: TENANT })).toBe(true);
    expect(can("products.delete", ["sales.view"], { userId: USER, tenantId: TENANT })).toBe(false);
  });

  it("falls back to the cache when offline", () => {
    cachePermissions({ userId: USER, tenantId: TENANT, role: "cashier", permissions: ["pos.use"] });

    expect(can("pos.use", null, { userId: USER, tenantId: TENANT })).toBe(true);
    expect(can("products.delete", null, { userId: USER, tenantId: TENANT })).toBe(false);
  });

  it("shows nothing extra when it knows nothing", () => {
    // Empty rather than permissive: too little is a support call, too much is
    // a cashier discovering they can delete the catalogue.
    expect(can("pos.use", null, { userId: USER, tenantId: TENANT })).toBe(false);
  });
});
