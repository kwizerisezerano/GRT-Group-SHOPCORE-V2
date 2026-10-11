import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { moduleForRoute, permissionForRoute, routeAllowed } from "./moduleAccess";

/**
 * Every place the application offers to take you somewhere, checked against
 * the permission model.
 *
 * ## Why this reads the source instead of importing it
 *
 * The lists live inside `AppSidebar` and `CommandPalette` as module-scoped
 * consts, and importing either component drags in the router, the auth
 * context, the query client and a hundred icons to assert something about
 * thirty strings. Reading the file is uglier and tells the truth: if somebody
 * adds a nav entry, this test sees it whether or not they exported anything.
 *
 * ## What it is defending
 *
 * "A role with no permissions sees nothing." That claim is only as good as its
 * weakest entry, and it had three holes, each invisible from any single file:
 *
 *   - `/notifications` and `/support` were unmapped, so `moduleForRoute`
 *     returned null, `moduleAllowed(null)` returned true, and they were drawn
 *     for everybody unconditionally — a member stripped of everything still
 *     got a two-item System menu;
 *   - the command palette filtered by nothing at all, so ⌘K offered all
 *     twenty-nine destinations to every role;
 *   - `/billing` resolved to the `settings` module, so anyone who could read
 *     the workspace name was offered the payment portal.
 *
 * None of those are things you notice by reviewing a diff. They are things you
 * notice by enumerating.
 */

const SOURCE_ROOT = path.resolve(__dirname, "..");

/** Routes deliberately governed by nothing. Keep this at one. */
const UNGATED = new Set(["/profile"]);

function urlsIn(relativePath: string): string[] {
  const source = fs.readFileSync(path.join(SOURCE_ROOT, relativePath), "utf8");
  const found = [...source.matchAll(/url: "(\/[^"]*)"/g)].map((match) => match[1]);

  // A silent zero here would make every assertion below vacuously true, which
  // is the one way a coverage test can fail without failing.
  expect(found.length, `no nav urls found in ${relativePath}`).toBeGreaterThan(10);

  return [...new Set(found)];
}

const sidebarRoutes = urlsIn("components/AppSidebar.tsx");
const paletteRoutes = urlsIn("components/CommandPalette.tsx");

describe("every sidebar destination is governed by a permission", () => {
  it.each(sidebarRoutes)("%s resolves to a module or a named permission", (route) => {
    if (UNGATED.has(route)) return;

    const governed = moduleForRoute(route) !== null || permissionForRoute(route) !== null;
    expect(governed, `${route} is in the sidebar but no permission governs it`).toBe(true);
  });

  it("shows nothing whatsoever to a role holding nothing", () => {
    const survivors = sidebarRoutes.filter(
      (route) => !UNGATED.has(route) && routeAllowed([], route)
    );

    expect(survivors).toEqual([]);
  });

  it("shows the whole menu to a role holding everything", () => {
    /*
     * The other direction matters just as much. A route mapped to a module the
     * server never grants is invisible to every role including the owner —
     * which is exactly what happened to Warehouses before it had permissions,
     * and it is a far quieter bug than a leak.
     */
    const everything = [
      ...new Set(
        sidebarRoutes.flatMap((route) => {
          const named = permissionForRoute(route);
          if (named) return [named];
          const module = moduleForRoute(route);
          return module ? [`${module}.view`] : [];
        })
      ),
    ];

    const unreachable = sidebarRoutes.filter((route) => !routeAllowed(everything, route));
    expect(unreachable).toEqual([]);
  });
});

describe("the command palette offers no more than the sidebar", () => {
  it.each(paletteRoutes)("%s is governed", (route) => {
    if (UNGATED.has(route)) return;

    const governed = moduleForRoute(route) !== null || permissionForRoute(route) !== null;
    expect(governed, `⌘K offers ${route} but no permission governs it`).toBe(true);
  });

  it("offers nothing to a role holding nothing", () => {
    const survivors = paletteRoutes.filter(
      (route) => !UNGATED.has(route) && routeAllowed([], route)
    );

    expect(survivors).toEqual([]);
  });

  it("jumps nowhere the sidebar would not also show", () => {
    // The palette is a shortcut to the menu, not a second menu with its own
    // rules. A destination reachable by ⌘K and absent from the sidebar is
    // either a missing menu entry or a permission nobody thought about.
    const sidebarModules = new Set(sidebarRoutes.map(moduleForRoute));
    const strays = paletteRoutes.filter((route) => !sidebarModules.has(moduleForRoute(route)));

    expect(strays).toEqual([]);
  });
});
