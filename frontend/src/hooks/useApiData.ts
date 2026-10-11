import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/apiClient";
import {
  getCachedTable,
  isOnline,
  markCachedRecordDeleted,
  patchCachedRecord,
  removeCachedRecord,
  saveCachedTable,
  savePending,
  upsertCachedRecord,
} from "@/lib/offlineStore";

export type ApiListResponse<T> = { data: T[] };
export type ApiRecordResponse<T> = { data: T };

/**
 * Shape every new backend-CRUD module's frontend `xApi` object should
 * implement (see lib/apiClient.ts's authApi/workspaceApi for the existing
 * per-module-object convention) so it can be dropped straight into
 * useApiTable/useApiMutations below.
 */
export type ApiCrudModule<T> = {
  list: () => Promise<ApiListResponse<T>>;
  create: (input: Partial<T>) => Promise<ApiRecordResponse<T>>;
  update: (id: string, input: Partial<T>) => Promise<ApiRecordResponse<T>>;
  remove: (id: string) => Promise<void>;
};

function makeLocalId(prefix: string) {
  try {
    return `${prefix}-${crypto.randomUUID()}`;
  } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function sortByCreatedAtDesc<T>(rows: T[]): T[] {
  return [...rows].sort((a: any, b: any) => {
    const aTime = new Date(a?.createdAt ?? a?.created_at ?? 0).getTime();
    const bTime = new Date(b?.createdAt ?? b?.created_at ?? 0).getTime();
    return bTime - aTime;
  });
}

/** A failed request that's worth queuing offline rather than surfacing as an error. */
function isRetryableOffline(error: unknown): boolean {
  if (!isOnline()) return true;
  return !(error instanceof ApiError) || error.status >= 500;
}

/**
 * Frontend half of the Phase 0 generic CRUD pattern (see
 * backend/src/lib/crudModuleFactory.ts). Same call shape as
 * useSupabaseData.ts's useGenericTable - so pages moving off Supabase swap
 * one hook call for another - but backed by a REST `ApiCrudModule` instead
 * of `supabase.from(table)`, and reusing the same offline cache
 * (lib/offlineStore.ts) so migrated pages keep working offline.
 *
 * `cacheKey` doubles as the offlineStore table name and the react-query
 * cache key; pick the same short name the backend module's route uses
 * (e.g. "brands", "warehouses").
 */
export function useApiTable<T = any>(cacheKey: string, api: Pick<ApiCrudModule<T>, "list">) {
  const { user, tenantId } = useAuth();

  return useQuery({
    queryKey: [cacheKey, tenantId, isOnline() ? "online" : "cached"],
    enabled: !!user && !!tenantId,
    staleTime: isOnline() ? 0 : 1000 * 60 * 5,
    retry: 0,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    networkMode: "always",
    queryFn: async () => {
      if (!isOnline()) return sortByCreatedAtDesc((await getCachedTable(cacheKey)) as T[]);

      try {
        const { data } = await api.list();
        await saveCachedTable(cacheKey, data as any[]);
        return sortByCreatedAtDesc(data);
      } catch (error) {
        const cached = (await getCachedTable(cacheKey)) as T[];
        if (cached.length > 0 || isRetryableOffline(error)) return sortByCreatedAtDesc(cached);
        throw error;
      }
    },
  });
}

/** Same shape as useSupabaseData.ts's useGenericMutations, backed by an ApiCrudModule. */
export function useApiMutations<T extends Record<string, any>>(
  cacheKey: string,
  api: Pick<ApiCrudModule<T>, "create" | "update" | "remove">,
  successName: string
) {
  const qc = useQueryClient();
  const { user, tenantId } = useAuth();

  function requireCtx() {
    if (!user || !tenantId) throw new Error("Not authenticated");
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: [cacheKey] });
  }

  function onError(error: unknown) {
    toast.error(error instanceof Error ? error.message : "Something went wrong");
  }

  const create = useMutation({
    mutationFn: async (record: Partial<T>) => {
      requireCtx();

      if (!isOnline()) {
        const offlineRecord = { ...record, id: (record as any).id || makeLocalId(cacheKey), sync_status: "pending" };
        await upsertCachedRecord(cacheKey, offlineRecord);
        return savePending(cacheKey, { ...offlineRecord, operation: "create" });
      }

      try {
        const { data } = await api.create(record);
        await upsertCachedRecord(cacheKey, data as any);
        return data;
      } catch (error) {
        if (!isRetryableOffline(error)) throw error;
        const offlineRecord = { ...record, id: (record as any).id || makeLocalId(cacheKey), sync_status: "pending" };
        await upsertCachedRecord(cacheKey, offlineRecord);
        return savePending(cacheKey, { ...offlineRecord, operation: "create" });
      }
    },
    onSuccess: (data: any) => {
      invalidate();
      toast.success(data?.sync_status === "pending" ? `${successName} saved offline` : `${successName} saved`);
    },
    onError,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...record }: Partial<T> & { id: string }) => {
      requireCtx();

      if (!isOnline() || String(id).startsWith(`${cacheKey}-`)) {
        const patched = await patchCachedRecord(cacheKey, id, { ...record, sync_status: "pending" });
        await savePending(cacheKey, { ...(patched as any), id, operation: "update" });
        return patched;
      }

      try {
        const { data } = await api.update(id, record as unknown as Partial<T>);
        await patchCachedRecord(cacheKey, id, data as any);
        return data;
      } catch (error) {
        if (!isRetryableOffline(error)) throw error;
        const patched = await patchCachedRecord(cacheKey, id, { ...record, sync_status: "pending" });
        await savePending(cacheKey, { ...(patched as any), id, operation: "update" });
        return patched;
      }
    },
    onSuccess: (data: any) => {
      invalidate();
      toast.success(data?.sync_status === "pending" ? `${successName} update saved offline` : `${successName} updated`);
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      requireCtx();

      if (!isOnline() || String(id).startsWith(`${cacheKey}-`)) {
        await markCachedRecordDeleted(cacheKey, id);
        await savePending(cacheKey, { id, operation: "delete" });
        return { id, sync_status: "pending" };
      }

      try {
        await api.remove(id);
        await removeCachedRecord(cacheKey, id);
        return { id, sync_status: "synced" };
      } catch (error) {
        if (!isRetryableOffline(error)) throw error;
        await markCachedRecordDeleted(cacheKey, id);
        await savePending(cacheKey, { id, operation: "delete" });
        return { id, sync_status: "pending" };
      }
    },
    onSuccess: (data: any) => {
      invalidate();
      toast.success(data?.sync_status === "pending" ? `${successName} removed locally` : `${successName} deleted`);
    },
    onError,
  });

  return { create, update, remove };
}
