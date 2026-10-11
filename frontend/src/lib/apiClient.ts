import { LANGUAGE_STORAGE_KEY } from "@/i18n/storage";
import { apiBaseUrl } from "@/lib/apiBase";
import { reportApiReachable, reportApiUnreachable } from "@/lib/connectivity";

const TOKENS_KEY = "shopcore_auth_tokens";

export type ApiUser = {
  id: string;
  email: string;
  display_name: string | null;
  // Kept for compatibility with code that still reads Supabase-shaped
  // user metadata (e.g. `user?.user_metadata?.display_name`).
  user_metadata: { display_name: string | null };
  /**
   * Set on a member created with a generated password (POST /users/create or
   * /platform/tenants/:id/users) and cleared the moment they change it
   * themselves. ProtectedRoute reads this to route a first sign-in straight
   * to /force-password-change before anything else.
   */
  must_change_password: boolean;
  /**
   * Raised the moment a first-time member sets their own password, and
   * cleared when they enter the emailed code. ProtectedRoute reads it the
   * same way it reads must_change_password, so the two steps run in order:
   * choose a password, then confirm the code.
   */
  otp_required: boolean;
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

function toApiUser(raw: {
  id: string;
  email: string;
  displayName: string | null;
  mustChangePassword?: boolean;
  otpRequired?: boolean;
}): ApiUser {
  return {
    id: raw.id,
    email: raw.email,
    display_name: raw.displayName,
    user_metadata: { display_name: raw.displayName },
    must_change_password: raw.mustChangePassword ?? false,
    otp_required: raw.otpRequired ?? false,
  };
}

function toApiSession(raw: {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    displayName: string | null;
    mustChangePassword?: boolean;
    otpRequired?: boolean;
  };
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
  /**
   * Field-level validation detail, when the backend sent any. Shaped like
   * Zod's `flatten()` output: `{ formErrors, fieldErrors }`.
   */
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Language the API should answer in. Read from the same key the app's
 * LanguageContext persists to, so backend messages arrive in whatever the
 * user picked in the UI.
 */
function currentLanguage(): string | null {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * The most recent human-readable message the backend sent for a successful
 * call. Populated on every request so a caller that wants to surface the
 * backend's own wording (rather than inventing its own) can read it right
 * after awaiting.
 */
export let lastSuccessMessage: string | null = null;

async function rawRequest(path: string, options: { method: string; body?: unknown; auth?: boolean }) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  const language = currentLanguage();
  if (language) headers["X-Language"] = language;

  if (options.auth) {
    const stored = readStoredTokens();
    if (stored?.accessToken) headers.Authorization = `Bearer ${stored.accessToken}`;
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}/api${path}`, {
      method: options.method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (cause) {
    /*
     * fetch only rejects when the request never reached a server: the API is
     * down, the dev proxy has nothing to forward to, or the network is gone.
     * The browser reports that as an opaque failed/CORS request with no
     * status, which reads as a frontend bug and sends people looking in the
     * wrong place. Say what actually happened instead.
     *
     * Reported to the connectivity monitor rather than acted on here. Real
     * traffic is the best evidence there is about whether the API is up — far
     * better than a timer — but one failed request is not proof, and it is the
     * monitor's job to decide how many it takes.
     */
    reportApiUnreachable();

    throw new ApiError(
      0,
      "api_unreachable",
      navigator.onLine === false
        ? "You appear to be offline. Changes will sync when the connection returns."
        : "Cannot reach the ShopCore API. Make sure the backend is running — see docs/LOCAL-DEV.md.",
      { cause: String(cause) },
    );
  }

  // A reply of any kind — including a 4xx — proves the API was reached.
  reportApiReachable();

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  /*
   * The API answers in one envelope for every route:
   *   success  { success: true,  message, data }
   *   failure  { success: false, message, error: { code, details? } }
   *
   * Unwrapping here means call sites keep working with the payload directly
   * and never have to reach through `.data` themselves, and the backend's
   * already-translated message is what surfaces to the user.
   */
  if (!response.ok) {
    throw new ApiError(
      response.status,
      body?.error?.code ?? "unknown_error",
      body?.message ?? "Request failed",
      body?.error?.details,
    );
  }

  lastSuccessMessage = typeof body?.message === "string" ? body.message : null;

  return body?.data ?? null;
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
    displayName: string; // plaintext; encrypted server-side with AES-256-GCM
    businessName: string;
    businessPhone?: string; // plaintext; encrypted server-side with AES-256-GCM
    businessLocation?: string;
    businessType?: string;
    teamSize?: string;
    language?: "en" | "fr" | "es" | "sw" | "rw";
    /*
     * Optional, because choosing a plan is its own screen now. Signup creates
     * the account; /onboarding/plan then creates the workspace and charges for
     * it (workspaceApi.createPending). Sent together only by callers still
     * doing signup in one shot.
     */
    planCode?: string;
    billingCycle?: "monthly" | "six_months" | "annual";
    paymentMethod?: string;
    /**
     * The mobile money number the payment prompt is sent to. Optional: card
     * and bank transfer do not use one, and the server decides which methods
     * require it rather than the browser guessing.
     */
    payerPhone?: string;
  }) {
    const data = await request("/auth/signup", { method: "POST", body: input });
    const session = toApiSession(data);
    writeStoredTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });

    return {
      session,
      /** Null until a plan is chosen — the workspace does not exist yet. */
      tenantId: (data.tenantId ?? null) as string | null,
      /** True when the plan screen still has to run. */
      needsPlan: Boolean(data.needsPlan),
      /*
       * Whether the workspace is open yet, and what it costs if not. Signing
       * up no longer implies a paid subscription — a card or MoMo signup is
       * closed until the gateway confirms.
       */
      workspace: (data.workspace ?? null) as {
        requiresPayment: boolean;
        amount: number;
        currency: string;
        trialEndsAt: string | null;
      } | null,
      /*
       * The charge the server started on the customer's behalf, when they
       * chose a method the gateway can take. Null for bank transfer, for a
       * trial, and when the gateway could not be reached — in which case the
       * account still exists and the customer pays from the billing screen.
       */
      payment: (data.payment ?? null) as {
        reference_id: string;
        status: "pending" | "success" | "failed" | "cancelled";
        message: string;
        redirect_url: string | null;
        amount: number;
        currency: string;
        requires_redirect: boolean;
      } | null,
    };
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
      user: {
        id: string;
        email: string;
        displayName: string | null;
        mustChangePassword: boolean;
        otpRequired: boolean;
      };
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
        amount: string | number | null;
        currency: string | null;
        payment_method_code: string | null;
        payment_reference: string | null;
        approval_status: "pending" | "approved" | "rejected";
        rejection_reason: string | null;
        requested_at: string | null;
      } | null;
      isPlatformAdmin: boolean;
    }>;
  },

  /**
   * Whether this device holds a session the API will actually accept.
   *
   * Not the same question as "are there tokens in localStorage": an expired or
   * revoked token is still a token. This calls `/auth/me`, which goes through
   * `request()` and so refreshes transparently on a 401 — so a true answer
   * means the API was reached *and* the session works, which is exactly the
   * precondition for replaying an offline queue.
   *
   * Throws nothing. Being unable to answer is itself an answer of no.
   */
  async hasValidSession(): Promise<boolean> {
    if (!readStoredTokens()?.accessToken) return false;

    try {
      await request("/auth/me", { method: "GET", auth: true });
      return true;
    } catch {
      return false;
    }
  },

  async requestPasswordReset(email: string) {
    await request("/auth/password-reset/request", { method: "POST", body: { email } });
  },

  async completePasswordReset(token: string, newPassword: string) {
    await request("/auth/password-reset/complete", { method: "POST", body: { token, newPassword } });
  },

  /**
   * A signed-in user changing their own password — distinct from
   * completePasswordReset, which proves identity with a mailed token rather
   * than the current one. Also how a member created with a generated
   * password (see usersApi.createUser) clears must_change_password.
   */
  async changePassword(currentPassword: string, newPassword: string) {
    return request("/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword },
      auth: true,
    }) as Promise<{
      user: { id: string; email: string; displayName: string | null; otpRequired: boolean };
      /*
       * Always present: the server raises the second factor and sends the
       * code in the same call, so the client goes straight to the
       * verification screen instead of having to ask for one. A password
       * change never reaches the workspace on its own.
       */
      otp: { sentTo: string | null; expiresInMinutes: number } | null;
      /** Whether this was the forced first-sign-in change, for copy only. */
      wasFirstSignIn?: boolean;
    }>;
  },

  /**
   * Sends a fresh one-time code, replacing any still outstanding. Used by the
   * "resend" action on the verification screen; the code itself never comes
   * back over the wire, only a masked hint of where it went.
   */
  async requestOtp() {
    return request("/auth/otp/request", { method: "POST", auth: true }) as Promise<{
      sentTo: string | null;
      expiresInMinutes: number;
    }>;
  },

  /** Spends the code and clears the second-factor gate on success. */
  async verifyOtp(code: string) {
    return request("/auth/otp/verify", {
      method: "POST",
      body: { code },
      auth: true,
    }) as Promise<{
      user: { id: string; email: string; displayName: string | null; otpRequired: boolean };
    }>;
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

/**
 * Builds a client for one backend CRUD module (backend/src/lib/
 * crudModuleFactory.ts). The shape matches ApiCrudModule in
 * hooks/useApiData.ts, so a module built this way drops straight into
 * useApiTable/useApiMutations with no adapter.
 *
 * rawRequest already unwraps the response envelope, so `data` here is the
 * payload itself; it is re-wrapped as `{ data }` to match the hook contract.
 */
export function createCrudApi<T>(resource: string) {
  const base = `/${resource}`;

  return {
    async list(): Promise<{ data: T[] }> {
      return { data: (await request(base, { method: "GET", auth: true })) as T[] };
    },
    async get(id: string): Promise<{ data: T }> {
      return { data: (await request(`${base}/${id}`, { method: "GET", auth: true })) as T };
    },
    async create(input: Partial<T>): Promise<{ data: T }> {
      return { data: (await request(base, { method: "POST", body: input, auth: true })) as T };
    },
    async update(id: string, input: Partial<T>): Promise<{ data: T }> {
      return {
        data: (await request(`${base}/${id}`, { method: "PATCH", body: input, auth: true })) as T,
      };
    },
    async remove(id: string): Promise<void> {
      await request(`${base}/${id}`, { method: "DELETE", auth: true });
    },
  };
}

export const categoriesApi = createCrudApi<Record<string, unknown>>("categories");
export const brandsApi = createCrudApi<Record<string, unknown>>("brands");
export const productsApi = createCrudApi<Record<string, unknown>>("products");
export const customersApi = createCrudApi<Record<string, unknown>>("customers");
export const suppliersApi = createCrudApi<Record<string, unknown>>("suppliers");
export const expensesApi = createCrudApi<Record<string, unknown>>("expenses");
export const unitsApi = createCrudApi<Record<string, unknown>>("units");
export const branchesApi = createCrudApi<Record<string, unknown>>("branches");

/**
 * Sales are transactional, not CRUD: a checkout writes a header, its line
 * items and a stock movement per product atomically, and there is no update
 * or delete. Only the operations the backend actually offers are exposed.
 */
/**
 * A sale as the API returns it. Snake_case because that is the wire format,
 * and loose about the rest — a sale carries EBM and cash-drawer fields the
 * till reads but does not compute.
 */
export type SaleRecord = {
  id: string;
  invoice_no: string;
  receipt_no: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_tin: string | null;
  items: number;
  subtotal: string | number;
  tax: string | number;
  discount: string | number;
  total: string | number;
  paid: string | number;
  due: string | number;
  change_given: string | number;
  cost_total: string | number;
  gross_profit: string | number;
  payment_method: string | null;
  momo_number: string | null;
  momo_code: string | null;
  status: string | null;
  branch: string | null;
  cashier: string | null;
  sale_items: Record<string, unknown>[];
} & Record<string, unknown>;

export const salesApi = {
  async list(): Promise<{ data: Record<string, unknown>[] }> {
    return { data: (await request("/sales", { method: "GET", auth: true })) as Record<string, unknown>[] };
  },
  async get(id: string) {
    return request(`/sales/${id}`, { method: "GET", auth: true });
  },
  /**
   * Completes a sale.
   *
   * Everything that decides money is derived on the server: prices and costs
   * come from the catalogue, totals from the lines, and stock comes off inside
   * the same transaction. Sending a total here has no effect — deliberately,
   * since a till that can name its own numbers can sell a television for one
   * franc. The response is the authoritative sale, including its invoice
   * number, computed change and margin.
   */
  async checkout(input: {
    items: {
      product_id: string;
      quantity: number;
      unit_price?: number;
      unit_cost?: number;
      discount?: number;
      tax_rate?: number;
      batch_id?: string | null;
    }[];
    customer_name?: string | null;
    customer_phone?: string | null;
    customer_tin?: string | null;
    payment_method?: string;
    momo_number?: string | null;
    momo_code?: string | null;
    paid?: number;
    discount?: number;
    branch?: string | null;
    cashier?: string | null;
    receipt_no?: string | null;
    notes?: string | null;
    /**
     * Idempotency key. Pick one when the sale is first attempted and reuse it
     * for every retry of that same sale — including when a failed online
     * attempt is queued offline and synced later. The server records the sale
     * once and answers a replay with the original, so retrying is always safe
     * and never doubles a sale.
     */
    client_request_id?: string;
    /** A sale taken on a disconnected till. Permitted to drive stock negative. */
    offline?: boolean;
    /** When the till completed the sale, if that is not now. */
    completed_at?: string;
  }): Promise<SaleRecord> {
    return request("/sales", { method: "POST", body: input, auth: true }) as Promise<SaleRecord>;
  },
};

/**
 * Goods received from a supplier. Transactional like a sale and idempotent on
 * the same key, because a delivery counted twice inflates stock exactly as
 * surely as a sale counted twice deflates it.
 */
export const purchasesApi = {
  async list(): Promise<{ data: Record<string, unknown>[] }> {
    return {
      data: (await request("/purchases", { method: "GET", auth: true })) as Record<string, unknown>[],
    };
  },
  async get(id: string) {
    return request(`/purchases/${id}`, { method: "GET", auth: true });
  },
  async create(input: {
    items: { product_id: string; quantity: number; unit_cost?: number }[];
    supplier_id?: string | null;
    supplier_name?: string | null;
    purchase_no?: string | null;
    discount?: number;
    tax?: number;
    status?: string;
    payment_status?: string;
    notes?: string | null;
    client_request_id?: string;
    offline?: boolean;
    completed_at?: string;
  }) {
    return request("/purchases", { method: "POST", body: input, auth: true });
  },
};

/**
 * The stock ledger. Read-only by design: movements are written only by the
 * code that actually moves stock, inside the transaction that moved it. A
 * ledger anyone can post to is not a ledger.
 */
export const stockMovementsApi = {
  async list(params: { product_id?: string; movement_type?: string; limit?: number } = {}) {
    const query = new URLSearchParams();
    if (params.product_id) query.set("product_id", params.product_id);
    if (params.movement_type) query.set("movement_type", params.movement_type);
    if (params.limit) query.set("limit", String(params.limit));

    const suffix = query.toString() ? `?${query}` : "";
    return {
      data: (await request(`/stock-movements${suffix}`, {
        method: "GET",
        auth: true,
      })) as Record<string, unknown>[],
    };
  },
};

/**
 * Workspace membership: who is here, what they may do, and who changed it.
 *
 * Every write is an authority change, so the server enforces two rules this
 * client cannot soften: you may not act on someone who outranks you, and you
 * may not hand out a role at or above your own.
 */
export const usersApi = {
  async members(): Promise<{ data: Record<string, unknown>[] }> {
    return {
      data: (await request("/users/members", { method: "GET", auth: true })) as Record<string, unknown>[],
    };
  },
  async assignRole(userId: string, role: string) {
    return request(`/users/members/${userId}/role`, { method: "PATCH", body: { role }, auth: true });
  },
  async removeMember(userId: string) {
    return request(`/users/members/${userId}`, { method: "DELETE", auth: true });
  },
  /**
   * Where a member works and whether their membership is live.
   *
   * Separate from assignRole because it is a separate decision: moving a
   * cashier between shops changes nothing about what they may do. Pass
   * `branch_id: "all"` for workspace-wide.
   */
  async updateMemberProfile(
    userId: string,
    input: {
      branch_id?: string | null;
      department?: string | null;
      status?: string;
      /*
       * Accounts that predate the phone field carry no number and so receive
       * no sign-in code by text. Settable here so one can be filled in
       * without recreating the person.
       */
      phone?: string | null;
    }
  ) {
    return request(`/users/members/${userId}/profile`, {
      method: "PATCH",
      body: input,
      auth: true,
    });
  },

  /** The whole matrix — defaults, this workspace's overrides, and the result. */
  
  async memberPermissions(userId: string) {
    return request(`/users/members/${userId}/permissions`, { method: "GET", auth: true }) as Promise<{
      role: string;
      effective: string[];
      customised: { permission: string; granted: boolean }[];
    }>;
  },

  async setMemberPermissions(
    userId: string,
    input: { mode: "grant_all" | "revoke_all" | "defaults" } | { mode: "set"; permissions: string[] }
  ) {
    return request(`/users/members/${userId}/permissions/bulk`, {
      method: "PUT",
      body: input,
      auth: true,
    }) as Promise<{
      role: string;
      effective: string[];
      customised: { permission: string; granted: boolean }[];
    }>;
  },
async permissionMatrix() {
    return request("/users/permissions", { method: "GET", auth: true }) as Promise<{
      catalogue: string[];
      roles: {
        role: string;
        defaults: string[];
        effective: string[];
        customised: { permission: string; granted: boolean }[];
      }[];
    }>;
  },
  async setPermission(role: string, permission: string, granted: boolean) {
    return request("/users/permissions", {
      method: "PUT",
      body: { role, permission, granted },
      auth: true,
    });
  },

  /**
   * Sets a role's whole permission list in one request.
   *
   * The alternative — looping `setPermission` over a catalogue of a hundred
   * and change — is slow enough to look broken and leaves the role in a state
   * nobody chose if the connection drops partway through. The server writes
   * this in one transaction, so the role either ends up as asked or unchanged.
   *
   * `permissions` is only read for `mode: "set"`; the three named modes carry
   * their own meaning so the client never has to send the full catalogue.
   */
  async setRolePermissions(
    role: string,
    input: { mode: "grant_all" | "revoke_all" | "defaults" } | { mode: "set"; permissions: string[] }
  ) {
    return request("/users/permissions/bulk", {
      method: "PUT",
      body: { role, ...input },
      auth: true,
    }) as Promise<{
      role: string;
      effective: string[];
      customised: { permission: string; granted: boolean }[];
    }>;
  },

  async invites(): Promise<{ data: Record<string, unknown>[] }> {
    return {
      data: (await request("/users/invites", { method: "GET", auth: true })) as Record<string, unknown>[],
    };
  },
  /** The token comes back exactly once — only its hash is stored. */
  async invite(email: string, role: string) {
    return request("/users/invites", { method: "POST", body: { email, role }, auth: true }) as Promise<{
      id: string;
      email: string;
      role: string;
      token: string;
      expires_at: string;
    }>;
  },
  async cancelInvite(id: string) {
    return request(`/users/invites/${id}`, { method: "DELETE", auth: true });
  },

  /**
   * Creates a member outright — a generated password is emailed to them
   * instead of an invite link, and they're required to change it on first
   * sign-in. The password itself never appears in this response; the only
   * place it exists is the email the backend sends.
   */
  async createUser(input: {
    email: string;
    display_name: string;
    role: string;
    department?: string | null;
    branch_id?: string | null;
    /*
     * Optional. When given, the temporary password is texted as well as
     * emailed — the credential exists only in those messages, so a second
     * channel is what makes the account recoverable if mail is filtered.
     */
    phone?: string | null;
  }) {
    return request("/users/create", { method: "POST", body: input, auth: true });
  },

  async activity(limit = 200): Promise<{ data: Record<string, unknown>[] }> {
    return {
      data: (await request(`/users/activity?limit=${limit}`, {
        method: "GET",
        auth: true,
      })) as Record<string, unknown>[],
    };
  },

  /**
   * What the signed-in caller may do — the same answer the server enforces, so
   * the UI hides what would be refused rather than guessing. Cached for
   * offline use; see lib/permissions.ts.
   */
  async myPermissions() {
    return request("/users/me/permissions", { method: "GET", auth: true }) as Promise<{
      role: string | null;
      permissions: string[];
    }>;
  },
};

/** The signed-in user's own profile — one row, addressed by the token. */
export const profileApi = {
  async get() {
    return request("/profile", { method: "GET", auth: true }) as Promise<{
      id: string;
      display_name: string | null;
      phone: string | null;
      language: string;
      avatar_url: string | null;
    }>;
  },
  async update(input: {
    display_name?: string;
    phone?: string | null;
    avatar_url?: string | null;
    language?: string;
  }) {
    return request("/profile", { method: "PATCH", body: input, auth: true });
  },
};

/**
 * The platform console's own endpoints — a platform admin acts across every
 * tenant rather than from inside one, so these are gated on platform-admin
 * status server-side, not on a tenant role.
 */
export const platformApi = {
  /**
   * Every workspace on the platform, with the owner's name and email and a
   * member count — a name on its own is not enough to tell two workspaces
   * apart when a business runs several.
   */
  async tenants() {
    return request("/platform/tenants", { method: "GET", auth: true }) as Promise<
      {
        id: string;
        name: string;
        slug: string | null;
        subscription_plan: string | null;
        subscription_status: string | null;
        workspace_status: string | null;
        created_at: string | null;
        member_count: number;
        owner_id: string | null;
        owner_name: string | null;
        owner_email: string | null;
      }[]
    >;
  },

  /** Same shape as usersApi.createUser, for a tenant the caller picks explicitly. */
  async createTenantUser(
    tenantId: string,
    input: {
      email: string;
      display_name: string;
      role: string;
      department?: string | null;
      branch_id?: string | null;
    }
  ) {
    return request(`/platform/tenants/${tenantId}/users`, { method: "POST", body: input, auth: true });
  },

  /** The bank-transfer review queue. `status` defaults to "pending" server-side. */
  async subscriptions(status: "pending" | "approved" | "rejected" | "all" = "pending") {
    return request(`/platform/subscriptions?status=${status}`, { method: "GET", auth: true }) as Promise<
      PlatformSubscription[]
    >;
  },

  async approveSubscription(id: string) {
    return request(`/platform/subscriptions/${id}/approve`, { method: "POST", auth: true });
  },

  async rejectSubscription(id: string, reason: string) {
    return request(`/platform/subscriptions/${id}/reject`, { method: "POST", body: { reason }, auth: true });
  },

  /**
   * The platform's real headline numbers, straight from our own database.
   *
   * The console's dashboard was reading these from Supabase tables that this
   * deployment does not have, so an operator with paying tenants on screen
   * elsewhere was shown "Total tenants 0". This is the same figures counted
   * where they actually live.
   */
  /**
   * What one workspace can open today, and on whose authority — its plan, an
   * operator override, or nothing.
   */
  async tenantModules(tenantId: string) {
    return request(`/platform/tenants/${tenantId}/modules`, { method: "GET", auth: true }) as Promise<{
      tenant: { id: string; name: string };
      plan_code: string | null;
      subscription_status: string | null;
      modules: {
        module_key: string;
        name: string;
        in_plan: boolean;
        plan_allows: boolean;
        override_status: "enabled" | "disabled" | "trial" | null;
        seats_included: number | null;
        allowed: boolean;
        source: "tenant_override" | "plan" | "not_granted";
      }[];
    }>;
  },

  /** Grants, trials or revokes one module for a workspace. */
  async setTenantModule(
    tenantId: string,
    moduleKey: string,
    status: "enabled" | "disabled" | "trial",
  ) {
    return request(`/platform/tenants/${tenantId}/modules/${moduleKey}`, {
      method: "PUT",
      body: { status },
      auth: true,
    });
  },

  /** Drops the override so the subscription decides again. */
  async resetTenantModule(tenantId: string, moduleKey: string) {
    return request(`/platform/tenants/${tenantId}/modules/${moduleKey}`, {
      method: "DELETE",
      auth: true,
    });
  },

  /** Everyone with an account, across every workspace. */
  async platformUsers() {
    return request("/platform/users", { method: "GET", auth: true }) as Promise<{
      users: {
        id: string;
        email: string;
        display_name: string | null;
        is_platform_admin: boolean;
        role: string | null;
        tenant_id: string | null;
        tenant_name: string | null;
        created_at: string;
      }[];
      total: number;
      platform_admins: number;
    }>;
  },

  /** Grants or revokes platform-admin rights for one account. */
  async setPlatformAdmin(userId: string, isPlatformAdmin: boolean) {
    return request(`/platform/users/${userId}/platform-admin`, {
      method: "PUT",
      body: { isPlatformAdmin },
      auth: true,
    });
  },

  /** Every subscription on the platform, from tenant_subscriptions. */
  async subscriptionRecords(status = "all") {
    return request(`/platform/subscription-records?status=${encodeURIComponent(status)}`, {
      method: "GET",
      auth: true,
    }) as Promise<{
      subscriptions: {
        id: string; tenant_id: string; tenant_name: string | null;
        plan_code: string; plan_name: string; billing_cycle: string;
        status: string | null; payment_status: string | null; approval_status: string | null;
        amount: string | number | null;
        current_period_start: string | null; current_period_end: string | null;
        trial_ends_at: string | null; activated_at: string | null; created_at: string;
        days_remaining: number | null;
        invoice_count: number; payment_count: number;
      }[];
    }>;
  },

  /** Issued receipts, newest first. */
  async platformInvoices() {
    return request("/platform/invoices", { method: "GET", auth: true }) as Promise<{
      invoices: {
        id: string; invoice_no: string; tenant_id: string; tenant_name: string | null;
        plan_code: string; plan_name: string; billing_cycle: string;
        period_start: string; period_end: string;
        amount: string | number; currency: string;
        payment_method_name: string; provider_txn_id: string | null;
        paid_at: string; issued_at: string; emailed_at: string | null; sms_sent_at: string | null;
      }[];
      total: number;
    }>;
  },

  /**
   * Contract templates — the agreement a customer signs before paying.
   *
   * The list response carries the placeholder catalogue alongside the
   * templates, so the editor can show what is fillable without keeping a
   * second copy of that list here, where the two would drift apart.
   */
  async contractTemplates() {
    return request("/platform/contract-templates", { method: "GET", auth: true }) as Promise<{
      templates: ContractTemplate[];
      placeholders: { token: string; describes: string; group: string }[];
      provider_defaults: {
        legal_name: string;
        address: string;
        governing_law: string;
      };
    }>;
  },

  async createContractTemplate(input: ContractTemplateInput) {
    return request("/platform/contract-templates", {
      method: "POST",
      auth: true,
      body: input,
    }) as Promise<ContractTemplate>;
  },

  async updateContractTemplate(id: string, input: Partial<ContractTemplateInput>) {
    return request(`/platform/contract-templates/${id}`, {
      method: "PUT",
      auth: true,
      body: input,
    }) as Promise<ContractTemplate>;
  },

  async deleteContractTemplate(id: string) {
    return request(`/platform/contract-templates/${id}`, {
      method: "DELETE",
      auth: true,
    }) as Promise<{ id: string }>;
  },

  /**
   * The signing PIN — re-typed before ShopCore's signature or stamp is attached
   * to a template.
   *
   * The PIN itself is never read back, only whether one exists and whether it
   * is currently locked out. Managing it costs the account password, because
   * changing what authorises a signature should be as hard as signing in.
   */
  async signingPinStatus() {
    return request("/platform/signing-pin", { method: "GET", auth: true }) as Promise<{
      configured: boolean;
      set_at: string | null;
      locked_until: string | null;
    }>;
  },

  async setSigningPin(input: { pin: string; password: string }) {
    return request("/platform/signing-pin", {
      method: "PUT",
      auth: true,
      body: input,
    }) as Promise<{ configured: boolean }>;
  },

  async clearSigningPin(password: string) {
    return request("/platform/signing-pin", {
      method: "DELETE",
      auth: true,
      body: { password },
    }) as Promise<{ configured: boolean }>;
  },

  /** Every charge sent to the gateway, settled or not. */
  async platformPayments(status = "all") {
    return request(`/platform/payments?status=${encodeURIComponent(status)}&limit=500`, {
      method: "GET",
      auth: true,
    }) as Promise<{
      payments: {
        id: string; reference_id: string; tenant_id: string | null; tenant_name: string | null;
        provider: string; provider_txn_id: string | null;
        payment_method_code: string | null; amount: string | number; currency: string;
        status: string; status_detail: string | null;
        payer_email: string | null; payer_phone: string | null;
        created_at: string; completed_at: string | null;
      }[];
    }>;
  },

  async overview() {
    return request("/platform/overview", { method: "GET", auth: true }) as Promise<{
      workspaces: { total: number; active: number; pending_payment: number };
      subscriptions_by_plan: {
        plan_code: string;
        plan_name: string;
        count: number;
        contracted_amount: string | number | null;
      }[];
      revenue_this_month: { amount: string | number; payment_count: number };
      pending_approvals: number;
      expiring_within_7_days: number;
      failed_payments: number;
      gateway: { driver: string; configured: boolean };
    }>;
  },
};

/** A contract template as the console edits it. */
export type ContractTemplate = {
  id: string;
  name: string;
  description: string | null;
  /** The agreement text, with {{placeholders}} filled in at signing time. */
  body: string;
  is_active: boolean;
  /** Bumped when the wording changes, so a signature records what was signed. */
  version: number;
  placeholders_used: string[];
  /** {{tokens}} in the body that nothing knows how to fill — likely typos. */
  unknown_placeholders: string[];

  /** ShopCore's own signature and stamp, applied to every contract issued. */
  provider_signature_image: string | null;
  provider_stamp_image: string | null;
  provider_signer_name: string | null;
  provider_signer_title: string | null;

  /** Who ShopCore is on the face of the document. */
  provider_legal_name: string | null;
  provider_tin: string | null;
  provider_registration_no: string | null;
  provider_address: string | null;
  provider_email: string | null;
  provider_phone: string | null;
  governing_law: string | null;

  /** When the signature or stamp was last attached, PIN-confirmed. */
  signature_attached_at: string | null;

  created_at: string;
  updated_at: string;
};

export type ContractTemplateInput = {
  name: string;
  description?: string | null;
  body: string;
  isActive?: boolean;

  /*
   * Omit to leave what is stored alone; pass null to clear. A partial update
   * sends only what changed, so without that distinction renaming a template
   * would wipe its signature.
   */
  providerSignatureImage?: string | null;
  providerStampImage?: string | null;
  providerSignerName?: string | null;
  providerSignerTitle?: string | null;

  providerLegalName?: string | null;
  providerTin?: string | null;
  providerRegistrationNo?: string | null;
  providerAddress?: string | null;
  providerEmail?: string | null;
  providerPhone?: string | null;
  governingLaw?: string | null;

  /**
   * Sent only when the signature, stamp or signer identity is being changed.
   * The server decides whether it was needed by comparing against what it
   * already holds, so a body-only edit never asks for it.
   */
  pin?: string;
};

export type PlatformSubscription = {
  id: string;
  tenant_id: string;
  tenant_name: string;
  workspace_status: string | null;
  plan_code: string;
  plan_name: string;
  billing_cycle: string;
  amount: string | number | null;
  currency: string | null;
  payment_method_code: string | null;
  payment_method_name: string | null;
  payment_reference: string | null;
  approval_status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  requested_by_email: string | null;
  requested_by_name: string | null;
  requested_at: string | null;
  approved_at: string | null;
  activated_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  expires_at: string | null;
};

/**
 * The agreement a customer signs before paying.
 *
 * The preview is rendered by the server, not here. The text a person signs has
 * to be the text we hold afterwards, and the only way to guarantee that is for
 * one side to produce both — so the browser asks for it, shows it, and sends
 * back nothing but the signature.
 */
export const contractsApi = {
  async preview(input: {
    planCode: string;
    billingCycle: "monthly" | "six_months" | "annual";
    businessName: string;
    tinNumber?: string | null;
    businessPhone?: string | null;
    businessAddress?: string | null;
  }) {
    return request("/contracts/preview", { method: "POST", auth: true, body: input }) as Promise<{
      template: {
        id: string;
        name: string;
        version: number;
        /** ShopCore's countersignature, so the reader sees a two-sided document. */
        provider_signature_image: string | null;
        provider_stamp_image: string | null;
        provider_signer_name: string | null;
        provider_signer_title: string | null;
      };
      provider: ContractPartyIdentity;
      customer: ContractPartyIdentity;
      body: string;
      plan: { code: string; name: string };
      amount: number;
      amount_in_words: string;
      currency: string;
      term_months: number;
      period_start: string;
      period_end: string;
      signer_name: string;
      signer_email: string;
    }>;
  },

  /**
   * The signed contract as PDF bytes, before the workspace exists.
   *
   * Returns a blob rather than JSON because the server sends the finished
   * document, not a description of one. The caller owns the object URL it
   * makes from this and is responsible for revoking it.
   */
  async generate(input: {
    planCode: string;
    billingCycle: "monthly" | "six_months" | "annual";
    businessName: string;
    tinNumber?: string | null;
    businessPhone?: string | null;
    businessAddress?: string | null;
    signatureImage: string;
    stampImage?: string | null;
    signerName: string;
  }): Promise<Blob> {
    const stored = readStoredTokens();

    const response = await fetch(`${apiBaseUrl()}/api/contracts/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(stored?.accessToken ? { Authorization: `Bearer ${stored.accessToken}` } : {}),
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      /*
       * The failure body is our usual JSON envelope even though the success
       * body is a PDF, so the message is worth reading out rather than
       * reporting the status code at somebody.
       */
      const detail = await response.json().catch(() => null);
      throw new Error(detail?.message ?? `The server returned ${response.status}.`);
    }

    return response.blob();
  },

  /** The contract this workspace signed. 404 when nothing was signed. */
  async mine() {
    return request("/contracts/mine", { method: "GET", auth: true }) as Promise<SignedContract>;
  },
};

