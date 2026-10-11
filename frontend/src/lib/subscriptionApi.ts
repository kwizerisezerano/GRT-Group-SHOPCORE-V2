import { request } from "@/lib/apiClient";

/**
 * Subscriptions, plan ceilings and payments.
 *
 * Kept out of apiClient.ts, which is already a thousand lines of the modules
 * that existed before billing did. Everything here goes through that file's
 * `request` helper, so token refresh, the response envelope and offline
 * reporting behave identically.
 */

export type PlanPrice = {
  id?: string;
  billing_cycle: "monthly" | "six_months" | "annual";
  billing_months: number;
  list_price: number;
  final_price: number;
  discount_percent: number;
  currency: string;
  is_active?: boolean;
};

export type PlanLimit = {
  id?: string;
  limit_key: string;
  name: string;
  /** null means unlimited. */
  value: number | null;
  is_unlimited: boolean;
  unit: string | null;
  display_order?: number;
};

export type PlanFeature = {
  id?: string;
  feature_key: string;
  name: string;
  description: string | null;
  category: string;
  feature_type: string;
  access_level: "included" | "limited" | "addon" | "unavailable";
  display_note: string | null;
  is_highlighted: boolean;
  display_order?: number;
};

export type SubscriptionPlan = {
  id: string;
  code: string;
  name: string;
  tagline: string | null;
  description: string | null;
  short_description: string | null;
  currency: string;
  monthly_price: number;
  six_month_price: number;
  yearly_price: number;
  six_month_discount: number;
  yearly_discount: number;
  is_active: boolean;
  is_public: boolean;
  is_popular: boolean;
  badge_text: string | null;
  button_label: string | null;
  trial_days: number;
  display_order: number;
  created_at?: string;
  updated_at?: string;
  prices: PlanPrice[];
  limits: PlanLimit[];
  features: PlanFeature[];
  /** Present only on the platform console's listing. */
  subscriber_count?: number;
};

export type CapacityReport = {
  limit_key: string;
  name: string;
  limit: number | null;
  is_unlimited: boolean;
  unit: string | null;
  usage: number;
  remaining: number | null;
  at_limit: boolean;
  source: "plan" | "override" | "unlimited";
};

export type PaymentMethodOption = {
  code: string;
  name: string;
  description: string | null;
  provider: string | null;
  display_order: number;
  supports_recurring: boolean;
  supports_one_time: boolean;
  currency: string;
  /** Mobile money needs a number before the prompt can be sent. */
  requires_phone: boolean;
  /** Bank transfer: a human confirms it, so there is nothing to poll. */
  is_manual: boolean;
};

export type PaymentTransaction = {
  id: string;
  reference_id: string;
  tenant_id: string | null;
  tenant_name?: string | null;
  subscription_id: string | null;
  purpose: string;
  direction: string;
  provider: string;
  provider_txn_id: string | null;
  payment_method_code: string | null;
  gateway_method: string | null;
  payer_phone: string | null;
  payer_email: string | null;
  payer_name: string | null;
  amount: string | number;
  currency: string;
  status: "pending" | "success" | "failed" | "cancelled";
  status_detail: string | null;
  redirect_url: string | null;
  plan_code: string | null;
  billing_cycle: string | null;
  callback_count: number;
  initiated_at: string;
  completed_at: string | null;
  last_callback_at: string | null;
  created_at: string;
};

export type PaymentLogEntry = {
  id: string;
  transaction_id: string | null;
  reference_id: string | null;
  tenant_id: string | null;
  tenant_name?: string | null;
  direction: "request" | "response" | "callback" | "status_check" | "error";
  event: string;
  provider: string;
  http_status: number | null;
  result_status: string | null;
  message: string | null;
  request_payload: unknown;
  response_payload: unknown;
  error_message: string | null;
  duration_ms: number | null;
  ip_address?: string | null;
  created_at: string;
};

