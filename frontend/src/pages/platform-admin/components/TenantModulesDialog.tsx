import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { platformApi } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

/**
 * Which modules one workspace can open, and the controls to change it.
 *
 * ## What an operator is deciding here
 *
 * Three states per module, and the third is the one that matters:
 *
 *   Granted   an override that opens it, whatever the plan says
 *   Blocked   an override that closes it, whatever the plan says
 *   Plan      no override — the subscription decides
 *
 * "Plan" is not a way of saying off. A module on Plan is open whenever the
 * subscription includes it and closes by itself when the customer moves down a
 * tier, which is what you want for almost everything. An override is a
 * deliberate exception to be used sparingly, so the dialog shows which ones
 * are currently in force and offers a one-click way back.
 *
 * Each row states what it does *now* and where that came from, because
 * "Reports: allowed" is only actionable once you know whether that is the plan
 * being generous or somebody's override.
 */
export function TenantModulesDialog({
  tenantId,
  tenantName,
  open,
  onClose,
}: {
  tenantId: string | null;
  tenantName: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const modulesQ = useQuery({
    queryKey: ["platform", "tenant-modules", tenantId],
    queryFn: () => platformApi.tenantModules(tenantId!),
    enabled: open && Boolean(tenantId),
  });

  const setModule = useMutation({
    mutationFn: ({
      moduleKey,
      status,
    }: {
      moduleKey: string;
      status: "enabled" | "disabled" | "trial" | "plan";
    }) =>
      status === "plan"
        ? platformApi.resetTenantModule(tenantId!, moduleKey)
        : platformApi.setTenantModule(tenantId!, moduleKey, status),

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["platform", "tenant-modules", tenantId] });
      toast.success(
        variables.status === "plan"
          ? "Back to the plan's decision"
          : variables.status === "disabled"
            ? "Module blocked for this workspace"
            : "Module granted",
        {
          description:
            variables.status === "plan"
              ? "The subscription decides this module again."
              : "It takes effect the next time they load the workspace.",
        },
      );
    },

    onError: (error: any) =>
      toast.error("That change did not save", {
        description: error?.message ?? "Please try again.",
      }),
  });

  const data = modulesQ.data;
  const busyKey = setModule.isPending ? setModule.variables?.moduleKey : null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden rounded-3xl p-0">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="text-lg font-semibold">Module access</DialogTitle>
          <DialogDescription>
            {tenantName ? (
              <>
                What <span className="font-semibold text-foreground">{tenantName}</span> can open.
                {data?.plan_code ? (
                  <> Currently on the <span className="font-semibold text-foreground">{data.plan_code}</span> plan.</>
                ) : null}
              </>
            ) : (
              "What this workspace can open."
            )}
            <span className="mt-1 block text-[12px]">
              Grant a module and this customer keeps it whatever plan they pay for — a Starter
              subscription can carry Professional features.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {modulesQ.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading modules…
            </div>
          ) : (
            <ul className="space-y-2">
              {(data?.modules ?? []).map((module) => {
                const busy = busyKey === module.module_key;

                return (
                  <li
                    key={module.module_key}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "h-8 w-1.5 shrink-0 rounded-full",
                        module.allowed ? "bg-emerald-500" : "bg-border",
                      )}
                    />

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {module.name}
                        </span>

                        {/*
                          The state, stated. An operator scanning this list is
                          answering "what has been given to this customer?",
                          and a row of identical buttons does not answer it —
                          the badge does, and the buttons then only offer what
                          is left to do.
                        */}
                        {module.source === "tenant_override" ? (
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              module.allowed
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                            )}
                          >
                            {module.allowed ? "GRANTED" : "REVOKED"}
                          </span>
                        ) : null}
                      </span>

                      <span className="block text-[11px] text-muted-foreground">
                        {module.source === "tenant_override"
                          ? module.allowed
                            ? "Granted on top of the plan — this customer keeps it whatever they pay for"
                            : "Revoked — closed even though the plan would allow it"
                          : module.plan_allows
                            ? "Open, because the plan includes it"
                            : "Closed, because the plan does not include it"}
                      </span>
                    </span>

                    <span className="flex shrink-0 items-center gap-1">
                      {/*
                        Grant and Revoke are the two decisions; "Plan" only
                        appears once an override exists, because that is the
                        only time undoing one means anything.
                      */}
                      {module.allowed ? (
                        <ModeButton
                          label="Revoke"
                          icon={<X className="h-3.5 w-3.5" />}
                          active={false}
                          disabled={busy}
                          onClick={() =>
                            setModule.mutate({ moduleKey: module.module_key, status: "disabled" })
                          }
                        />
                      ) : (
                        <ModeButton
                          label="Grant"
                          icon={<Check className="h-3.5 w-3.5" />}
                          active={false}
                          disabled={busy}
                          onClick={() =>
                            setModule.mutate({ moduleKey: module.module_key, status: "enabled" })
                          }
                        />
                      )}

                      {module.source === "tenant_override" ? (
                        <ModeButton
                          label="Reset"
                          icon={<RotateCcw className="h-3.5 w-3.5" />}
                          active={false}
                          disabled={busy}
                          onClick={() =>
                            setModule.mutate({ moduleKey: module.module_key, status: "plan" })
                          }
                        />
                      ) : null}

                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-border px-6 py-4">
          <Button variant="outline" className="rounded-xl" onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ModeButton({
  label,
  icon,
  active,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
        disabled && !active && "opacity-40",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
