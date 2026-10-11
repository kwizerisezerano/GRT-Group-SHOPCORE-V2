import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function rows<T = any>(result: any): T[] {
  if (result?.status === "fulfilled" && !result.value?.error) {
    return result.value?.data ?? [];
  }

  return [];
}

function record<T = any>(result: any): T | null {
  if (result?.status === "fulfilled" && !result.value?.error) {
    return result.value?.data ?? null;
  }

  return null;
}

export function useTenant360(tenantId: string | null, open: boolean) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["tenant-360", tenantId],
    enabled: open && !!tenantId,
    queryFn: async () => {
      await (supabase as any).rpc("expire_platform_impersonation_sessions");

      const results = await Promise.allSettled([
        (supabase as any)
          .from("tenants")
          .select("*")
          .eq("id", tenantId)
          .maybeSingle(),

        (supabase as any)
          .from("tenant_subscriptions")
          .select("*")
          .eq("tenant_id", tenantId)
          .maybeSingle(),

        (supabase as any)
          .from("subscription_invoices")
          .select("*, invoice_items(*)")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false }),

        (supabase as any)
          .from("payment_attempts")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("attempted_at", { ascending: false }),

        (supabase as any)
          .from("subscription_events")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(40),

        (supabase as any)
          .from("platform_support_tickets")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(20),

        (supabase as any)
          .from("tenant_members")
          .select("*")
          .eq("tenant_id", tenantId),

        (supabase as any)
          .from("branches")
          .select("*")
          .eq("tenant_id", tenantId),

        (supabase as any)
          .from("warehouses")
          .select("*")
          .eq("tenant_id", tenantId),

        (supabase as any)
          .from("products")
          .select("id, name, stock, quantity, selling_price, price, created_at")
          .eq("tenant_id", tenantId)
          .limit(1000),

        (supabase as any)
          .from("sales")
          .select("id, total, amount, created_at")
          .eq("tenant_id", tenantId)
          .limit(1000),

        (supabase as any)
          .from("platform_tenant_notes")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(20),

        (supabase as any)
          .from("platform_impersonation_sessions")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("started_at", { ascending: false })
          .limit(10),

        (supabase as any)
          .from("platform_impersonation_logs")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(30),

        (supabase as any)
          .from("platform_tenant_health_scores")
          .select("*")
          .eq("tenant_id", tenantId)
          .maybeSingle(),

        (supabase as any)
          .from("platform_tenant_enterprise_profile")
          .select("*")
          .eq("tenant_id", tenantId)
          .maybeSingle(),

        (supabase as any)
          .from("platform_tenant_module_entitlements")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("module_name", { ascending: true }),

        (supabase as any)
          .from("platform_tenant_devices")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("last_seen_at", { ascending: false }),

        (supabase as any)
          .from("platform_device_security_events")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(50),

        (supabase as any)
          .from("platform_tenant_api_keys")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false }),

        (supabase as any)
          .from("platform_tenant_webhooks")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false }),

        (supabase as any)
          .from("platform_tenant_license_allocations")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false }),

        (supabase as any)
          .from("platform_tenant_usage_snapshots")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("snapshot_date", { ascending: false })
          .limit(30),
      ]);

      return {
        tenant: record(results[0]),
        subscription: record(results[1]),
        invoices: rows(results[2]),
        payments: rows(results[3]),
        events: rows(results[4]),
        support: rows(results[5]),
        members: rows(results[6]),
        branches: rows(results[7]),
        warehouses: rows(results[8]),
        products: rows(results[9]),
        sales: rows(results[10]),
        notes: rows(results[11]),
        impersonationSessions: rows(results[12]),
        impersonationLogs: rows(results[13]),
        health: record(results[14]),
        enterprise: record(results[15]),
        moduleEntitlements: rows(results[16]),
        devices: rows(results[17]),
        deviceSecurityEvents: rows(results[18]),
        apiKeys: rows(results[19]),
        webhooks: rows(results[20]),
        licenses: rows(results[21]),
        usageSnapshots: rows(results[22]),
      };
    },
  });

  const invalidateTenant360 = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["tenant-360", tenantId] }),
      qc.invalidateQueries({ queryKey: ["platform-tenants"] }),
      qc.invalidateQueries({ queryKey: ["platform-subscription-engine"] }),
      qc.invalidateQueries({ queryKey: ["platform-engine-invoices"] }),
      qc.invalidateQueries({ queryKey: ["platform-payment-attempts"] }),
      qc.invalidateQueries({ queryKey: ["platform-notifications"] }),
      qc.invalidateQueries({ queryKey: ["platform-dashboard-live"] }),
      qc.invalidateQueries({ queryKey: ["platform-active-support-count"] }),
      qc.invalidateQueries({ queryKey: ["platform-active-support-sessions"] }),
    ]);
  };

  return {
    ...query,
    invalidateTenant360,
  };
}