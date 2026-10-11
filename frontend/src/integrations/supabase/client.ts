import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/*
 * Auth/session no longer depends on Supabase (see src/lib/apiClient.ts),
 * but most other pages still call `supabase.from(...)` directly while
 * they're migrated to the new backend module by module. Those calls need
 * to fail gracefully at request time (most already have offline-cache
 * fallbacks) rather than crashing the entire app at import time just
 * because Supabase env vars aren't configured in a given environment.
 */
/**
 * Whether Supabase is actually pointed at something.
 *
 * Callers that would otherwise open a *persistent* connection must check this.
 * A one-off `from(...)` against the placeholder host fails once and falls back;
 * a realtime channel retries forever, so an unconfigured deployment fills the
 * console with `wss://placeholder.invalid ... ERR_NAME_NOT_RESOLVED` for as
 * long as the page is open, which buries real errors.
 */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

if (!isSupabaseConfigured) {
  console.warn(
    "Supabase env vars are not configured - pages that still read/write via supabase.from(...) will fail until they're migrated to the new backend.",
  );
}

export const supabase = createClient<Database>(
  SUPABASE_URL || "https://placeholder.invalid",
  SUPABASE_PUBLISHABLE_KEY || "placeholder-key",
  {
    auth: {
      storage: window.localStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
    global: {
      headers: {
        "X-Client-Info": "shopcore-pos",
      },
    },
  }
);

/*
 * With no Supabase to talk to, realtime is turned into a no-op.
 *
 * Several platform screens subscribe to `postgres_changes` — the sidebar does
 * it on every page, so the socket is permanent. Pointed at the placeholder
 * host each one retries forever, and the operator's console fills with
 * `wss://placeholder.invalid ... ERR_NAME_NOT_RESOLVED` until nothing else can
 * be seen in it. A console full of noise is a console nobody reads, which is
 * how a real error goes unnoticed.
 *
 * Neutralising `channel()` here rather than guarding each caller means the
 * screens keep their subscription code intact for when Supabase is configured
 * again, and any subscription added later is covered without anyone having to
 * remember this. The data on those screens comes from our own API and polls on
 * a timer regardless, so what is lost is liveness that never worked in this
 * deployment.
 */
if (!isSupabaseConfigured) {
  const noopChannel: Record<string, unknown> = {
    topic: "noop",
    on: () => noopChannel,
    subscribe: () => noopChannel,
    unsubscribe: () => Promise.resolve("ok"),
    send: () => Promise.resolve("ok"),
  };

  supabase.channel = (() => noopChannel) as never;
  supabase.removeChannel = (() => Promise.resolve("ok")) as never;
  supabase.removeAllChannels = (() => Promise.resolve([])) as never;
  supabase.getChannels = (() => []) as never;

  /*
   * Table reads answer locally instead of going to the placeholder host.
   *
   * Screens still on `supabase.from(...)` — much of the platform console — ask
   * for tables this deployment does not have. Every one of those requests
   * already fails; the only difference now is that it fails instantly and in
   * silence rather than after a DNS lookup and a console error apiece. The
   * returned shape is exactly what a failed request returns, `{ data: null,
   * error }`, so callers that check `error` and fall back behave identically.
   *
   * This is a muffler, not a fix: those screens still show nothing, because
   * their data was never migrated off Supabase. What it buys is a console
   * where a genuine error is visible.
   */
  const notConfigured = {
    message: "Supabase is not configured in this deployment",
    details: "",
    hint: "This screen still reads Supabase tables and has not been migrated to the ShopCore API.",
    code: "supabase_not_configured",
  };

  const settled = { data: null, error: notConfigured, count: null, status: 0, statusText: "" };

  /*
   * A query builder is chained (`.select().eq().order()`) and then awaited, so
   * the stub has to be both endlessly chainable and thenable. A Proxy gives
   * the first for free; `then` gives the second.
   */
  const makeBuilder = (): unknown => {
    const builder: unknown = new Proxy(
      {},
      {
        get(_target, property) {
          if (property === "then") {
            return (resolve: (value: unknown) => unknown) => Promise.resolve(settled).then(resolve);
          }
          if (property === "catch" || property === "finally") {
            return () => builder;
          }
          return () => builder;
        },
      },
    );

    return builder;
  };

  supabase.from = (() => makeBuilder()) as never;
  supabase.rpc = (() => makeBuilder()) as never;
}

// Automatically refresh session when internet returns
window.addEventListener("online", async () => {
  try {
    const { data } = await supabase.auth.getSession();

    if (!data.session) {
      return;
    }

    await supabase.auth.refreshSession();

    console.log("✅ Supabase session refreshed after reconnect");
  } catch (error) {
    console.warn("Failed to refresh session after reconnect", error);
  }
});