import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { stockMovementsApi } from "@/lib/apiClient";
import { getCachedTable, isOnline, saveCachedTable } from "@/lib/offlineStore";

/**
 * The stock ledger.
 *
 * Read-only, and deliberately so. Movements are written by the code that
 * actually moves stock — inside the transaction that moved it — so there is no
 * mutation hook here. This file used to export `useLogStockMovement`, which
 * inserted straight into the table from the browser: a ledger anyone can post
 * to is not a ledger, and it had no callers left once sales and purchases
 * started recording their own movements atomically. Removed rather than left
 * lying around for someone to reach for.
 *
 * Note there were two hooks of this name — this one, which the dashboard and
 * the movements page import, and another inside useSupabaseData.ts. Only that
 * second one had been moved to the API, so the dashboard was still asking
 * Supabase and getting nothing. Both now read from the same endpoint.
 */

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

export function useStockMovements(limit = 1000) {
  const { user, tenantId } = useAuth();

  return useQuery({
    queryKey: ["stock_movements", tenantId, limit, isOnline() ? "online" : "cached"],
    enabled: !!user && !!tenantId,
    retry: 0,
    networkMode: "always",
    queryFn: async () => {
      const cached = await getCachedTable("stock_movements");

      if (!isOnline()) {
        return sortByCreatedAtDesc(cached).slice(0, limit) as StockMovement[];
      }

      try {
        const { data } = await stockMovementsApi.list({ limit });
        const fresh = sortByCreatedAtDesc(data as any[]);
        await saveCachedTable("stock_movements", fresh);
        return fresh.slice(0, limit) as StockMovement[];
      } catch (error) {
        /*
         * Falling back to the cache rather than throwing: the ledger is a
         * read, and a till that cannot reach the server should still show the
         * last movements it knows about instead of an error where the history
         * used to be.
         */
        if (cached.length > 0) {
          return sortByCreatedAtDesc(cached).slice(0, limit) as StockMovement[];
        }
        throw error;
      }
    },
  });
}
