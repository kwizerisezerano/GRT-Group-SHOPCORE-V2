import { authApi, type ApiSession as Session } from "@/lib/apiClient";

const AUTH_CACHE_KEY = "shopcore_cached_auth_state";
const OFFLINE_ACCOUNTS_KEY = "shopcore_offline_accounts";
const OFFLINE_MODE_KEY = "shopcore_offline_mode";
const OFFLINE_LOGIN_AUDIT_KEY = "shopcore_offline_login_audit";
const OFFLINE_SECURITY_KEY = "shopcore_offline_security_state";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

type OfflineSecurityState = {
  failedAttempts?: Record<string, number>;
  lockedUntil?: Record<string, number>;
};

type OfflineAuditEvent = {
  type:
    | "offline_setup"
    | "offline_login_success"
    | "offline_login_failed"
    | "offline_locked"
    | "offline_logout"
    | "offline_mode_enabled"
    | "offline_mode_disabled";
  email?: string | null;
  userId?: string | null;
  message?: string | null;
  created_at: string;
};

function safeLocalStorageGet(key: string) {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, value);
  } catch {
    // Offline auth must not crash when storage is unavailable.
  }
}

function safeLocalStorageRemove(key: string) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function normalizeEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase();
}

function dispatchOfflineAuthEvent(name: string, detail?: any) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }
}

