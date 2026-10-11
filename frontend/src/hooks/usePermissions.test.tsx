import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The behaviours here are the ones that broke in production, not the ones that
 * are easy to test:
 *
 *  - the sidebar and the route guard must see the *same* answer, or the menu
 *    opens a page that then refuses;
 *  - they must not each fetch it, or every navigation costs two requests;
 *  - an empty list must not read as "allowed nothing" before we have asked;
 *  - one workspace's answer must never be shown for another.
 *
 * The hook keeps its state in a module-level store on purpose — that is what
 * makes every consumer agree — so each test re-imports the module to get a
 * fresh one rather than reaching into it.
 */

const myPermissions = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  usersApi: {
    myPermissions: () => myPermissions(),
  },
}));

vi.mock("@/lib/connectivity", () => ({
  onConnectivityChange: () => () => {},
}));

const authState = {
  user: { id: "user-1" } as { id: string } | null,
  tenantId: "tenant-1" as string | null,
  permissions: [] as unknown[],
  role: null as string | null,
};

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

let usePermissions: typeof import("./usePermissions").usePermissions;

function Probe({ label }: { label: string }) {
  const { permissions, ready, canSeeModule } = usePermissions();

  return (
    <div>
      <span data-testid={`${label}-ready`}>{String(ready)}</span>
      <span data-testid={`${label}-count`}>{permissions.length}</span>
      <span data-testid={`${label}-expenses`}>{String(canSeeModule("expenses"))}</span>
    </div>
  );
}

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  myPermissions.mockReset();

  authState.user = { id: "user-1" };
  authState.tenantId = "tenant-1";
  authState.permissions = [];
  authState.role = null;

  ({ usePermissions } = await import("./usePermissions"));
});

afterEach(() => {
  localStorage.clear();
});

describe("usePermissions", () => {
  it("serves every consumer from one request", async () => {
    myPermissions.mockResolvedValue({
      role: "cashier",
      permissions: ["products.view", "pos.use"],
    });

    render(
      <>
        <Probe label="sidebar" />
        <Probe label="guard" />
        <Probe label="page" />
      </>
    );

    await waitFor(() => {
      expect(screen.getByTestId("sidebar-ready").textContent).toBe("true");
    });

    // Three consumers, one call.
    expect(myPermissions).toHaveBeenCalledTimes(1);

    // And all three agree, which is the point.
    for (const label of ["sidebar", "guard", "page"]) {
      expect(screen.getByTestId(`${label}-count`).textContent).toBe("2");
      expect(screen.getByTestId(`${label}-expenses`).textContent).toBe("false");
    }
  });

  it("reports not-ready until an answer exists, so nothing gates on a guess", async () => {
    let resolveRequest: (value: unknown) => void = () => {};
    myPermissions.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      })
    );

    render(<Probe label="guard" />);

    // Nothing cached and nothing answered: unknown, not "allowed nothing".
    expect(screen.getByTestId("guard-ready").textContent).toBe("false");

    resolveRequest({ role: "viewer", permissions: ["dashboard.view"] });

    await waitFor(() => {
      expect(screen.getByTestId("guard-ready").textContent).toBe("true");
    });
  });

  it("keeps the cached answer when the refresh fails", async () => {
    localStorage.setItem(
      "shopcore_permissions",
      JSON.stringify({
        userId: "user-1",
        tenantId: "tenant-1",
        role: "cashier",
        permissions: ["products.view"],
        cachedAt: Date.now(),
      })
    );

    myPermissions.mockRejectedValue(new Error("offline"));

    render(<Probe label="guard" />);

    // Seeded from the cache synchronously — a disconnected till keeps its menu.
    expect(screen.getByTestId("guard-ready").textContent).toBe("true");
    expect(screen.getByTestId("guard-count").textContent).toBe("1");

    await waitFor(() => {
      expect(myPermissions).toHaveBeenCalled();
    });

    // The failure changed nothing: still ready, still the cached list.
    await waitFor(() => {
      expect(screen.getByTestId("guard-ready").textContent).toBe("true");
    });
    expect(screen.getByTestId("guard-count").textContent).toBe("1");
  });

  it("ignores a cached answer belonging to another workspace", async () => {
    localStorage.setItem(
      "shopcore_permissions",
      JSON.stringify({
        userId: "user-1",
        tenantId: "tenant-1",
        role: "owner",
        permissions: ["products.view", "expenses.view", "settings.view"],
        cachedAt: Date.now(),
      })
    );

    // Signed into a different workspace than the one that was cached.
    authState.tenantId = "tenant-2";

    let resolveRequest: (value: unknown) => void = () => {};
    myPermissions.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      })
    );

    render(<Probe label="guard" />);

    // The other workspace's cache must not seed this one.
    expect(screen.getByTestId("guard-ready").textContent).toBe("false");
    expect(screen.getByTestId("guard-expenses").textContent).toBe("false");

    resolveRequest({ role: "cashier", permissions: ["products.view"] });

    await waitFor(() => {
      expect(screen.getByTestId("guard-ready").textContent).toBe("true");
    });

    expect(screen.getByTestId("guard-count").textContent).toBe("1");
    expect(screen.getByTestId("guard-expenses").textContent).toBe("false");
  });
});