export type CheckoutResult = {
  reference_id: string;
  status: "pending" | "success" | "failed" | "cancelled";
  message: string;
  redirect_url: string | null;
  transaction_id: string;
  amount: number;
  currency: string;
  payment_method_code: string;
  gateway_method: string;
  requires_redirect: boolean;
};

export type PlanEntitlements = {
  plan_code: string | null;
  plan_name: string | null;
  features: PlanFeature[];
  limits: PlanLimit[];
  usage: Record<string, number>;
  capacities: CapacityReport[];
  module_entitlements: {
    id: string | null;
    tenant_id: string | null;
    module_key: string;
    module_name: string;
    status: string;
    seats_included: number;
    seats_used: number;
    usage_count: number;
    last_used_at: string | null;
    metadata: Record<string, unknown>;
  }[];
};

/* ---------------------------------------------------- workspace-facing --- */

export const subscriptionApi = {
  /** The public catalogue — what signup and the pricing page offer. */
  async plans() {
    const data = (await request("/subscription/plans", { method: "GET" })) as {
      plans: SubscriptionPlan[];
    };
    return data.plans;
  },

  async paymentMethods() {
    const data = (await request("/subscription/payment-methods", { method: "GET" })) as {
      payment_methods: PaymentMethodOption[];
    };
    return data.payment_methods;
  },

  /** Features, ceilings and usage — what AuthContext loads once per session. */
  async entitlements() {
    return request("/subscription/entitlements", {
      method: "GET",
      auth: true,
    }) as Promise<PlanEntitlements>;
  },

  /** Just the capacity table; cheap enough to re-read after every create. */
  async usage() {
    const data = (await request("/subscription/usage", { method: "GET", auth: true })) as {
      capacities: CapacityReport[];
    };
    return data.capacities;
  },

  async current() {
    return request("/subscription/current", { method: "GET", auth: true }) as Promise<{
      tenant: Record<string, unknown> | null;
      plan: SubscriptionPlan | null;
      subscription: Record<string, unknown> | null;
      /**
       * The term, measured server-side. A trial counts from its own end date
       * and a paid period from `currentPeriodEnd`, so the two are not the same
       * arithmetic — doing it here would put the wrong number of days on the
       * one screen where the number matters.
       */
      period: {
        state: string;
        is_open: boolean;
        is_trial: boolean;
        starts_at: string | null;
        ends_at: string | null;
        total_days: number | null;
        used_days: number | null;
        /** Negative once the term has run out. */
        remaining_days: number | null;
        percent_used: number | null;
      } | null;
    }>;
  },

  /**
   * Pays for the subscription — first payment, renewal, or an upgrade to a
   * different plan. Answers before the money has actually moved: mobile money
   * returns `pending` while the customer's phone is still ringing, and card
   * returns a `redirect_url` to send them to.
   */
  async checkout(input: {
    plan_code?: string;
    billing_cycle?: "monthly" | "six_months" | "annual";
    payment_method_code: string;
    payer_phone?: string | null;
  }) {
    return request("/subscription/checkout", {
      method: "POST",
      body: input,
      auth: true,
    }) as Promise<CheckoutResult>;
  },
};

export const paymentsApi = {
  /** Polled while a mobile money prompt is on the customer's phone. */
  async status(referenceId: string) {
    return request(`/payments/status/${encodeURIComponent(referenceId)}`, {
      method: "GET",
      auth: true,
    }) as Promise<PaymentTransaction>;
  },

  async transactions(limit = 50) {
    const data = (await request(`/payments/transactions?limit=${limit}`, {
      method: "GET",
      auth: true,
    })) as { transactions: PaymentTransaction[] };
    return data.transactions;
  },

  async logs(referenceId: string) {
    const data = (await request(
      `/payments/transactions/${encodeURIComponent(referenceId)}/logs`,
      { method: "GET", auth: true }
    )) as { logs: PaymentLogEntry[] };
    return data.logs;
  },
};

