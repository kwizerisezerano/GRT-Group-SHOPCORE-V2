import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";

import { ConfirmationDialog } from "../tenant360/components/ConfirmationDialog";
import { ExecutiveKPIs } from "../tenant360/components/ExecutiveKPIs";
import { Notice } from "../tenant360/components/Tenant360Primitives";
import { QuickActions } from "../tenant360/components/QuickActions";
import { Tenant360Tabs } from "../tenant360/components/Tenant360Tabs";
import { TenantHeader } from "../tenant360/components/TenantHeader";
import type {
  Tenant360PendingAction,
  Tenant360TabKey,
} from "../tenant360/components/Tenant360Types";

import { useTenant360 } from "../tenant360/useTenant360";
import {
  addDays,
  calculateTenant360Metrics,
} from "../tenant360/tenant360Utils";

import { AnalyticsTab } from "../tenant360/tabs/AnalyticsTab";
import { ApplicationsTab } from "../tenant360/tabs/ApplicationsTab";
import { AuditTab } from "../tenant360/tabs/AuditTab";
import { AutomationTab } from "../tenant360/tabs/AutomationTab";
import { BillingTab } from "../tenant360/tabs/BillingTab";
import { DeveloperTab } from "../tenant360/tabs/DeveloperTab";
import { DevicesTab } from "../tenant360/tabs/DevicesTab";
import { InfrastructureTab } from "../tenant360/tabs/InfrastructureTab";
import { LicensesTab } from "../tenant360/tabs/LicensesTab";
import { NotesTab } from "../tenant360/tabs/NotesTab";
import { OverviewTab } from "../tenant360/tabs/OverviewTab";
import { PeopleTab } from "../tenant360/tabs/PeopleTab";
import { SecurityTab } from "../tenant360/tabs/SecurityTab";
import { SupportTab } from "../tenant360/tabs/SupportTab";
import { UsageTab } from "../tenant360/tabs/UsageTab";
import { WorkspaceTab } from "../tenant360/tabs/WorkspaceTab";

type Tenant360DrawerProps = {
  tenantId: string | null;
  open: boolean;
  onClose: () => void;
};

type SupportAccessLevel = "readonly" | "support" | "full";

