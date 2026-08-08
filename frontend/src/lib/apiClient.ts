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