/* ------------------------------------------------------ platform console --- */

export type PlanWriteInput = {
  code?: string;
  name: string;
  tagline?: string | null;
  description?: string | null;
  is_active: boolean;
  is_public: boolean;
  is_popular: boolean;
  badge_text?: string | null;
  trial_days: number;
  display_order: number;
  prices: {
    billing_cycle: "monthly" | "six_months" | "annual";
    billing_months?: number;
    list_price: number;
    discount_percent: number;
    currency?: string;
    is_active?: boolean;
  }[];
  limits: {
    limit_key: string;
    name: string;
    value: number | null;
    is_unlimited: boolean;
    unit?: string | null;
    display_order?: number;
  }[];
  features: {
    feature_key: string;
    name: string;
    description?: string | null;
    category?: string;
    access_level?: "included" | "limited" | "addon" | "unavailable";
    display_note?: string | null;
    is_highlighted?: boolean;
    display_order?: number;
  }[];
};

export type CapacityKeyOption = {
  limit_key: string;
  name: string;
  unit: string | null;
  /** False for the capacities the server does not yet count. */
  enforced: boolean;
};

export type Organization = {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  created_at: string;
  owner_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  contact_email: string | null;
  member_count: number;
  workspace_status: string | null;
  onboarding_completed: boolean;
  plan_code: string | null;
  plan_name: string | null;
  billing_cycle: string | null;
  subscription_status: string | null;
  payment_status: string | null;
  approval_status: string | null;
  subscription_amount: string | number | null;
  subscription_currency: string;
  current_period_end: string | null;
  expires_at: string | null;
  trial_ends_at: string | null;
  seats_used: number;
  seats_limit: number | null;
  seats_remaining: number | null;
  at_seat_limit: boolean;
  usage: Record<string, number>;
  has_limit_overrides: boolean;
};

export type PlatformOverview = {
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
};

