/**
 * Where the API lives.
 *
 * Its own module so the API client and the connectivity monitor can both use
 * it without importing each other — the monitor probes the API directly rather
 * than through the client, because the client reports *to* the monitor and a
 * cycle between them would be a bootstrapping problem waiting to happen.
 *
 * Empty in browser development, where Vite proxies `/api` to the backend, so
 * requests stay same-origin and no CORS is involved.
 */
const SERVER_URL_KEY = "shopcore_server_url";

/**
 * True when running inside the packaged desktop app rather than a browser.
 *
 * Tauri serves the built frontend from its own scheme — `tauri://localhost`,
 * or `http://tauri.localhost` on Windows — and injects `__TAURI_INTERNALS__`
 * into the page. Either signal alone is enough.
 */
export function isDesktopApp(): boolean {
  if (typeof window === "undefined") return false;

  const w = window as unknown as Record<string, unknown>;
  if (w.__TAURI_INTERNALS__ || w.__TAURI__) return true;

  const { protocol, hostname } = window.location;
  return protocol === "tauri:" || hostname === "tauri.localhost";
}

/**
 * Where the desktop app should look for the server, when nothing else says.
 *
 * A shop running ShopCore on the counter usually has the backend on the same
 * machine or on a small server in the back office. Localhost is the right
 * first guess for the former and is what a single-machine install needs to
 * work with no configuration at all.
 */
const DESKTOP_DEFAULT = "http://127.0.0.1:4000";

/**
 * The server address a desktop install has been pointed at, if any.
 *
 * Kept in localStorage rather than baked in at build time so that one signed
 * installer works for every shop: the branch with the server at
 * 192.168.1.50 and the one running everything on the till both use the same
 * binary. See `setServerUrl`.
 */
function storedServerUrl(): string | null {
  try {
    const value = localStorage.getItem(SERVER_URL_KEY);
    return value ? value.replace(/\/$/, "") : null;
  } catch {
    return null;
  }
}

/** Points this install at a server. Pass null to fall back to the default. */
export function setServerUrl(url: string | null) {
  try {
    if (url) localStorage.setItem(SERVER_URL_KEY, url.replace(/\/$/, ""));
    else localStorage.removeItem(SERVER_URL_KEY);
  } catch {
    // Storage can be unavailable; the default still applies.
  }
}

export function getServerUrl(): string | null {
  return storedServerUrl();
}

/**
 * Where the API lives.
 *
 * Its own module so the API client and the connectivity monitor can both use
 * it without importing each other — the monitor probes the API directly rather
 * than through the client, because the client reports *to* the monitor and a
 * cycle between them would be a bootstrapping problem waiting to happen.
 *
 * ## Why this is not simply an empty string
 *
 * In browser development Vite proxies `/api` to the backend, so a relative URL
 * is correct and keeps requests same-origin with no CORS involved. That is
 * where this started and it was all it did.
 *
 * The packaged desktop app has no proxy. It serves static files from
 * `tauri://localhost`, so a relative `/api/...` resolves against that scheme
 * and reaches nothing — every request fails, the connectivity monitor
 * correctly concludes the API is unreachable, and the app sits permanently in
 * offline mode with a queue that can never drain. Which is to say: the desktop
 * build, which is what the client actually runs, could not talk to its own
 * backend at all.
 *
 * So the desktop resolves an absolute address: what the install was pointed
 * at, else localhost. `VITE_API_URL` still wins everywhere when it is set, for
 * a hosted deployment served from a different origin.
 */
export function apiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL as string | undefined;
  if (configured) return configured.replace(/\/$/, "");

  if (isDesktopApp()) return storedServerUrl() ?? DESKTOP_DEFAULT;

  return "";
}
