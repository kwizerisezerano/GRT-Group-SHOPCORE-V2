import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "./ProtectedRoute";

/**
 * The two first-sign-in gates, and the order they run in.
 *
 * These decide whether someone who has just finished a step lands where they
 * were sent or gets bounced back to it, and every failure here has been a
 * real one:
 *
 *  - a stale `otp_required` once made the verification screen un-passable;
 *  - the same shape of bug on `must_change_password` sent someone who had
 *    just chosen a password back to the form asking for the temporary one;
 *  - and with *both* flags set the two gates redirected to each other
 *    forever, which the browser reports as "Maximum update depth exceeded"
 *    before it throttles navigation and the tab locks up.
 *
 * The last case is why this file exists. A redirect loop cannot be caught by
 * reading the code — each guard looks right on its own.
 */

const state = {
  user: { email: "ada@shopcore.io" } as { email: string } | null,
  session: { access_token: "t" } as { access_token: string } | null,
  loading: false,
  bootstrapping: false,
  mustChangePassword: false,
  otpRequired: false,
  tenantId: "tenant-1" as string | null,
  workspaceAccessStatus: "active",
};

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => state,
}));

vi.mock("@/lib/offlineAuth", () => ({
  isOfflineMode: () => false,
  getCachedOfflineAuth: () => null,
}));

const guarded = (label: string) => (
  <ProtectedRoute>
    <div>{label}</div>
  </ProtectedRoute>
);

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dashboard" element={guarded("dashboard")} />
        <Route path="/verify-otp" element={guarded("verify-otp")} />
        <Route path="/force-password-change" element={guarded("force-password-change")} />
        <Route path="/auth" element={<div>auth</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  state.user = { email: "ada@shopcore.io" };
  state.session = { access_token: "t" };
  state.loading = false;
  state.bootstrapping = false;
  state.mustChangePassword = false;
  state.otpRequired = false;
  state.tenantId = "tenant-1";
  state.workspaceAccessStatus = "active";
});

describe("first sign-in gates", () => {
  it("sends someone owing a password change to that screen", () => {
    state.mustChangePassword = true;
    renderAt("/dashboard");
    expect(screen.getByText("force-password-change")).toBeInTheDocument();
  });

  /*
   * The state immediately after a successful password change: the flag that
   * sent them to the form is cleared, the second factor is raised, and the
   * client navigates to /verify-otp. If either gate misfires the person sees
   * "Password updated" and then finds themselves back on the form.
   */
  it("lets the verification screen through once the password change is done", () => {
    state.mustChangePassword = false;
    state.otpRequired = true;
    renderAt("/verify-otp");
    expect(screen.getByText("verify-otp")).toBeInTheDocument();
  });

  it("still bounces the workspace while the code is outstanding", () => {
    state.otpRequired = true;
    renderAt("/dashboard");
    expect(screen.getByText("verify-otp")).toBeInTheDocument();
  });

  it("opens the workspace once the code is spent", () => {
    state.otpRequired = false;
    renderAt("/dashboard");
    expect(screen.getByText("dashboard")).toBeInTheDocument();
  });

  /*
   * Both flags set. The password gate has to win outright: the person is
   * still holding a credential they are required to replace, so asking for a
   * code first is both wrong and — before the fix — unsurvivable, because
   * the OTP gate then sent them straight back here.
   *
   * Each of these renders would hang the suite if the gates ping-ponged.
   */
  it("keeps someone on the password form when both gates are raised", () => {
    state.mustChangePassword = true;
    state.otpRequired = true;
    renderAt("/force-password-change");
    expect(screen.getByText("force-password-change")).toBeInTheDocument();
  });

  it("does not loop between the two gates when both are raised", () => {
    state.mustChangePassword = true;
    state.otpRequired = true;
    renderAt("/verify-otp");
    expect(screen.getByText("force-password-change")).toBeInTheDocument();
  });

  it("does not loop reaching the workspace with both gates raised", () => {
    state.mustChangePassword = true;
    state.otpRequired = true;
    renderAt("/dashboard");
    expect(screen.getByText("force-password-change")).toBeInTheDocument();
  });

  it("sends a signed-out visitor to sign in", () => {
    state.user = null;
    state.session = null;
    renderAt("/dashboard");
    expect(screen.getByText("auth")).toBeInTheDocument();
  });
});