export default function Tenant360Drawer({
  tenantId,
  open,
  onClose,
}: Tenant360DrawerProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tenant360TabKey>("overview");
  const [pendingAction, setPendingAction] =
    useState<Tenant360PendingAction>(null);
  const [confirmationText, setConfirmationText] = useState("");
  const [note, setNote] = useState("");
  const [supportReason, setSupportReason] = useState(
    t("platformAdmin.tenant360.defaultSupportReason"),
  );
  const [supportAccessLevel, setSupportAccessLevel] =
    useState<SupportAccessLevel>("support");
  const [supportDurationMinutes, setSupportDurationMinutes] = useState(30);

  useEffect(() => {
    if (open) {
      setActiveTab("overview");
      setPendingAction(null);
      setConfirmationText("");
    }
  }, [tenantId, open]);

  const tenantQ = useTenant360(tenantId, open);
  const data = tenantQ.data;
  const metrics = useMemo(() => calculateTenant360Metrics(data), [data]);

  useEffect(() => {
    if (!tenantId || !open) return;

    const refetchTenant360 = () => {
      tenantQ.refetch();
    };

    const channel = supabase
      .channel(`tenant-360-live-${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "platform_tenant_devices",
          filter: `tenant_id=eq.${tenantId}`,
        },
        refetchTenant360,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "platform_device_security_events",
          filter: `tenant_id=eq.${tenantId}`,
        },
        refetchTenant360,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "platform_impersonation_sessions",
          filter: `tenant_id=eq.${tenantId}`,
        },
        refetchTenant360,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "platform_tenant_notes",
          filter: `tenant_id=eq.${tenantId}`,
        },
        refetchTenant360,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subscription_invoices",
          filter: `tenant_id=eq.${tenantId}`,
        },
        refetchTenant360,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, open, tenantQ.refetch]);

  const closeConfirmation = () => {
    setPendingAction(null);
    setConfirmationText("");
  };

  const addNote = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error(t("platformAdmin.tenant360.errors.missingWorkspace"));
      if (!note.trim()) throw new Error(t("platformAdmin.tenant360.errors.noteRequired"));

      const { error } = await (supabase as any)
        .from("platform_tenant_notes")
        .insert({
          tenant_id: tenantId,
          note: note.trim(),
          category: "general",
          is_private: true,
        });

      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(t("platformAdmin.tenant360.messages.noteSaved"));
      setNote("");
      await tenantQ.invalidateTenant360();
    },
    onError: (error: any) =>
      toast.error(error?.message || t("platformAdmin.tenant360.errors.noteSaveFailed")),
  });

  const activateWorkspace = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error(t("platformAdmin.tenant360.errors.missingWorkspace"));

      const { error } = await (supabase as any).rpc(
        "activate_workspace_after_payment",
        {
          p_tenant_id: tenantId,
          p_payment_reference: `TENANT360-${Date.now()}`,
          p_verification_notes: t("platformAdmin.tenant360.activationNote"),
        },
      );

      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(t("platformAdmin.tenant360.messages.workspaceActivated"));
      closeConfirmation();
      await tenantQ.invalidateTenant360();
    },
    onError: (error: any) =>
      toast.error(error?.message || t("platformAdmin.tenant360.errors.activationFailed")),
  });

  const startSupportAccess = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error(t("platformAdmin.tenant360.errors.missingWorkspace"));

      const { data, error } = await (supabase as any).rpc(
        "start_platform_impersonation",
        {
          p_tenant_id: tenantId,
          p_reason: supportReason.trim() || t("platformAdmin.tenant360.defaultSupportReason"),
          p_access_level: supportAccessLevel,
          p_duration_minutes: supportDurationMinutes,
          p_ip_address: null,
          p_user_agent:
            typeof navigator !== "undefined" ? navigator.userAgent : null,
        },
      );

      if (error) throw error;

      return data;
    },
    onSuccess: async (result: any) => {
      toast.success(t("platformAdmin.tenant360.messages.supportStarted"));
      closeConfirmation();
      await tenantQ.invalidateTenant360();

      if (result?.support_url) {
        window.open(result.support_url, "_blank", "noopener,noreferrer");
      }
    },
    onError: (error: any) =>
      toast.error(error?.message || t("platformAdmin.tenant360.errors.supportStartFailed")),
  });

  const endSupportAccess = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await (supabase as any).rpc(
        "end_platform_impersonation",
        {
          p_session_id: sessionId,
        },
      );

      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(t("platformAdmin.tenant360.messages.supportEnded"));
      closeConfirmation();
      await tenantQ.invalidateTenant360();
    },
    onError: (error: any) =>
      toast.error(error?.message || t("platformAdmin.tenant360.errors.supportEndFailed")),
  });

  const trialAction = useMutation({
    mutationFn: async ({
      action,
      days,
    }: {
      action: "approve" | "extend" | "suspend";
      days?: number;
    }) => {
      if (!tenantId) throw new Error(t("platformAdmin.tenant360.errors.missingWorkspace"));

      const updates: Record<string, any> = {};

      if (action === "approve") {
        updates.trial_status = "approved";
        updates.trial_ends_at = addDays(days || 14);
        updates.workspace_status = "active";
        updates.subscription_status = "trial";
        updates.onboarding_completed = true;
      }

      if (action === "extend") {
        updates.trial_status = "approved";
        updates.trial_ends_at = addDays(days || 14);
        updates.workspace_status = "active";
        updates.subscription_status = "trial";
      }

      if (action === "suspend") {
        updates.workspace_status = "suspended";
        updates.subscription_status = "suspended";
        updates.suspension_reason = t("platformAdmin.tenant360.suspensionReason");
      }

      const { error } = await (supabase as any)
        .from("tenants")
        .update(updates)
        .eq("id", tenantId);

      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(t("platformAdmin.tenant360.messages.statusUpdated"));
      closeConfirmation();
      await tenantQ.invalidateTenant360();
    },
    onError: (error: any) => toast.error(error?.message || t("platformAdmin.tenant360.errors.actionFailed")),
  });

  const confirmPendingAction = () => {
    if (!pendingAction) return;

    if ("confirmText" in pendingAction && pendingAction.confirmText) {
      if (confirmationText.trim() !== pendingAction.confirmText) {
        toast.error(t("platformAdmin.tenant360.typeToConfirm", { value: pendingAction.confirmText }));
        return;
      }
    }

    if (pendingAction.type === "activate") {
      activateWorkspace.mutate();
      return;
    }

    if (pendingAction.type === "approve") {
      trialAction.mutate({ action: "approve", days: pendingAction.days });
      return;
    }

    if (pendingAction.type === "extend") {
      trialAction.mutate({ action: "extend", days: pendingAction.days });
      return;
    }

    if (pendingAction.type === "suspend") {
      trialAction.mutate({ action: "suspend" });
      return;
    }

    if (pendingAction.type === "support_access") {
      startSupportAccess.mutate();
      return;
    }

    if (pendingAction.type === "end_support_access") {
      endSupportAccess.mutate(pendingAction.sessionId);
    }
  };

  if (!open) return null;

  const busy =
    activateWorkspace.isPending ||
    trialAction.isPending ||
    addNote.isPending ||
    startSupportAccess.isPending ||
    endSupportAccess.isPending;

  return (
    <div className="fixed inset-0 z-[90]">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
        onClick={onClose}
      />

      <aside className="absolute right-0 top-0 flex h-full w-full max-w-7xl flex-col overflow-hidden bg-background shadow-[0_30px_90px_-40px_rgba(15,23,42,0.9)]">
        <TenantHeader
          data={data}
          metrics={metrics}
          onClose={onClose}
          refetch={() => tenantQ.refetch()}
          busy={busy}
          setPendingAction={setPendingAction}
          setConfirmationText={setConfirmationText}
        />

        <Tenant360Tabs activeTab={activeTab} onChange={setActiveTab} />

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden xl:grid-cols-[1fr_320px]">
          <main className="overflow-y-auto p-6">
            {tenantQ.isLoading ? (
              <Notice tone="blue" text={t("platformAdmin.tenant360.loading")} />
            ) : tenantQ.isError ? (
              <Notice tone="rose" text={t("platformAdmin.tenant360.loadFailed")} />
            ) : (
              <div className="space-y-6">
                <ExecutiveKPIs metrics={metrics} />

                {activeTab === "overview" && (
                  <OverviewTab data={data} metrics={metrics} />
                )}

                {activeTab === "workspace" && (
                  <WorkspaceTab data={data} metrics={metrics} />
                )}

                {activeTab === "people" && <PeopleTab data={data} />}

                {activeTab === "security" && (
                  <SecurityTab
                    data={data}
                    metrics={metrics}
                    busy={busy}
                    setPendingAction={setPendingAction}
                    setConfirmationText={setConfirmationText}
                  />
                )}

                {activeTab === "applications" && (
                  <ApplicationsTab metrics={metrics} />
                )}

                {activeTab === "infrastructure" && (
                  <InfrastructureTab metrics={metrics} />
                )}

                {activeTab === "billing" && (
                  <BillingTab data={data} metrics={metrics} />
                )}

                {activeTab === "support" && (
                  <SupportTab
                    data={data}
                    busy={busy}
                    setPendingAction={setPendingAction}
                    setConfirmationText={setConfirmationText}
                  />
                )}

                {activeTab === "analytics" && (
                  <AnalyticsTab metrics={metrics} />
                )}

                {activeTab === "usage" && <UsageTab data={data} />}

                {activeTab === "licenses" && <LicensesTab data={data} />}

                {activeTab === "devices" && <DevicesTab data={data} />}

                {activeTab === "audit" && <AuditTab data={data} />}

                {activeTab === "automation" && (
                  <AutomationTab data={data} />
                )}

                {activeTab === "developer" && (
                  <DeveloperTab data={data} metrics={metrics} />
                )}

                {activeTab === "notes" && (
                  <NotesTab
                    note={note}
                    setNote={setNote}
                    data={data}
                    busy={busy}
                    addNote={() => addNote.mutate()}
                  />
                )}
              </div>
            )}
          </main>

          <aside className="hidden overflow-y-auto border-l border-border bg-card p-5 xl:block">
            <QuickActions
              busy={busy}
              refetch={() => tenantQ.refetch()}
              supportReason={supportReason}
              setSupportReason={setSupportReason}
              supportAccessLevel={supportAccessLevel}
              setSupportAccessLevel={setSupportAccessLevel}
              supportDurationMinutes={supportDurationMinutes}
              setSupportDurationMinutes={setSupportDurationMinutes}
              setConfirmationText={setConfirmationText}
              setPendingAction={setPendingAction}
              setActiveTab={setActiveTab}
            />
          </aside>
        </div>
      </aside>

      <ConfirmationDialog
        pendingAction={pendingAction}
        confirmationText={confirmationText}
        setConfirmationText={setConfirmationText}
        busy={busy}
        closeConfirmation={closeConfirmation}
        confirmPendingAction={confirmPendingAction}
      />
    </div>
  );
}