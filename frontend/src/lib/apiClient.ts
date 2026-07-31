const TOKENS_KEY = "shopcore_auth_tokens";

export type ApiUser = {
  id: string;
  email: string;
  display_name: string | null;
  // Kept for compatibility with code that still reads Supabase-shaped
  // user metadata (e.g. `user?.user_metadata?.display_name`).
  user_metadata: { display_name: string | null };
};

export type ApiSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch seconds, matches the Supabase convention used elsewhere in this codebase
  user: ApiUser;
};

type StoredTokens = { accessToken: string; refreshToken: string };

function readStoredTokens(): StoredTokens | null {
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    return raw ? (JSON.parse(raw) as StoredTokens) : null;
  } catch {
    return null;
  }
}

function writeStoredTokens(tokens: StoredTokens) {
  try {
    localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
  } catch {
    // Local persistence may be unavailable.
  }
}

function clearStoredTokens() {
  try {
    localStorage.removeItem(TOKENS_KEY);
  } catch {
    // ignore
  }
}

function decodeAccessTokenExpiry(accessToken: string): number {
  try {
    const payload = JSON.parse(atob(accessToken.split(".")[1]));
    return typeof payload.exp === "number" ? payload.exp : 0;
  } catch {
    return 0;
  }
}

function toApiUser(raw: { id: string; email: string; displayName: string | null }): ApiUser {
  return {
    id: raw.id,
    email: raw.email,
    display_name: raw.displayName,
    user_metadata: { display_name: raw.displayName },
  };
}

function toApiSession(raw: {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; displayName: string | null };
}): ApiSession {
  return {
    access_token: raw.accessToken,
    refresh_token: raw.refreshToken,
    expires_at: decodeAccessTokenExpiry(raw.accessToken),
    user: toApiUser(raw.user),
  };
}

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function apiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL as string | undefined;
  return configured ? configured.replace(/\/$/, "") : "";
}

async function rawRequest(path: string, options: { method: string; body?: unknown; auth?: boolean }) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (options.auth) {
    const stored = readStoredTokens();
    if (stored?.accessToken) headers.Authorization = `Bearer ${stored.accessToken}`;
  }

  const response = await fetch(`${apiBaseUrl()}/api${path}`, {
    method: options.method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const code = data?.error?.code ?? "unknown_error";
    const message = data?.error?.message ?? "Request failed";
    throw new ApiError(response.status, code, message);
  }

  return data;
}

/**
 * Auth-aware request: retries once after a transparent token refresh on
 * 401. Exported so new per-module `xApi` objects (see hooks/useApiData.ts
 * and the CRUD modules built on top of it) can call the backend without
 * reimplementing token handling/error shaping.
 */
export async function request(path: string, options: { method: string; body?: unknown; auth?: boolean }) {
  try {
    return await rawRequest(path, options);
  } catch (error) {
    if (options.auth && error instanceof ApiError && error.status === 401) {
      await authApi.refresh();
      return rawRequest(path, options);
    }
    throw error;
  }
}

export const authApi = {
  async signup(input: {
    email: string;
    password: string;
    displayName: string; // already AES-encrypted client-side, see src/lib/encryption.ts
    businessName: string;
    businessPhone?: string; // already AES-encrypted client-side
    businessLocation?: string;
    businessType?: string;
    teamSize?: string;
    language?: "en" | "fr" | "rw" | "sw";
    planCode: string;
    billingCycle: "monthly" | "six_months" | "annual";
    paymentMethod?: string;
  }) {
    const data = await request("/auth/signup", { method: "POST", body: input });
    const session = toApiSession(data);
    writeStoredTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return { session, tenantId: data.tenantId as string };
  },

  async login(email: string, password: string) {
    const data = await request("/auth/login", { method: "POST", body: { email, password } });
    const session = toApiSession(data);
    writeStoredTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return session;
  },

  async refresh(): Promise<ApiSession | null> {
    const stored = readStoredTokens();
    if (!stored?.refreshToken) return null;

    try {
      const data = await rawRequest("/auth/refresh", { method: "POST", body: { refreshToken: stored.refreshToken } });
      writeStoredTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      const me = await rawRequest("/auth/me", { method: "GET", auth: true });
      return toApiSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: me.user });
    } catch {
      clearStoredTokens();
      return null;
    }
  },

  async logout() {
    const stored = readStoredTokens();
    clearStoredTokens();
    if (stored?.refreshToken) {
      await rawRequest("/auth/logout", { method: "POST", body: { refreshToken: stored.refreshToken } }).catch(() => {});
    }
  },

  async me() {
    return request("/auth/me", { method: "GET", auth: true }) as Promise<{
      user: { id: string; email: string; displayName: string | null };
      tenant: {
        id: string;
        name: string;
        subscription_plan: string | null;
        subscription_status: string | null;
        payment_status: string | null;
        trial_status: string | null;
        trial_ends_at: string | null;
        onboarding_completed: boolean;
        workspace_status: string | null;
        billing_cycle: string | null;
      } | null;
      role: string | null;
      permissions: unknown[];
      subscription: {
        plan_code: string;
        status: string;
        billing_cycle: string;
        current_period_start: string | null;
        current_period_end: string | null;
        trial_ends_at: string | null;
      } | null;
      isPlatformAdmin: boolean;
    }>;
  },

  async requestPasswordReset(email: string) {
    await request("/auth/password-reset/request", { method: "POST", body: { email } });
  },

  async completePasswordReset(token: string, newPassword: string) {
    await request("/auth/password-reset/complete", { method: "POST", body: { token, newPassword } });
  },

  /**
   * Rehydrates a full ApiSession from whatever is currently stored:
   * refreshes first if the access token is expiring soon, otherwise fetches
   * /auth/me to attach user details to the stored tokens. Returns null if
   * there's nothing stored or everything fails (caller should treat that as
   * "not logged in").
   */
  async loadSession(): Promise<ApiSession | null> {
    const stored = readStoredTokens();
    if (!stored?.accessToken) return null;

    const expiresAt = decodeAccessTokenExpiry(stored.accessToken);
    const expiringSoon = expiresAt > 0 && expiresAt * 1000 - Date.now() < 5 * 60 * 1000;

    if (expiringSoon) {
      return authApi.refresh();
    }

    try {
      const me = await rawRequest("/auth/me", { method: "GET", auth: true });
      return toApiSession({ accessToken: stored.accessToken, refreshToken: stored.refreshToken, user: me.user });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        return authApi.refresh();
      }
      throw error;
    }
  },

  clearStoredSession: clearStoredTokens,
};

export const workspaceApi = {
  async plans() {
    return request("/workspace/plans", { method: "GET" });
  },

  async paymentMethods() {
    return request("/workspace/payment-methods", { method: "GET" });
  },

  async createPending(input: Record<string, unknown>) {
    return request("/workspace/pending", { method: "POST", body: input, auth: true });
  },
};
