import { Building2, Headphones, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Tenant360PendingAction } from "./Tenant360Types";
import { PlatformStatusBadge } from "@/pages/platform-admin/components/PlatformStatusBadge";
import { formatDate } from "../tenant360Utils";

type PendingAction =
  | null
  | { type: "activate"; title: string; description: string; confirmText: "ACTIVATE" }
  | { type: "approve"; title: string; description: string; days: number; confirmText?: never }
  | { type: "extend"; title: string; description: string; days: number; confirmText?: never }
  | { type: "suspend"; title: string; description: string; confirmText: "SUSPEND" }
  | { type: "support_access"; title: string; description: string; confirmText: "SUPPORT" }
  | { type: "end_support_access"; title: string; description: string; sessionId: string; confirmText: "END" };

export function TenantHeader({
  data,
  metrics,
  onClose,
  refetch,
  busy,
  setPendingAction,
  setConfirmationText,
}: {
  data: any;
  metrics: any;
  onClose: () => void;
  refetch: () => void;
  busy: boolean;
  setPendingAction: (value: Tenant360PendingAction) => void;
  setConfirmationText: (value: string) => void;
}) {
  return (
    <header className="border-b border-slate-200 bg-white px-6 py-5">
      <div className="flex items-start justify-between gap-5">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl border border-blue-200 bg-blue-50 text-blue-700">
            <Building2 className="h-8 w-8" />
          </div>

          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
              Tenant 360 Workspace Control Center
            </p>

            <h2 className="mt-1 truncate text-2xl font-black text-slate-950">
              {data?.tenant?.name || "Workspace Profile"}
            </h2>

            <p className="mt-1 text-sm font-bold text-slate-500">
              {data?.tenant?.industry || "Retail"} ·{" "}
              {data?.tenant?.country || "Rwanda"} · Created{" "}
              {formatDate(data?.tenant?.created_at)}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <PlatformStatusBadge
                status={data?.tenant?.workspace_status || "pending"}
              />

              <PlatformStatusBadge
                status={data?.tenant?.payment_status || "pending"}
              />

              <PlatformStatusBadge
                status={
                  data?.subscription?.status ||
                  data?.tenant?.subscription_status ||
                  "pending"
                }
              />

              {metrics.activeSupportSessions > 0 && (
                <PlatformStatusBadge status="support_access_active" />
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            className="rounded-xl border-orange-200 bg-orange-50 font-black text-orange-700 hover:bg-orange-100"
            disabled={busy}
            onClick={() => {
              setConfirmationText("");
              setPendingAction({
                type: "support_access",
                title: "Start support access?",
                description:
                  "This creates a tracked platform support access session for this workspace. Use only for customer support or troubleshooting.",
                confirmText: "SUPPORT",
              });
            }}
          >
            <Headphones className="mr-2 h-4 w-4" />
            Support Access
          </Button>

          <Button
            variant="outline"
            className="rounded-xl border-slate-200 font-black"
            onClick={refetch}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="rounded-2xl border-slate-200"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}