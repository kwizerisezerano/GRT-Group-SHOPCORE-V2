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
export function apiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL as string | undefined;
  return configured ? configured.replace(/\/$/, "") : "";
}
