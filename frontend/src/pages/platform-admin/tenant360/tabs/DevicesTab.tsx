import {
  AlertTriangle,
  Clock,
  Globe2,
  Laptop,
  Lock,
  MonitorSmartphone,
  ShieldCheck,
  Wifi,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PlatformStatusBadge } from "@/pages/platform-admin/components/PlatformStatusBadge";
import { formatDateTime } from "../tenant360Utils";
import {
  DataList,
  InfoItem,
  RowCard,
  Section,
} from "../components/Tenant360Primitives";

function riskTone(score: number) {
  if (score >= 75) return "text-rose-700 bg-rose-50 border-rose-200";
  if (score >= 45) return "text-orange-700 bg-orange-50 border-orange-200";
  return "text-emerald-700 bg-emerald-50 border-emerald-200";
}

export function DevicesTab({ data }: { data: any }) {
  const qc = useQueryClient();

  const enterprise = data?.enterprise ?? {};
  const devices = data?.devices ?? [];
  const tenantId = data?.tenant?.id;

  const deviceAction = useMutation({
    mutationFn: async ({
      deviceId,
      action,
    }: {
      deviceId: string;
      action: "trust" | "block" | "unblock" | "sign_out";
    }) => {
      const { error } = await (supabase as any).rpc(
        "update_platform_tenant_device_status",
        {
          p_device_id: deviceId,
          p_action: action,
        },
      );

      if (error) throw error;
    },
    onSuccess: async (_, variables) => {
      const labels: Record<string, string> = {
        trust: "Device trusted.",
        block: "Device blocked.",
        unblock: "Device unblocked.",
        sign_out: "Device signed out.",
      };

      toast.success(labels[variables.action] || "Device updated.");

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["tenant-360", tenantId] }),
        qc.invalidateQueries({ queryKey: ["platform-dashboard-live"] }),
      ]);
    },
    onError: (error: any) =>
      toast.error(error?.message || "Device action failed."),
  });

  const trustedDevices = devices.filter(
    (device: any) => device.trusted || device.status === "trusted",
  ).length;

  const blockedDevices = devices.filter(
    (device: any) => device.blocked || device.status === "blocked",
  ).length;

  const riskyDevices = devices.filter(
    (device: any) => Number(device.risk_score || 0) >= 45,
  ).length;

  const currentSessions = devices.filter(
    (device: any) => device.current_session,
  ).length;

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoItem
          icon={<MonitorSmartphone className="h-5 w-5" />}
          label="Active Devices"
          value={enterprise.active_devices ?? devices.length}
        />

        <InfoItem
          icon={<ShieldCheck className="h-5 w-5" />}
          label="Trusted Devices"
          value={trustedDevices}
        />

        <InfoItem
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Risk Review"
          value={riskyDevices}
        />

        <InfoItem
          icon={<Clock className="h-5 w-5" />}
          label="Current Sessions"
          value={currentSessions}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoItem
          icon={<Globe2 className="h-5 w-5" />}
          label="Browsers"
          value={
            devices.filter((device: any) => device.device_type === "browser")
              .length
          }
        />

        <InfoItem
          icon={<Laptop className="h-5 w-5" />}
          label="Desktop Clients"
          value={
            devices.filter((device: any) => device.device_type === "desktop")
              .length
          }
        />

        <InfoItem
          icon={<Lock className="h-5 w-5" />}
          label="Blocked Devices"
          value={blockedDevices}
        />

        <InfoItem
          icon={<Wifi className="h-5 w-5" />}
          label="Device Records"
          value={devices.length}
        />
      </section>

      <Section
        title="Device & Session Control"
        icon={<MonitorSmartphone className="h-5 w-5" />}
      >
        <DataList
          items={devices}
          empty="No connected devices recorded yet."
          render={(device: any) => {
            const riskScore = Number(device.risk_score || 0);
            const isBlocked = device.blocked || device.status === "blocked";
            const isTrusted = device.trusted || device.status === "trusted";

            return (
              <RowCard key={device.id}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-slate-950">
                      {device.device_name || device.device_type || "Device"}
                    </p>

                    <PlatformStatusBadge status={device.status || "active"} />

                    {device.current_session && (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                        Current Session
                      </span>
                    )}

                    {isTrusted && (
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-blue-700">
                        Trusted
                      </span>
                    )}

                    {isBlocked && (
                      <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-rose-700">
                        Blocked
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-xs font-bold text-slate-500">
                    {device.operating_system || "Unknown OS"} ·{" "}
                    {device.browser || "Unknown browser"} ·{" "}
                    {device.device_type || "browser"} ·{" "}
                    {device.ip_address || "No IP"}
                  </p>

                  <div className="mt-3 grid gap-2 text-xs font-bold text-slate-500 md:grid-cols-2 xl:grid-cols-4">
                    <DeviceMeta
                      label="Location"
                      value={device.location || device.country || "Unknown"}
                    />
                    <DeviceMeta label="ISP" value={device.isp || "Unknown"} />
                    <DeviceMeta
                      label="Network"
                      value={device.network_type || "Unknown"}
                    />
                    <DeviceMeta
                      label="Last Seen"
                      value={formatDateTime(device.last_seen_at)}
                    />
                  </div>

                  <div className="mt-3 grid gap-2 text-xs font-bold text-slate-500 md:grid-cols-2 xl:grid-cols-4">
                    <DeviceMeta
                      label="App Version"
                      value={
                        device.application_version ||
                        device.desktop_version ||
                        device.mobile_version ||
                        "Not reported"
                      }
                    />
                    <DeviceMeta
                      label="Session Started"
                      value={formatDateTime(device.session_started_at)}
                    />
                    <DeviceMeta
                      label="First Seen"
                      value={formatDateTime(device.first_seen_at)}
                    />
                    <DeviceMeta
                      label="Security Events"
                      value={device.security_events ?? 0}
                    />
                  </div>
                </div>

                <div className="flex min-w-[150px] flex-col items-end gap-2">
                  <span
                    className={[
                      "rounded-xl border px-3 py-2 text-sm font-black",
                      riskTone(riskScore),
                    ].join(" ")}
                  >
                    Risk {riskScore}/100
                  </span>

                  {!isTrusted && !isBlocked && (
                    <button
                      type="button"
                      disabled={deviceAction.isPending}
                      onClick={() =>
                        deviceAction.mutate({
                          deviceId: device.id,
                          action: "trust",
                        })
                      }
                      className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                    >
                      Trust
                    </button>
                  )}

                  {isBlocked ? (
                    <button
                      type="button"
                      disabled={deviceAction.isPending}
                      onClick={() =>
                        deviceAction.mutate({
                          deviceId: device.id,
                          action: "unblock",
                        })
                      }
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                    >
                      Unblock
                    </button>
                  ) : (
                    <>
                      {device.current_session && (
                        <button
                          type="button"
                          disabled={deviceAction.isPending}
                          onClick={() =>
                            deviceAction.mutate({
                              deviceId: device.id,
                              action: "sign_out",
                            })
                          }
                          className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-black text-orange-700 hover:bg-orange-100 disabled:opacity-60"
                        >
                          Sign Out
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={deviceAction.isPending}
                        onClick={() =>
                          deviceAction.mutate({
                            deviceId: device.id,
                            action: "block",
                          })
                        }
                        className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                      >
                        Block
                      </button>
                    </>
                  )}
                </div>
              </RowCard>
            );
          }}
        />
      </Section>

      <Section
        title="Device Security Timeline"
        icon={<AlertTriangle className="h-5 w-5" />}
      >
        <DataList
          items={data?.deviceSecurityEvents ?? []}
          empty="No security events recorded."
          render={(event: any) => (
            <RowCard key={event.id}>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black text-slate-950">
                    {event.event_type || "Device security event"}
                  </p>

                  <PlatformStatusBadge status={event.severity || "info"} />
                </div>

                <p className="mt-1 text-xs font-medium text-slate-500">
                  {event.description || "Security event recorded."}
                </p>

                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                  {formatDateTime(event.created_at)}
                  {event.ip_address ? ` · ${event.ip_address}` : ""}
                  {event.country ? ` · ${event.country}` : ""}
                  {event.city ? ` · ${event.city}` : ""}
                </p>
              </div>
            </RowCard>
          )}
        />
      </Section>
    </>
  );
}

function DeviceMeta({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-xs font-bold text-slate-700">{value}</p>
    </div>
  );
}