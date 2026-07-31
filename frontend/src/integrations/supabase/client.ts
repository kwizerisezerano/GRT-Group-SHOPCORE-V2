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
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
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