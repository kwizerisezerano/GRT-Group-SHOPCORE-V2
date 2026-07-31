import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard,
  Database,
  Globe,
  Mail,
  RefreshCw,
  Save,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PlatformPageHeader } from "@/pages/platform-admin/components/PlatformPageHeader";

type PlatformSettingsState = {
  platformName: string;
  supportEmail: string;
  billingEmail: string;
  trialDays: number;
  defaultCurrency: string;
  maintenanceMode: boolean;
  allowRegistration: boolean;
  requireEmailVerification: boolean;
  enableOfflineEngine: boolean;
  enableAuditLogs: boolean;
  enablePaymentGateway: boolean;
};

type PlatformSettingRow = {
  id: string;
  key: string;
  value: any;
  category: string;
};

const defaultSettings: PlatformSettingsState = {
  platformName: "ShopCore Cloud",
  supportEmail: "support@shopcore.app",
  billingEmail: "billing@shopcore.app",
  trialDays: 14,
  defaultCurrency: "RWF",
  maintenanceMode: false,
  allowRegistration: true,
  requireEmailVerification: true,
  enableOfflineEngine: true,
  enableAuditLogs: true,
  enablePaymentGateway: false,
};

export default function PlatformSettings() {
  const qc = useQueryClient();
  const [settings, setSettings] =
    useState<PlatformSettingsState>(defaultSettings);

  const settingsQ = useQuery({
    queryKey: ["platform-settings"],
    queryFn: async (): Promise<PlatformSettingRow[]> => {
      const { data, error } = await (supabase as any)
        .from("platform_settings")
        .select("id, key, value, category")
        .order("category", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const rows = settingsQ.data ?? [];
    if (!rows.length) return;

    const merged = { ...defaultSettings };

    rows.forEach((row) => {
      if (row.key in merged) {
        (merged as any)[row.key] = row.value?.value ?? row.value;
      }
    });

    setSettings(merged);
  }, [settingsQ.data]);

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const rows = Object.entries(settings).map(([key, value]) => ({
        key,
        value: { value },
        category:
          key.includes("Email")
            ? "communication"
            : key.includes("trial") || key.includes("Currency")
              ? "billing"
              : key.includes("Verification") || key.includes("Audit")
                ? "security"
                : key.includes("Engine") ||
                    key.includes("Gateway") ||
                    key.includes("maintenance")
                  ? "infrastructure"
                  : "general",
        description: `Platform setting: ${key}`,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await (supabase as any)
        .from("platform_settings")
        .upsert(rows, { onConflict: "key" });

      if (error) throw error;

      await (supabase as any).rpc("record_platform_event", {
        p_event_type: "platform_settings_updated",
        p_title: "Platform settings updated",
        p_description: "Global platform configuration was updated.",
        p_metadata: settings,
      });
    },
    onSuccess: () => {
      toast.success("Platform settings saved successfully.");
      qc.invalidateQueries({ queryKey: ["platform-settings"] });
      qc.invalidateQueries({ queryKey: ["platform-audit-logs"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to save platform settings.");
    },
  });

  const update = <K extends keyof PlatformSettingsState>(
    key: K,
    value: PlatformSettingsState[K],
  ) => {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const changedCount = useMemo(() => {
    return Object.keys(settings).filter(
      (key) =>
        (settings as any)[key] !== (defaultSettings as any)[key],
    ).length;
  }, [settings]);

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        eyebrow="Platform Configuration"
        title="Platform Settings"
        description="Configure global cloud settings, billing defaults, security policies, onboarding behavior and operational controls."
        actions={
          <Button
            className="rounded-xl bg-[#070b67] font-black hover:bg-[#050950]"
            onClick={() => saveSettingsMutation.mutate()}
            disabled={saveSettingsMutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            {saveSettingsMutation.isPending ? "Saving..." : "Save Settings"}
          </Button>
        }
      />

      {settingsQ.isLoading && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-700">
          Loading platform configuration...
        </div>
      )}

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Globe className="h-6 w-6 text-blue-700" />
          <h2 className="text-xl font-black">General Platform</h2>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div>
            <Label>Platform Name</Label>
            <Input
              value={settings.platformName}
              onChange={(e) => update("platformName", e.target.value)}
            />
          </div>

          <div>
            <Label>Default Currency</Label>
            <Input
              value={settings.defaultCurrency}
              onChange={(e) => update("defaultCurrency", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <CreditCard className="h-6 w-6 text-violet-700" />
          <h2 className="text-xl font-black">Commercial</h2>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div>
            <Label>Billing Email</Label>
            <Input
              value={settings.billingEmail}
              onChange={(e) => update("billingEmail", e.target.value)}
            />
          </div>

          <div>
            <Label>Default Trial Days</Label>
            <Input
              type="number"
              value={settings.trialDays}
              onChange={(e) =>
                update("trialDays", Number(e.target.value || 0))
              }
            />
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Mail className="h-6 w-6 text-emerald-700" />
          <h2 className="text-xl font-black">Support</h2>
        </div>

        <div className="mt-6">
          <Label>Support Email</Label>
          <Input
            value={settings.supportEmail}
            onChange={(e) => update("supportEmail", e.target.value)}
          />
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-orange-700" />
          <h2 className="text-xl font-black">Security Policies</h2>
        </div>

        <div className="mt-6 space-y-5">
          <SettingSwitch
            label="Allow Workspace Registration"
            checked={settings.allowRegistration}
            onChange={(value) => update("allowRegistration", value)}
          />

          <SettingSwitch
            label="Require Email Verification"
            checked={settings.requireEmailVerification}
            onChange={(value) => update("requireEmailVerification", value)}
          />

          <SettingSwitch
            label="Enable Audit Logs"
            checked={settings.enableAuditLogs}
            onChange={(value) => update("enableAuditLogs", value)}
          />
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Database className="h-6 w-6 text-cyan-700" />
          <h2 className="text-xl font-black">Infrastructure</h2>
        </div>

        <div className="mt-6 space-y-5">
          <SettingSwitch
            label="Offline Operating Engine"
            checked={settings.enableOfflineEngine}
            onChange={(value) => update("enableOfflineEngine", value)}
          />

          <SettingSwitch
            label="Payment Gateway"
            checked={settings.enablePaymentGateway}
            onChange={(value) => update("enablePaymentGateway", value)}
          />

          <SettingSwitch
            label="Maintenance Mode"
            checked={settings.maintenanceMode}
            onChange={(value) => update("maintenanceMode", value)}
          />
        </div>
      </section>

      <div className="flex justify-between gap-3">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-500">
          {changedCount} setting(s) differ from default configuration.
        </div>

        <Button
          variant="outline"
          className="rounded-xl font-black"
          onClick={() => {
            settingsQ.refetch();
            toast.info("Reloading platform configuration...");
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Reload Configuration
        </Button>
      </div>
    </div>
  );
}

function SettingSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
      <p className="font-bold text-slate-800">{label}</p>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}