import { useMemo, useState } from "react";
import { CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DataPanel,
  EmptyState,
  MetricCard,
  PageShell,
  StatusPill,
  usePlatformQuery,
} from "./PlatformOperationsSuite";

export default function PlatformPermissions() {
  const queryClient = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");

  const matrixQ = usePlatformQuery({
    key: "platform-permissions-matrix-suite",
    query: async () => {
      const [rolesRes, permissionsRes, linksRes] = await Promise.all([
        (supabase as any)
          .from("platform_roles")
          .select("*")
          .order("role_name", { ascending: true }),

        (supabase as any)
          .from("platform_permissions")
          .select("*")
          .order("module_key", { ascending: true })
          .order("action_key", { ascending: true }),

        (supabase as any).from("platform_role_permissions").select("*"),
      ]);

      if (rolesRes.error) throw rolesRes.error;
      if (permissionsRes.error) throw permissionsRes.error;
      if (linksRes.error) throw linksRes.error;

      return {
        roles: rolesRes.data ?? [],
        permissions: permissionsRes.data ?? [],
        links: linksRes.data ?? [],
      };
    },
  });

  const togglePermission = useMutation({
    mutationFn: async (permissionId: string) => {
      if (!selectedRoleId) throw new Error("Select a role first.");

      const { error } = await (supabase as any).rpc(
        "toggle_platform_role_permission",
        {
          p_role_id: selectedRoleId,
          p_permission_id: permissionId,
        },
      );

      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Permission updated.");

      await Promise.all([
        matrixQ.refetch(),
        queryClient.invalidateQueries({ queryKey: ["platform-roles-suite"] }),
      ]);
    },
    onError: (error: any) =>
      toast.error(error?.message || "Permission update failed."),
  });

  const roles = matrixQ.data?.roles ?? [];
  const permissions = matrixQ.data?.permissions ?? [];
  const links = matrixQ.data?.links ?? [];

  const selectedRole = roles.find((role: any) => role.id === selectedRoleId);

  const modules = useMemo(
    () => Array.from(new Set(permissions.map((p: any) => p.module_key))),
    [permissions],
  );

  const enabledPermissionIds = useMemo(() => {
    return new Set(
      links
        .filter((link: any) => link.role_id === selectedRoleId)
        .map((link: any) => link.permission_id),
    );
  }, [links, selectedRoleId]);

  return (
    <PageShell
      eyebrow="Identity & Security"
      title="Permissions Explorer"
      description="Manage the permission matrix for platform roles across dashboard, tenants, billing, devices, support, storage, analytics, infrastructure, and automation."
      icon={<KeyRound className="h-7 w-7" />}
      onRefresh={() => matrixQ.refetch()}
    >
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Permissions" value={permissions.length} />
        <MetricCard label="Modules" value={modules.length} tone="violet" />
        <MetricCard label="Roles" value={roles.length} tone="blue" />
        <MetricCard
          label="Selected Role Access"
          value={enabledPermissionIds.size}
          tone="emerald"
        />
      </section>

      <DataPanel title="Role Selector">
        {!roles.length ? (
          <EmptyState text="No platform roles configured." />
        ) : (
          <div className="flex flex-wrap gap-2">
            {roles.map((role: any) => (
              <button
                key={role.id}
                type="button"
                onClick={() => setSelectedRoleId(role.id)}
                className={[
                  "rounded-xl border px-4 py-3 text-left transition",
                  selectedRoleId === role.id
                    ? "border-blue-300 bg-blue-50 text-blue-800"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-white",
                ].join(" ")}
              >
                <p className="text-sm font-black">{role.role_name}</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] opacity-70">
                  {role.role_key}
                </p>
              </button>
            ))}
          </div>
        )}
      </DataPanel>

      <DataPanel
        title={
          selectedRole
            ? `Permission Matrix · ${selectedRole.role_name}`
            : "Permission Matrix"
        }
      >
        {!selectedRoleId ? (
          <EmptyState text="Select a role to manage permissions." />
        ) : !permissions.length ? (
          <EmptyState text="No permissions configured." />
        ) : (
          <div className="space-y-4">
            {modules.map((moduleKey) => {
              const modulePermissions = permissions.filter(
                (permission: any) => permission.module_key === moduleKey,
              );

              return (
                <div
                  key={String(moduleKey)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-black capitalize text-slate-950">
                      {String(moduleKey).replace(/_/g, " ")}
                    </p>

                    <StatusPill
                      status={`${modulePermissions.length} permissions`}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {modulePermissions.map((permission: any) => {
                      const enabled = enabledPermissionIds.has(permission.id);

                      return (
                        <button
                          key={permission.id}
                          type="button"
                          disabled={togglePermission.isPending}
                          onClick={() => togglePermission.mutate(permission.id)}
                          className={[
                            "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-black transition disabled:opacity-60",
                            enabled
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              : "border-slate-200 bg-white text-slate-500 hover:bg-slate-100",
                          ].join(" ")}
                        >
                          {enabled ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <ShieldCheck className="h-3.5 w-3.5" />
                          )}
                          {permission.action_key}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DataPanel>
    </PageShell>
  );
}