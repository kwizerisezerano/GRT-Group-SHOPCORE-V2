import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Clock, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const SUPPORT_CONTEXT_KEY = "shopcore_platform_support_context";

function getSupportContext() {
  try {
    const value = localStorage.getItem(SUPPORT_CONTEXT_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function clearSupportContext() {
  localStorage.removeItem(SUPPORT_CONTEXT_KEY);
}

function getRemainingMinutes(expiresAt?: string) {
  if (!expiresAt) return 0;

  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 60000));
}

export function PlatformSupportBanner() {
  const [context, setContext] = useState<any>(() => getSupportContext());
  const [remainingMinutes, setRemainingMinutes] = useState(() =>
    getRemainingMinutes(context?.expiresAt),
  );
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    if (!context?.expiresAt) return;

    const timer = window.setInterval(() => {
      const remaining = getRemainingMinutes(context.expiresAt);
      setRemainingMinutes(remaining);

      if (remaining <= 0) {
        clearSupportContext();
        setContext(null);
      }
    }, 30000);

    return () => window.clearInterval(timer);
  }, [context?.expiresAt]);

  useEffect(() => {
    if (!context?.sessionId) return;

    const touchSession = async () => {
      const { data, error } = await (supabase as any).rpc(
        "touch_platform_impersonation_session",
        {
          p_session_id: context.sessionId,
        },
      );

      if (error || data?.status !== "active") {
        clearSupportContext();
        setContext(null);
      }
    };

    touchSession();

    const timer = window.setInterval(touchSession, 60000);

    return () => window.clearInterval(timer);
  }, [context?.sessionId]);

  const isActive = useMemo(() => {
    return !!context?.sessionId && remainingMinutes > 0;
  }, [context?.sessionId, remainingMinutes]);

  if (!isActive) return null;

  const endSession = async () => {
    try {
      setEnding(true);

      const { error } = await (supabase as any).rpc(
        "end_platform_impersonation",
        {
          p_session_id: context.sessionId,
        },
      );

      if (error) throw error;

      clearSupportContext();
      setContext(null);
      toast.success("Support session ended.");
    } catch (error: any) {
      toast.error(error?.message || "Could not end support session.");
    } finally {
      setEnding(false);
    }
  };

  const returnToPlatform = () => {
    window.location.href = "/platform-admin/tenants";
  };

  const dismissLocalBanner = () => {
    clearSupportContext();
    setContext(null);
  };

  return (
    <div className="sticky top-0 z-[80] border-b border-orange-300 bg-orange-50 px-4 py-3 shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-orange-200 bg-white text-orange-700">
            <ShieldCheck className="h-5 w-5" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-black text-orange-900">
                Platform Support Access Active
              </p>

              <span className="rounded-full border border-orange-200 bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-orange-700">
                {context.accessLevel || "support"}
              </span>

              <span className="flex items-center gap-1 rounded-full border border-orange-200 bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-orange-700">
                <Clock className="h-3 w-3" />
                {remainingMinutes} min left
              </span>
            </div>

            <p className="mt-1 text-xs font-bold leading-5 text-orange-800">
              Reason: {context.reason || "Customer support and troubleshooting."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="h-10 rounded-xl border-orange-300 bg-white font-black text-orange-800 hover:bg-orange-100"
            onClick={returnToPlatform}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Return to Platform
          </Button>

          <Button
            variant="outline"
            className="h-10 rounded-xl border-rose-300 bg-white font-black text-rose-700 hover:bg-rose-50"
            disabled={ending}
            onClick={endSession}
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            {ending ? "Ending..." : "End Session"}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl text-orange-800 hover:bg-orange-100"
            onClick={dismissLocalBanner}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}