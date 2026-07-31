import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function PlatformAdminRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkPlatformAccess() {
      if (loading) return;

      if (!user) {
        if (mounted) {
          setAllowed(false);
          setChecking(false);
        }
        return;
      }

      try {
        const { data, error } = await (supabase as any).rpc(
          "is_platform_admin",
        );

        if (error) throw error;

        if (mounted) {
          setAllowed(!!data);
          setChecking(false);
        }
      } catch {
        if (mounted) {
          setAllowed(false);
          setChecking(false);
        }
      }
    }

    checkPlatformAccess();

    return () => {
      mounted = false;
    };
  }, [user, loading]);

  if (loading || checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#070b67]" />
          <p className="mt-4 text-sm font-bold text-slate-500">
            Verifying platform access...
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="max-w-lg rounded-[2rem] border border-rose-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
            <ShieldAlert className="h-7 w-7" />
          </div>

          <h1 className="mt-5 text-2xl font-black tracking-tight text-slate-950">
            Platform access restricted
          </h1>

          <p className="mt-3 text-sm font-medium leading-6 text-slate-500">
            This area is reserved for authorized ShopCore platform
            administrators. Tenant owners and workspace users cannot access
            platform administration.
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}