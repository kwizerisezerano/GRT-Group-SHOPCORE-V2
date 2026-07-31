import {
  Archive,
  HardDrive,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DataPanel,
  EmptyState,
  MetricCard,
  PageShell,
  StatusPill,
  dateTime,
  usePlatformQuery,
} from "./PlatformOperationsSuite";

type AssetStatus = "active" | "archived" | "deleted";

export default function StorageCenter() {
  const storageQ = usePlatformQuery({
    key: "platform-storage-suite",
    query: async () => {
      const { data, error } = await (supabase as any)
        .from("platform_storage_assets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      return data ?? [];
    },
  });

  const updateAsset = useMutation({
    mutationFn: async ({
      assetId,
      status,
    }: {
      assetId: string;
      status: AssetStatus;
    }) => {
      const { error } = await (supabase as any).rpc(
        "update_platform_storage_asset_status",
        {
          p_asset_id: assetId,
          p_status: status,
        },
      );

      if (error) throw error;
    },
    onSuccess: async (_, variables) => {
      toast.success(`Storage asset marked as ${variables.status}.`);
      await storageQ.refetch();
    },
    onError: (error: any) =>
      toast.error(error?.message || "Storage asset update failed."),
  });

  const assets = storageQ.data ?? [];
  const totalMb = assets.reduce(
    (sum: number, item: any) => sum + Number(item.size_mb || 0),
    0,
  );

  return (
    <PageShell
      eyebrow="Operations"
      title="Storage Center"
      description="Track buckets, attachments, invoices, receipts, reports, backups, storage growth, and cleanup opportunities."
      icon={<HardDrive className="h-7 w-7" />}
      onRefresh={() => storageQ.refetch()}
    >
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Assets" value={assets.length} />

        <MetricCard
          label="Storage"
          value={`${(totalMb / 1024).toFixed(2)} GB`}
          tone="blue"
        />

        <MetricCard
          label="Backups"
          value={assets.filter((a: any) => a.asset_type === "backup").length}
          tone="violet"
        />

        <MetricCard
          label="Archived"
          value={assets.filter((a: any) => a.status === "archived").length}
          tone="orange"
        />
      </section>

      <DataPanel title="Storage Assets">
        {storageQ.isLoading ? (
          <EmptyState text="Loading storage assets..." />
        ) : !assets.length ? (
          <EmptyState text="No storage assets tracked yet." />
        ) : (
          <div className="space-y-3">
            {assets.map((asset: any) => (
              <div
                key={asset.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-slate-950">
                        {asset.file_name || asset.bucket_name}
                      </p>

                      <StatusPill status={asset.status} />
                      <StatusPill status={asset.asset_type} />
                    </div>

                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {asset.bucket_name} ·{" "}
                      {Number(asset.size_mb || 0).toFixed(2)} MB
                    </p>

                    <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                      Created {dateTime(asset.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    {asset.status !== "active" && (
                      <ActionButton
                        label="Restore"
                        icon={<RotateCcw className="h-4 w-4" />}
                        tone="emerald"
                        disabled={updateAsset.isPending}
                        onClick={() =>
                          updateAsset.mutate({
                            assetId: asset.id,
                            status: "active",
                          })
                        }
                      />
                    )}

                    {asset.status === "active" && (
                      <ActionButton
                        label="Archive"
                        icon={<Archive className="h-4 w-4" />}
                        tone="orange"
                        disabled={updateAsset.isPending}
                        onClick={() =>
                          updateAsset.mutate({
                            assetId: asset.id,
                            status: "archived",
                          })
                        }
                      />
                    )}

                    {asset.status !== "deleted" && (
                      <ActionButton
                        label="Mark Deleted"
                        icon={<Trash2 className="h-4 w-4" />}
                        tone="rose"
                        disabled={updateAsset.isPending}
                        onClick={() =>
                          updateAsset.mutate({
                            assetId: asset.id,
                            status: "deleted",
                          })
                        }
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DataPanel>
    </PageShell>
  );
}

function ActionButton({
  label,
  icon,
  tone,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  tone: "emerald" | "orange" | "rose";
  disabled?: boolean;
  onClick: () => void;
}) {
  const tones: Record<string, string> = {
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    orange:
      "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100",
    rose: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-60",
        tones[tone],
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}