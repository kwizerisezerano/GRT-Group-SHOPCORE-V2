import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

/**
 * The four signed-out screens actually render.
 *
 * They were rebuilt onto a shared shell — the brand panel, the field wrapper
 * and the heading all moved out of the login page and into
 * components/auth/AuthShell — and the backend suite cannot see any of that.
 * A missing translation key, a hook called outside its provider or a bad
 * import would leave a person staring at a blank page with the API answering
 * perfectly, which is the one failure mode integration tests miss entirely.
 *
 * These assert the things a person has to be able to see and do: the heading
 * that says which step this is, the fields, and the submit control.
 */

const requestPasswordReset = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/apiClient", () => ({
  authApi: {
    requestPasswordReset: (email: string) => requestPasswordReset(email),
    verifyOtp: vi.fn(),
    requestOtp: vi.fn(),
    changePassword: vi.fn(),
    completePasswordReset: vi.fn(),
    me: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status = 400;
    code = "";
  },
}));

/*
 * Sign-in redirects away when somebody is already signed in — correct
 * behaviour, and it means that screen has to be rendered signed-out while the
 * other three (which only exist mid-sign-in) need a user present.
 */
let signedIn: { email: string } | null = { email: "ada@shopcore.io" };

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    get user() {
      return signedIn;
    },
    loading: false,
    refreshTenant: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("@/lib/offlineAuth", () => ({
  loginOffline: vi.fn(),
  setupOfflineLogin: vi.fn(),
  isOfflineMode: () => false,
}));

/** The shell reads copy through the language context; give it the real keys. */
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: "en",
    setLanguage: vi.fn(),
  }),
}));

vi.mock("@/components/settings/LanguageSelector", () => ({
  LanguageSelector: () => null,
}));

vi.mock("@/components/settings/ThemeToggle", () => ({
  ThemeToggle: () => null,
}));

function at(ui: React.ReactElement, route = "/") {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
}

describe("signed-out screens render", () => {
  /*
   * The longer budget is for the import, not the assertions: sign-in pulls in
   * the whole auth shell and its icon set, which on a cold cache takes longer
   * than the 5s default on a slow machine. The render itself is instant.
   */
  it(
    "sign-in shows both fields and the submit button",
    async () => {
      signedIn = null;
      const { default: Login } = await import("./onboarding/Login");
      at(<Login />);

      expect(screen.getByLabelText(/login\.email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/login\.password/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /publicNav\.login/i })).toBeInTheDocument();
    },
    30_000,
  );

  it("the verification screen shows six code boxes and a verify action", async () => {
    signedIn = { email: "ada@shopcore.io" };
    const { default: VerifyOtp } = await import("./VerifyOtp");
    at(<VerifyOtp />);

    expect(screen.getByText(/Verify it's you/i)).toBeInTheDocument();
    // One input per digit, each individually labelled for screen readers.
    for (let i = 1; i <= 6; i++) {
      expect(screen.getByLabelText(`Digit ${i} of 6`)).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: /Verify and continue/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Resend code|Send a new code/i })).toBeInTheDocument();
  });

  it("the forced first password change asks for the temporary password and a new one", async () => {
    const { default: ForcePasswordChange } = await import("./ForcePasswordChange");
    at(<ForcePasswordChange />);

    expect(screen.getByText(/Choose your password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Temporary password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^New password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm new password/i)).toBeInTheDocument();
  });

  it("a reset link with no token explains itself instead of showing an empty form", async () => {
    const { default: ResetPassword } = await import("./ResetPassword");
    at(<ResetPassword />, "/reset-password");

    expect(screen.getByText(/Link no longer valid/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Back to sign in/i })).toBeInTheDocument();
  });

  /*
   * The context panel is the reason these screens are a split rather than a
   * lone form: it is where a person confirms which product they are signing
   * into and which of six near-identical screens they are on. Asserted per
   * screen because the whole point is that each one says something different.
   */
  it("sign-in explains what is on the other side of the form", async () => {
    signedIn = null;
    const { default: Login } = await import("./onboarding/Login");
    at(<Login />);

    expect(screen.getAllByText(/Sign in to access your workspace/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Everything syncs the moment you reconnect/i)).toBeInTheDocument();
  });

  it("the code screen says why it is asking, not just that it is", async () => {
    signedIn = { email: "ada@shopcore.io" };
    const { default: VerifyOtp } = await import("./VerifyOtp");
    at(<VerifyOtp />);

    expect(screen.getAllByText(/We sent you a code/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/proves the account is yours/i)).toBeInTheDocument();
  });

  it("an expired reset link explains why links expire", async () => {
    const { default: ResetPassword } = await import("./ResetPassword");
    at(<ResetPassword />, "/reset-password");

    expect(screen.getAllByText(/already been used/i).length).toBeGreaterThan(0);
  });

  it("a reset link with a token shows the two password fields", async () => {
    const { default: ResetPassword } = await import("./ResetPassword");
    at(<ResetPassword />, "/reset-password?token=abc123");

    expect(screen.getByText(/Set a new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^New password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm password/i)).toBeInTheDocument();
  });
});