async function hashText(value: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = safeLocalStorageGet(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: any) {
  safeLocalStorageSet(key, JSON.stringify(value));
}

function readOfflineAccounts() {
  return readJson<any[]>(OFFLINE_ACCOUNTS_KEY, []);
}

function writeOfflineAccounts(accounts: any[]) {
  writeJson(OFFLINE_ACCOUNTS_KEY, accounts || []);
}

function readSecurityState(): OfflineSecurityState {
  return readJson<OfflineSecurityState>(OFFLINE_SECURITY_KEY, {
    failedAttempts: {},
    lockedUntil: {},
  });
}

function writeSecurityState(state: OfflineSecurityState) {
  writeJson(OFFLINE_SECURITY_KEY, {
    failedAttempts: state.failedAttempts || {},
    lockedUntil: state.lockedUntil || {},
  });
}

function writeAudit(event: Omit<OfflineAuditEvent, "created_at">) {
  const current = readJson<OfflineAuditEvent[]>(OFFLINE_LOGIN_AUDIT_KEY, []);
  const next = [
    {
      ...event,
      created_at: new Date().toISOString(),
    },
    ...current,
  ].slice(0, 200);

  writeJson(OFFLINE_LOGIN_AUDIT_KEY, next);
}

function getEmailLockState(email: string) {
  const key = normalizeEmail(email);
  const security = readSecurityState();
  const lockedUntil = Number(security.lockedUntil?.[key] || 0);

  return {
    locked: lockedUntil > Date.now(),
    lockedUntil,
    remainingMs: Math.max(0, lockedUntil - Date.now()),
  };
}

function clearEmailFailures(email: string) {
  const key = normalizeEmail(email);
  const security = readSecurityState();

  delete security.failedAttempts?.[key];
  delete security.lockedUntil?.[key];

  writeSecurityState(security);
}

function recordFailedLogin(email: string) {
  const key = normalizeEmail(email);
  const security = readSecurityState();
  const failedAttempts = security.failedAttempts || {};
  const lockedUntil = security.lockedUntil || {};

  failedAttempts[key] = Number(failedAttempts[key] || 0) + 1;

  if (failedAttempts[key] >= MAX_FAILED_ATTEMPTS) {
    lockedUntil[key] = Date.now() + LOCKOUT_MS;
    writeAudit({
      type: "offline_locked",
      email: key,
      message: "Offline account locked after too many failed login attempts.",
    });
  }

  writeSecurityState({ failedAttempts, lockedUntil });

  return failedAttempts[key];
}

export function enableOfflineMode() {
  safeLocalStorageSet(OFFLINE_MODE_KEY, "true");
  writeAudit({ type: "offline_mode_enabled" });
  dispatchOfflineAuthEvent("shopcore-offline-mode-enabled");
}

export function disableOfflineMode() {
  safeLocalStorageRemove(OFFLINE_MODE_KEY);
  writeAudit({ type: "offline_mode_disabled" });
  dispatchOfflineAuthEvent("shopcore-offline-mode-disabled");
}

export function isOfflineMode() {
  return safeLocalStorageGet(OFFLINE_MODE_KEY) === "true";
}

export function getCachedOfflineAuth() {
  return readJson<any | null>(AUTH_CACHE_KEY, null);
}

export function setCachedOfflineAuth(authState: any) {
  writeJson(AUTH_CACHE_KEY, {
    ...authState,
    cached_at: new Date().toISOString(),
  });
  dispatchOfflineAuthEvent("shopcore-offline-auth-updated", authState);
}

export function clearCachedOfflineAuth() {
  safeLocalStorageRemove(AUTH_CACHE_KEY);
  dispatchOfflineAuthEvent("shopcore-offline-auth-cleared");
}

export function logoutOffline() {
  clearCachedOfflineAuth();
  disableOfflineMode();
  writeAudit({ type: "offline_logout" });
  dispatchOfflineAuthEvent("shopcore-offline-logout");
}

async function getStrongOnlineSession(session?: Session | null) {
  if (session?.access_token && session?.user?.id) return session;

  const loaded = await authApi.loadSession();

  if (loaded?.access_token && loaded?.user?.id) {
    return loaded;
  }

  throw new Error("No active online session");
}

async function fetchWorkspaceContext(userId: string) {
  const me = await authApi.me();

  if (!me.tenant?.id) throw new Error("No workspace found for offline setup");

  return {
    tenantId: me.tenant.id,
    tenantName: me.tenant.name,
    role: me.role || "viewer",
    permissions: me.permissions || [],
    tenantRecord: me.tenant,
  };
}

export async function cacheCurrentOnlineAuth(session?: Session | null) {
  const onlineSession = await getStrongOnlineSession(session);
  const user = onlineSession.user;
  const workspace = await fetchWorkspaceContext(user.id);

  const cachedAuth = {
    user,
    session: onlineSession,
    tenantId: workspace.tenantId,
    tenantName: workspace.tenantName,
    role: workspace.role,
    permissions: workspace.permissions,
    offline: false,

    subscriptionPlan: workspace.tenantRecord?.subscription_plan ?? null,
    subscriptionStatus: workspace.tenantRecord?.subscription_status ?? null,
    paymentStatus: workspace.tenantRecord?.payment_status ?? null,
    trialStatus: workspace.tenantRecord?.trial_status ?? null,
    trialEndsAt: workspace.tenantRecord?.trial_ends_at ?? null,
    workspaceStatus: workspace.tenantRecord?.workspace_status ?? null,
    onboardingCompleted:
      workspace.tenantRecord?.onboarding_completed ?? false,

    cached_at: new Date().toISOString(),
  };

  setCachedOfflineAuth(cachedAuth);
  return cachedAuth;
}

export async function setupOfflineLogin(
  session: Session,
  onlinePassword: string,
) {
  const onlineSession = await getStrongOnlineSession(session);

  if (!onlinePassword || onlinePassword.length < 6) {
    throw new Error("Password is required to prepare offline access.");
  }

  const user = onlineSession.user;
  const cachedAuth = await cacheCurrentOnlineAuth(onlineSession);

  const accounts = readOfflineAccounts();
  const credentialHash = await hashText(onlinePassword);
  const email = normalizeEmail(user.email);

  const nextAccount = {
    email,
    userId: user.id,
    credentialHash,
    authState: cachedAuth,
    updated_at: new Date().toISOString(),
  };

  const updated = [
    nextAccount,
    ...accounts.filter((a: any) => normalizeEmail(a.email) !== email),
  ];

  writeOfflineAccounts(updated);
  clearEmailFailures(email);
  disableOfflineMode();

  writeAudit({
    type: "offline_setup",
    email,
    userId: user.id,
    message: "Offline access configured successfully.",
  });

  return nextAccount;
}

export async function loginOffline(email: string, password: string) {
  const cleanEmail = normalizeEmail(email);
  const lock = getEmailLockState(cleanEmail);

  if (lock.locked) {
    const minutes = Math.ceil(lock.remainingMs / 60000);
    throw new Error(
      `Offline account is locked. Try again in ${minutes} minute${
        minutes === 1 ? "" : "s"
      }.`,
    );
  }

  const accounts = readOfflineAccounts();

  const account = accounts.find(
    (a: any) => normalizeEmail(a.email) === cleanEmail,
  );

  if (!account) {
    writeAudit({
      type: "offline_login_failed",
      email: cleanEmail,
      message: "No offline account found on this device.",
    });
    throw new Error(
      "No offline account found on this device. Log in online once first.",
    );
  }

  const credentialHash = await hashText(password);
  const storedHash = account.credentialHash || account.pinHash;

  if (credentialHash !== storedHash) {
    const attempts = recordFailedLogin(cleanEmail);

    writeAudit({
      type: "offline_login_failed",
      email: cleanEmail,
      userId: account.userId,
      message: `Invalid offline credential. Attempt ${attempts}/${MAX_FAILED_ATTEMPTS}.`,
    });

    if (attempts >= MAX_FAILED_ATTEMPTS) {
      throw new Error(
        "Too many failed login attempts. Offline login is locked for 5 minutes.",
      );
    }

    throw new Error(
      `Invalid email or password. ${MAX_FAILED_ATTEMPTS - attempts} attempt${
        MAX_FAILED_ATTEMPTS - attempts === 1 ? "" : "s"
      } remaining.`,
    );
  }

  clearEmailFailures(cleanEmail);

  const offlineAuthState = {
    ...account.authState,
    offline: true,
    session: account.authState.session || null,
    cached_at: new Date().toISOString(),
  };

  setCachedOfflineAuth(offlineAuthState);
  enableOfflineMode();

  writeAudit({
    type: "offline_login_success",
    email: cleanEmail,
    userId: account.userId,
    message: "Offline login successful.",
  });

  dispatchOfflineAuthEvent("shopcore-offline-login", offlineAuthState);

  return offlineAuthState;
}

export function hasOfflineAccounts() {
  return readOfflineAccounts().length > 0;
}

export function getOfflineAccounts() {
  return readOfflineAccounts().map((account: any) => ({
    email: account.email,
    userId: account.userId,
    tenantId: account.authState?.tenantId,
    tenantName: account.authState?.tenantName,
    role: account.authState?.role,
    updated_at: account.updated_at,
    locked: getEmailLockState(account.email).locked,
    lockedUntil: getEmailLockState(account.email).lockedUntil,
  }));
}

export function removeOfflineAccount(email: string) {
  const cleanEmail = normalizeEmail(email);
  const accounts = readOfflineAccounts().filter(
    (account: any) => normalizeEmail(account.email) !== cleanEmail,
  );

  writeOfflineAccounts(accounts);
  clearEmailFailures(cleanEmail);

  const cached = getCachedOfflineAuth();

  if (normalizeEmail(cached?.user?.email) === cleanEmail) {
    clearCachedOfflineAuth();
    disableOfflineMode();
  }

  writeAudit({
    type: "offline_logout",
    email: cleanEmail,
    message: "Offline account removed from this device.",
  });
}

export function getOfflineLoginAudit() {
  return readJson<OfflineAuditEvent[]>(OFFLINE_LOGIN_AUDIT_KEY, []);
}

export function clearOfflineLoginAudit() {
  writeJson(OFFLINE_LOGIN_AUDIT_KEY, []);
}

export function getOfflineSecurityState() {
  return readSecurityState();
}

export function isOfflineAuthReadyForUser(email?: string | null) {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail) return hasOfflineAccounts();

  return readOfflineAccounts().some(
    (account: any) => normalizeEmail(account.email) === cleanEmail,
  );
}

export function getOfflineAuthSummary() {
  const accounts = getOfflineAccounts();
  const cached = getCachedOfflineAuth();

  return {
    offlineMode: isOfflineMode(),
    cachedAuthAvailable: !!cached?.user?.id,
    accountsCount: accounts.length,
    accounts,
    activeEmail: cached?.user?.email || null,
    activeTenantId: cached?.tenantId || null,
    activeTenantName: cached?.tenantName || null,
    activeRole: cached?.role || null,
  };
}
