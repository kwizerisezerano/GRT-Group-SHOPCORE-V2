import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Tenant360PendingAction } from "./Tenant360Types";

export function ConfirmationDialog({
  pendingAction,
  confirmationText,
  setConfirmationText,
  busy,
  closeConfirmation,
  confirmPendingAction,
}: {
  pendingAction: Tenant360PendingAction;
  confirmationText: string;
  setConfirmationText: (value: string) => void;
  busy: boolean;
  closeConfirmation: () => void;
  confirmPendingAction: () => void;
}) {
  if (!pendingAction) return null;

  const requiresTypedConfirmation =
    "confirmText" in pendingAction && !!pendingAction.confirmText;

  const typedConfirmationValid =
    !requiresTypedConfirmation ||
    confirmationText.trim() === pendingAction.confirmText;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_30px_90px_-40px_rgba(15,23,42,0.9)]">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
          Confirm action
        </p>

        <h3 className="mt-3 text-2xl font-black text-slate-950">
          {pendingAction.title}
        </h3>

        <p className="mt-3 text-sm font-medium leading-6 text-slate-500">
          {pendingAction.description}
        </p>

        {requiresTypedConfirmation && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Type {pendingAction.confirmText} to continue
            </p>

            <Input
              value={confirmationText}
              onChange={(event) => setConfirmationText(event.target.value)}
              placeholder={pendingAction.confirmText}
              className="h-11 rounded-xl border-slate-300 font-black"
            />
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <Button
            variant="outline"
            className="h-11 flex-1 rounded-xl border-slate-300 font-black"
            disabled={busy}
            onClick={closeConfirmation}
          >
            Cancel
          </Button>

          <Button
            className={[
              "h-11 flex-1 rounded-xl font-black",
              pendingAction.type === "suspend" ||
              pendingAction.type === "end_support_access"
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-blue-700 hover:bg-blue-800",
            ].join(" ")}
            disabled={busy || !typedConfirmationValid}
            onClick={confirmPendingAction}
          >
            {busy ? "Processing..." : "Confirm"}
          </Button>
        </div>
      </div>
    </div>
  );
}