/**
 * Saves the signed contract as a PDF.
 *
 * Not an <a href> to the endpoint: the download needs the bearer token, and a
 * plain link sends no Authorization header — it would open a 401 in a new tab.
 * So the bytes are fetched, wrapped in a blob URL, and handed to a synthetic
 * click, with the URL revoked afterwards so the blob does not sit in memory for
 * the rest of the session.
 */
export async function downloadContractPdf(): Promise<void> {
  const stored = readStoredTokens();

  const response = await fetch(`${apiBaseUrl()}/api/contracts/mine/pdf`, {
    headers: stored?.accessToken ? { Authorization: `Bearer ${stored.accessToken}` } : {},
  });

  if (!response.ok) {
    throw new Error(`The server returned ${response.status}.`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "shopcore-service-agreement.pdf";
  document.body.appendChild(link);
  link.click();

  /*
   * The anchor is removed and the blob released on a timer, not on the next
   * line.
   *
   * A programmatic click starts the download asynchronously. Tearing down
   * either the element or the blob URL in the same tick cancels it before it
   * begins, and the failure is completely silent — the button appears to do
   * nothing, no error, no request logged. That is exactly how this behaved
   * until it was driven in a real browser. A minute is far longer than the
   * handover needs, and both are freed anyway when the tab closes.
   */
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}

/**
 * One side of the agreement, as the document names it.
 *
 * Both parties carry the same shape on purpose: a contract that identifies the
 * customer by registered name, TIN and address and the provider by a brand is
 * exactly the half a dispute starts with.
 */
export type ContractPartyIdentity = {
  legal_name: string | null;
  tin: string | null;
  registration_no?: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  governing_law?: string | null;
};

export type SignedContract = {
  id: string;
  template_name: string;
  template_version: number;
  body: string;
  signer_name: string;
  signature_image: string;
  stamp_image: string | null;
  provider_signature_image: string | null;
  provider_stamp_image: string | null;
  provider_signer_name: string | null;
  provider_signer_title: string | null;
  /** Both sides as they stood on the day it was signed. */
  provider: ContractPartyIdentity;
  customer: ContractPartyIdentity;
  plan_code: string;
  plan_name: string;
  billing_cycle: string;
  amount: string | number;
  currency: string;
  signed_at: string;
};

export const workspaceApi = {
  async plans() {
    return request("/workspace/plans", { method: "GET" });
  },

  async paymentMethods() {
    return request("/workspace/payment-methods", { method: "GET" });
  },

  /**
   * Creates the workspace on the chosen plan and starts the charge in one
   * request — see the route's own note for why those are not two calls.
   */
  async createPending(input: Record<string, unknown>) {
    const data = (await request("/workspace/pending", {
      method: "POST",
      body: input,
      auth: true,
    })) as {
      tenantId: string;
      subscriptionId: string | null;
      requiresPayment: boolean;
      amount: number;
      currency: string;
      trialEndsAt: string | null;
      payment: {
        reference_id: string;
        status: "pending" | "success" | "failed" | "cancelled";
        message: string;
        redirect_url: string | null;
        amount: number;
        currency: string;
        requires_redirect: boolean;
      } | null;
      accessToken: string;
      refreshToken: string;
    };

    /*
     * The caller's tenancy just changed, and the tenant is baked into the
     * access token — the one in storage was minted at signup when there was
     * no workspace. Swapping it here means the very next request (polling the
     * payment, loading billing) is scoped to the workspace that now exists.
     */
    if (data.accessToken && data.refreshToken) {
      writeStoredTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    }

    return data;
  },

  async submitPaymentReference(reference: string) {
    return request("/workspace/payment-reference", { method: "POST", body: { reference }, auth: true });
  },
};