export const platformSubscriptionApi = {
  async plans() {
    const data = (await request("/platform/plans", { method: "GET", auth: true })) as {
      plans: SubscriptionPlan[];
    };
    return data.plans;
  },

  async capacityKeys() {
    const data = (await request("/platform/plans/capacity-keys", {
      method: "GET",
      auth: true,
    })) as { capacity_keys: CapacityKeyOption[] };
    return data.capacity_keys;
  },

  async createPlan(input: PlanWriteInput) {
    return request("/platform/plans", { method: "POST", body: input, auth: true }) as Promise<{
      plan: SubscriptionPlan;
    }>;
  },

  async updatePlan(code: string, input: PlanWriteInput) {
    return request(`/platform/plans/${encodeURIComponent(code)}`, {
      method: "PATCH",
      body: input,
      auth: true,
    }) as Promise<{ plan: SubscriptionPlan }>;
  },

  async deletePlan(code: string) {
    return request(`/platform/plans/${encodeURIComponent(code)}`, { method: "DELETE", auth: true });
  },

  async organizations(params: { search?: string; status?: string } = {}) {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.status && params.status !== "all") query.set("status", params.status);

    const suffix = query.toString() ? `?${query.toString()}` : "";
    const data = (await request(`/platform/organizations${suffix}`, {
      method: "GET",
      auth: true,
    })) as { organizations: Organization[]; total: number };
    return data;
  },

  async organization(id: string) {
    return request(`/platform/organizations/${id}`, { method: "GET", auth: true }) as Promise<{
      organization: Record<string, any>;
      plan: SubscriptionPlan | null;
      subscription: Record<string, any> | null;
      subscription_history: Record<string, any>[];
      capacities: CapacityReport[];
      limit_overrides: {
        limit_key: string;
        name: string;
        value: number | null;
        is_unlimited: boolean;
        note: string | null;
        updated_at: string;
      }[];
      payments: PaymentTransaction[];
      members: Record<string, any>[];
    }>;
  },

  /** The console's own version of the signup form. */
  async createOrganization(input: {
    business_name: string;
    owner_email: string;
    owner_name: string;
    owner_phone?: string | null;
    business_location?: string | null;
    business_type?: string | null;
    team_size?: string | null;
    language?: string;
    plan_code: string;
    billing_cycle: "monthly" | "six_months" | "annual";
    payment_method_code?: string | null;
    activate_immediately: boolean;
    trial_days?: number | null;
  }) {
    return request("/platform/organizations", {
      method: "POST",
      body: input,
      auth: true,
    }) as Promise<{ tenant_id: string; owner_user_id: string }>;
  },

  async updateOrganization(
    id: string,
    input: {
      name?: string;
      workspace_status?: "active" | "pending_payment" | "suspended" | "cancelled";
      plan_code?: string;
      billing_cycle?: "monthly" | "six_months" | "annual";
    }
  ) {
    return request(`/platform/organizations/${id}`, { method: "PATCH", body: input, auth: true });
  },

  /** Raises or lowers one ceiling for one workspace. */
  async setLimitOverride(
    id: string,
    limitKey: string,
    input: { value: number | null; is_unlimited: boolean; note?: string | null }
  ) {
    return request(`/platform/organizations/${id}/limits/${encodeURIComponent(limitKey)}`, {
      method: "PUT",
      body: input,
      auth: true,
    }) as Promise<{ capacities: CapacityReport[] }>;
  },

  async clearLimitOverride(id: string, limitKey: string) {
    return request(`/platform/organizations/${id}/limits/${encodeURIComponent(limitKey)}`, {
      method: "DELETE",
      auth: true,
    }) as Promise<{ capacities: CapacityReport[] }>;
  },

  async overview() {
    return request("/platform/overview", { method: "GET", auth: true }) as Promise<PlatformOverview>;
  },

  async payments(params: { status?: string; search?: string; limit?: number } = {}) {
    const query = new URLSearchParams();
    if (params.status && params.status !== "all") query.set("status", params.status);
    if (params.search) query.set("search", params.search);
    query.set("limit", String(params.limit ?? 100));

    return request(`/platform/payments?${query.toString()}`, { method: "GET", auth: true }) as Promise<{
      payments: PaymentTransaction[];
      totals: { status: string; count: number; amount: string | number | null }[];
      gateway: {
        driver: string;
        configured: boolean;
        callback_url: string;
        card_redirect_url: string;
      };
    }>;
  },

  async payment(referenceId: string) {
    return request(`/platform/payments/${encodeURIComponent(referenceId)}`, {
      method: "GET",
      auth: true,
    }) as Promise<{ payment: PaymentTransaction; logs: PaymentLogEntry[] }>;
  },

  /** Re-asks the gateway about a payment that never settled. */
  async refreshPayment(referenceId: string) {
    return request(`/platform/payments/${encodeURIComponent(referenceId)}/refresh`, {
      method: "POST",
      auth: true,
    }) as Promise<PaymentTransaction>;
  },

  /** Settles a payment by hand — a bank transfer that arrived, say. */
  async reconcilePayment(
    referenceId: string,
    input: { status: "success" | "failed" | "cancelled"; note?: string }
  ) {
    return request(`/platform/payments/${encodeURIComponent(referenceId)}/reconcile`, {
      method: "POST",
      body: input,
      auth: true,
    });
  },

  async paymentLogs(
    params: { direction?: string; reference_id?: string; tenant_id?: string; limit?: number } = {}
  ) {
    const query = new URLSearchParams();
    if (params.direction && params.direction !== "all") query.set("direction", params.direction);
    if (params.reference_id) query.set("reference_id", params.reference_id);
    if (params.tenant_id) query.set("tenant_id", params.tenant_id);
    query.set("limit", String(params.limit ?? 200));

    const data = (await request(`/platform/payment-logs?${query.toString()}`, {
      method: "GET",
      auth: true,
    })) as { logs: PaymentLogEntry[] };
    return data.logs;
  },
};
