import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ShieldCheck, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { PlatformPageHeader } from "@/pages/platform-admin/components/PlatformPageHeader";
import { PlatformKpiCard } from "@/pages/platform-admin/components/PlatformKpiCard";
import { PlatformSearchBar } from "@/pages/platform-admin/components/PlatformSearchBar";
import { PlatformStatusBadge } from "@/pages/platform-admin/components/PlatformStatusBadge";
import { toast } from "sonner";

type FeatureFlag = {
  id: string;
  flag_key: string;
  name: string;
  category: string;
  description: string | null;
  scope: string;
  is_enabled: boolean;
  rollout_percentage: number;
  updated_at: string | null;
};

export default function FeatureFlags() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const flagsQ = useQuery({
    queryKey: ["platform-feature-flags"],
    queryFn: async (): Promise<FeatureFlag[]> => {
      const { data, error } = await (supabase as any)
        .from("platform_feature_flags")
        .select(
          "id, flag_key, name, category, description, scope, is_enabled, rollout_percentage, updated_at",
        )
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });

  const toggleFlag = useMutation({
    mutationFn: async (flag: FeatureFlag) => {
      const { error } = await (supabase as any)
        .from("platform_feature_flags")
        .update({
          is_enabled: !flag.is_enabled,
          updated_at: new Date().toISOString(),
        })
        .eq("id", flag.id);

      if (error) throw error;

      await (supabase as any).rpc("record_platform_event", {
        p_event_type: "feature_flag_updated",
        p_title: "Feature flag updated",
        p_description: `${flag.name} was ${
          flag.is_enabled ? "disabled" : "enabled"
        }.`,
        p_metadata: {
          flag_key: flag.flag_key,
          previous_state: flag.is_enabled,
          new_state: !flag.is_enabled,
        },
      });
    },
    onSuccess: () => {
      toast.success("Feature flag updated.");
      qc.invalidateQueries({ queryKey: ["platform-feature-flags"] });
      qc.invalidateQueries({ queryKey: ["platform-audit-logs"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Feature flag update failed.");
    },
  });

  const flags = flagsQ.data ?? [];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return flags.filter((flag) => {
      if (!q) return true;

      return (
        flag.name.toLowerCase().includes(q) ||
        flag.flag_key.toLowerCase().includes(q) ||
        flag.category.toLowerCase().includes(q) ||
        flag.scope.toLowerCase().includes(q)
      );
    });
  }, [flags, search]);

  const stats = useMemo(() => {
    return {
      total: flags.length,
      enabled: flags.filter((flag) => flag.is_enabled).length,
      disabled: flags.filter((flag) => !flag.is_enabled).length,
      enterprise: flags.filter((flag) => flag.scope === "enterprise").length,
    };
  }, [flags]);

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        eyebrow="Platform Configuration"
        title="Feature Flags"
        description="Control platform capabilities by product tier, rollout stage and operational readiness. Every update is persisted and audit-ready."
        actions={
          <Button
            className="rounded-xl bg-[#070b67] font-black hover:bg-[#050950]"
            onClick={() => {
              flagsQ.refetch();
              toast.info("Refreshing feature flags...");
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-1">
        <PlatformKpiCard
          icon={<ToggleRight className="h-6 w-6" />}
          label="Total Flags"
          value={stats.total.toLocaleString()}
          tone="blue"
        />
        <PlatformKpiCard
          icon={<ShieldCheck className="h-6 w-6" />}
          label="Enabled"
          value={stats.enabled.toLocaleString()}
          tone="emerald"
        />
        <PlatformKpiCard
          icon={<ToggleLeft className="h-6 w-6" />}
          label="Disabled"
          value={stats.disabled.toLocaleString()}
          tone="orange"
        />
        <PlatformKpiCard
          icon={<ShieldCheck className="h-6 w-6" />}
          label="Enterprise Scope"
          value={stats.enterprise.toLocaleString()}
          tone="violet"
        />
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <PlatformSearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search feature name, key, category or scope..."
          />
        </div>

        {flagsQ.isLoading ? (
          <div className="py-12 text-center text-sm font-bold text-slate-500">
            Loading feature flags...
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm font-bold text-slate-500">
            No feature flags found.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Feature</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Scope</th>
                  <th className="px-4 py-3">Rollout</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Control</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((flag) => (
                  <tr key={flag.id} className="border-t border-slate-200">
                    <td className="px-4 py-4">
                      <p className="font-black text-slate-950">{flag.name}</p>
                      <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
                        {flag.description || "No description"}
                      </p>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                        {flag.flag_key}
                      </p>
                    </td>

                    <td className="px-4 py-4 font-bold text-slate-700">
                      {flag.category}
                    </td>

                    <td className="px-4 py-4 capitalize">{flag.scope}</td>

                    <td className="px-4 py-4 font-black text-slate-700">
                      {flag.rollout_percentage}%
                    </td>

                    <td className="px-4 py-4">
                      <PlatformStatusBadge
                        status={flag.is_enabled ? "active" : "disabled"}
                      />
                    </td>

                    <td className="px-4 py-4 text-right">
                      <Switch
                        checked={flag.is_enabled}
                        disabled={toggleFlag.isPending}
                        onCheckedChange={() => toggleFlag.mutate(flag)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}