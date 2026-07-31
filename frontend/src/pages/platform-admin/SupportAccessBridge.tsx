import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const SUPPORT_CONTEXT_KEY = "shopcore_platform_support_context";

export default function SupportAccessBridge() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "ready" | "failed">(
    "loading",
  );
  const [message, setMessage] = useState("Validating secure support access...");
  const [supportContext, setSupportContext] = useState<any>(null);

  const canValidate = useMemo(() => !!sessionId && !!token, [sessionId, token]);

  useEffect(() => {
    let mounted = true;

    async function validateAccess() {
      try {
        if (!canValidate) {
          throw new Error("Support access link is missing required credentials.");
        }

        const { data, error } = await (supabase as any).rpc(
          "validate_platform_support_access",
          {
            p_session_id: sessionId,
            p_support_token: token,
          },
        );

        if (error) throw error;

        const context = {
          sessionId: data.session_id,
          tenantId: data.tenant_id,
          platformAdminId: data.platform_admin_id,
          reason: data.reason,
          accessLevel: data.access_level,
          startedAt: data.started_at,
          expiresAt: data.expires_at,
          status: data.status,
          openedAt: new Date().toISOString(),
        };

        localStorage.setItem(SUPPORT_CONTEXT_KEY, JSON.stringify(context));

        if (!mounted) return;

        setSupportContext(context);
        setStatus("ready");
        setMessage("Secure support access validated.");

        toast.success("Support access validated.");
      } catch (error: any) {
        if (!mounted) return;

        setStatus("failed");
        setMessage(error?.message || "Support access could not be validated.");
        toast.error(error?.message || "Support access failed.");
      }
    }

    validateAccess();

    return () => {
      mounted = false;
    };
  }, [canValidate, sessionId, token]);

  const enterWorkspace = () => {
    if (!supportContext?.tenantId) return;

    navigate(`/app?tenant_id=${supportContext.tenantId}&support_session=${supportContext.sessionId}`);
  };

  const returnToPlatform = () => {
    navigate("/platform-admin/tenants");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <section className="w-full max-w-xl rounded-[2rem] border border-slate-800 bg-white p-8 shadow-[0_30px_100px_-50px_rgba(15,23,42,1)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-blue-200 bg-blue-50 text-blue-700">
          {status === "loading" && <Loader2 className="h-8 w-8 animate-spin" />}
          {status === "ready" && <CheckCircle2 className="h-8 w-8" />}
          {status === "failed" && <AlertTriangle className="h-8 w-8 text-rose-600" />}
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
            ShopCore Secure Support Access
          </p>

          <h1 className="mt-3 text-3xl font-black text-slate-950">
            {status === "loading" && "Validating Access"}
            {status === "ready" && "Support Session Ready"}
            {status === "failed" && "Access Validation Failed"}
          </h1>

          <p className="mt-3 text-sm font-medium leading-6 text-slate-500">
            {message}
          </p>
        </div>

        {status === "ready" && (
          <div className="mt-6 rounded-2xl border border-orange-200 bg-orange-50 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-orange-700" />

              <div>
                <p className="text-sm font-black text-orange-800">
                  Platform Support Session Active
                </p>

                <p className="mt-1 text-xs font-bold leading-5 text-orange-700">
                  Reason: {supportContext?.reason}
                </p>

                <p className="mt-1 text-xs font-bold leading-5 text-orange-700">
                  Access Level: {supportContext?.accessLevel}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-7 flex gap-3">
          <Button
            variant="outline"
            className="h-12 flex-1 rounded-xl border-slate-300 font-black"
            onClick={returnToPlatform}
          >
            Return to Platform
          </Button>

          <Button
            className="h-12 flex-1 rounded-xl bg-blue-700 font-black hover:bg-blue-800"
            disabled={status !== "ready"}
            onClick={enterWorkspace}
          >
            Enter Workspace
          </Button>
        </div>
      </section>
    </main>
  );
}