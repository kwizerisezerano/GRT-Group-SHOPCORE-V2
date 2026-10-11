import { describe, expect, it } from "vitest";
import { buildCatalogue, groupCatalogue, moduleLabel } from "./permissionCatalogue";

/**
 * The editor's structure, checked against its one guarantee: every switch it
 * draws is a permission the API accepts, and every permission the API accepts
 * gets a switch.
 *
 * Both halves failed before. The editor held its own list of modules and gave
 * each the same four checkboxes, so it offered `branches.create` (which does
 * not exist and 400s) while `sales.refund` and the whole `users.*` group had
 * no switch at all. Deriving the structure from the server's catalogue is what
 * fixed it, and these tests are what keep it fixed.
 */

const SERVER_CATALOGUE = [
  "dashboard.view",
  "pos.use",
  "sales.view",
  "sales.create",
  "sales.refund",
  "sales.voidCompleted",
  "products.view",
  "products.viewCost",
  "products.setPrice",
  "categories.view",
  "categories.delete",
  "branches.view",
  "branches.manage",
  "warehouses.view",
  "warehouses.manage",
  "reports.view",
  "reports.viewProfit",
  "users.managePermissions",
  "ebm_settings.view",
];

describe("buildCatalogue", () => {
  it("draws one switch per permission and invents none", () => {
    const drawn = buildCatalogue(SERVER_CATALOGUE)
      .flatMap((entry) => entry.actions.map((action) => action.permission))
      .sort();

    expect(drawn).toEqual([...SERVER_CATALOGUE].sort());
  });

  it("keeps modules whose actions are not the usual four", () => {
    /*
     * Branches and warehouses have `view` and `manage`, not
     * create/update/delete. A four-column grid cannot express that, which is
     * how six switches came to post permissions the API rejected outright.
     */
    const branches = buildCatalogue(SERVER_CATALOGUE).find((m) => m.module === "branches");

    expect(branches?.actions.map((a) => a.action)).toEqual(["view", "manage"]);
  });

  it("labels an action nobody wrote down, rather than showing the raw key", () => {
    const sales = buildCatalogue(["sales.voidCompleted", "sales.someNewAction"]).find(
      (m) => m.module === "sales"
    );

    expect(sales?.actions.find((a) => a.action === "voidCompleted")?.label).toBe(
      "Void completed sale"
    );
    // A permission that ships after this file was last touched still reads
    // sensibly, so a new one is never a blank row.
    expect(sales?.actions.find((a) => a.action === "someNewAction")?.label).toBe(
      "Some new action"
    );
  });

  it("warns on the permissions worth a second thought", () => {
    const catalogue = buildCatalogue(SERVER_CATALOGUE);
    const hintFor = (permission: string) =>
      catalogue.flatMap((m) => m.actions).find((a) => a.permission === permission)?.hint;

    // Reports' "View" was once wired to reports.viewProfit — granting margin
    // visibility under a label that said View. Both now exist separately and
    // only the sensitive one carries a warning.
    expect(hintFor("reports.view")).toBeUndefined();
    expect(hintFor("reports.viewProfit")).toContain("margin");
    expect(hintFor("products.viewCost")).toBeTruthy();
    expect(hintFor("sales.refund")).toBeTruthy();
  });

  it("puts view first and the sensitive actions last", () => {
    const sales = buildCatalogue(SERVER_CATALOGUE).find((m) => m.module === "sales");

    expect(sales?.actions.map((a) => a.action)).toEqual([
      "view",
      "create",
      "refund",
      "voidCompleted",
    ]);
  });

  it("skips anything that is not module.action", () => {
    expect(buildCatalogue(["", "nodot", ".leading"])).toEqual([]);
  });

  it("does not draw the same permission twice", () => {
    const products = buildCatalogue(["products.view", "products.view"]).find(
      (m) => m.module === "products"
    );

    expect(products?.actions).toHaveLength(1);
  });
});

describe("groupCatalogue", () => {
  it("places every module in exactly one tab", () => {
    const modules = buildCatalogue(SERVER_CATALOGUE);
    const grouped = groupCatalogue(modules).flatMap((group) =>
      group.modules.map((m) => m.module)
    );

    expect([...grouped].sort()).toEqual(modules.map((m) => m.module).sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it("sweeps an unlisted module into Other rather than dropping it", () => {
    /*
     * A module that ships before this file's group list is updated must still
     * be editable. Silently dropping it is how `warehouses` became a screen
     * gated on a permission nothing could ever grant.
     */
    const grouped = groupCatalogue(buildCatalogue(["brand_new_module.view"]));

    expect(grouped).toHaveLength(1);
    expect(grouped[0].key).toBe("other");
    expect(grouped[0].modules[0].module).toBe("brand_new_module");
  });

  it("leaves out a tab with nothing in it", () => {
    const grouped = groupCatalogue(buildCatalogue(["pos.use"]));

    expect(grouped.map((g) => g.key)).toEqual(["sales"]);
  });
});

describe("moduleLabel", () => {
  it("uses the name people say out loud", () => {
    expect(moduleLabel("pos")).toBe("POS");
    expect(moduleLabel("ebm_settings")).toBe("EBM Settings");
    expect(moduleLabel("users")).toBe("User Management");
  });

  it("falls back to a readable form for anything unlisted", () => {
    expect(moduleLabel("stock_counts")).toBe("Stock Counts");
  });
});
