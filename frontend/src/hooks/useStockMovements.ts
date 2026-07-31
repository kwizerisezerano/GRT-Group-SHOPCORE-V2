import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  getCachedTable,
  isNetworkError,
  isOnline,
  saveCachedTable,
  saveOfflineStockMovement,
} from "@/lib/offlineStore";
import { toast } from "sonner";

export interface StockMovement {
  id: string;
  user_id: string;
  tenant_id?: string;
  product_id: string | null;
  product_name: string;
  movement_type: string;
  quantity_change: number;
  stock_before: number;
  stock_after: number;
  reference: string;
  reference_id: string | null;
  notes: string | null;
  created_at: string;

  cost_price?: number | null;
  selling_price?: number | null;
  unit_cost?: number | null;
  unit_price?: number | null;
  total_cost?: number | null;
  total_value?: number | null;
  sync_status?: string;
  offline_id?: string;
}

function sortByCreatedAtDesc(records: any[]) {
  return [...(records || [])].sort((a, b) => {
    const aDate = new Date(a?.created_at || a?.created_offline_at || 0).getTime();
    const bDate = new Date(b?.created_at || b?.created_offline_at || 0).getTime();
    return bDate - aDate;
  });
}

function shouldSaveOffline(error: unknown) {
  return !isOnline() || isNetworkError(error);
}

function cleanMovementPayload(payload: any) {
  const clean = { ...payload };

  Object.keys(clean).forEach((key) => {
    if (clean[key] === undefined) delete clean[key];
  });

  return clean;
}

export function useStockMovements(limit = 1000) {
  const { user, tenantId } = useAuth();

  return useQuery({
    queryKey: ["stock_movements", tenantId, user?.id, limit],
    enabled: !!user && !!tenantId,
    retry: 1,
    queryFn: async () => {
      const cached = await getCachedTable("stock_movements");

      if (!isOnline()) {
        return sortByCreatedAtDesc(cached).slice(0, limit) as StockMovement[];
      }

      try {
        const { data, error } = await (supabase as any)
          .from("stock_movements")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) throw error;

        const onlineData = data || [];
        const pendingOffline = cached.filter(
          (item: any) => item.sync_status === "pending" || item.offline_id
        );

        const merged = sortByCreatedAtDesc([...pendingOffline, ...onlineData]);

        await saveCachedTable("stock_movements", merged);

        return merged.slice(0, limit) as StockMovement[];
      } catch (error) {
        if (cached.length > 0) {
          return sortByCreatedAtDesc(cached).slice(0, limit) as StockMovement[];
        }

        throw error;
      }
    },
  });
}

export function useLogStockMovement() {
  const qc = useQueryClient();
  const { user, tenantId } = useAuth();

  return useMutation({
    mutationFn: async (m: {
      product_id: string;
      product_name: string;
      movement_type: string;
      quantity_change: number;
      stock_before: number;
      stock_after: number;
      reference?: string;
      reference_id?: string | null;
      notes?: string | null;

      cost_price?: number | null;
      selling_price?: number | null;
      unit_cost?: number | null;
      unit_price?: number | null;
      total_cost?: number | null;
      total_value?: number | null;
    }) => {
      if (!user?.id) throw new Error("You must be signed in");
      if (!tenantId) throw new Error("No active workspace");

      const quantity = Number(m.quantity_change || 0);
      const costPrice = Number(m.cost_price ?? m.unit_cost ?? 0);
      const sellingPrice = Number(m.selling_price ?? m.unit_price ?? 0);

      const payload = cleanMovementPayload({
        product_id: m.product_id,
        product_name: m.product_name,
        movement_type: m.movement_type,
        quantity_change: quantity,
        stock_before: Number(m.stock_before || 0),
        stock_after: Number(m.stock_after || 0),
        reference: m.reference ?? "",
        reference_id: m.reference_id ?? null,
        notes: m.notes ?? null,
        user_id: user.id,
        tenant_id: tenantId,
        created_at: new Date().toISOString(),

        cost_price: costPrice || null,
        selling_price: sellingPrice || null,
        unit_cost: costPrice || null,
        unit_price: sellingPrice || null,
        total_cost: costPrice ? Math.abs(quantity) * costPrice : null,
        total_value: sellingPrice ? Math.abs(quantity) * sellingPrice : null,
      });

      if (!isOnline()) {
        return await saveOfflineStockMovement({
          ...payload,
          sync_status: "pending",
        });
      }

      try {
        const { data, error } = await (supabase as any)
          .from("stock_movements")
          .insert(payload)
          .select();

        if (error) throw error;

        const cached = await getCachedTable("stock_movements");
        await saveCachedTable("stock_movements", [...(data || []), ...cached]);

        return data;
      } catch (error) {
        if (shouldSaveOffline(error)) {
          return await saveOfflineStockMovement({
            ...payload,
            sync_status: "pending",
          });
        }

        throw error;
      }
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock_movements"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },

    onError: (e: Error) => {
      toast.error(e.message);
    },
  });
}