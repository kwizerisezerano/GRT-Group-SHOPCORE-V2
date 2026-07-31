import { useEffect, useMemo, useState } from "react";
import {
  UserRound,
  Mail,
  Phone,
  Camera,
  Save,
  ShieldCheck,
  Lock,
  BadgeCheck,
  Building2,
  Palette,
  Loader2,
  CreditCard,
  Link,
  CheckCircle2,
  Wifi,
  WifiOff,
  UploadCloud,
  Database,
  RotateCcw,
} from "lucide-react";
import { decryptData, encryptData } from "@/lib/encryption";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageShell } from "@/components/PageShell";
import { PageBackground } from "@/components/PageBackground";
import warehouseBg from "@/assets/bg-warehouse.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  getCachedTable,
  isNetworkError,
  isOnline,
  saveCachedTable,
  savePending,
} from "@/lib/offlineStore";
import { isOfflineMode } from "@/lib/offlineAuth";

const NAVY = "#0b3d5c";

const PROFILE_CACHE_KEY = "account_profile";
const TENANT_CACHE_KEY = "account_tenant";

type ProfileRow = {
  id: string;
  display_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  tenant_id?: string | null;
  user_id?: string | null;
  operation?: "create" | "update" | "delete";
  sync_status?: "synced" | "pending" | "pending_update" | "pending_delete";
  created_at?: string;
  updated_at?: string;
  created_offline_at?: string;
  updated_offline_at?: string;
};

type TenantRow = {
  id: string;
  name: string | null;
  plan: string | null;
  slug: string | null;
  brand_color: string | null;
  logo_url: string | null;
  contact_email: string | null;
};

function makeCacheKey(name: string, id?: string | null) {
  return id ? `${name}_${id}` : name;
}

function isPendingSync(row: any) {
  const status = String(row?.sync_status || "").toLowerCase();
  return (
    String(row?.id || "").startsWith("offline-") ||
    !!row?.created_offline_at ||
    !!row?.updated_offline_at ||
    status.includes("pending")
  );
}

function normalizeProfileFromState(userId: string, displayName: string, phone: string, avatarUrl: string) {
  return {
    id: userId,
    display_name: displayName.trim() || null,
    phone: phone.trim() || null,
    avatar_url: avatarUrl.trim() || null,
  };
}

function formatRole(role?: string | null) {
  return String(role || "viewer").replace(/_/g, " ").toUpperCase();
}

export default function AccountSettings() {
  const { user, tenantId, role, refreshTenant, session } = useAuth();
  const qc = useQueryClient();

  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const onlineReady = isOnline() && !isOfflineMode() && !!session?.access_token;
  const offlineModeActive = !onlineReady;

  const profileCacheKey = useMemo(() => makeCacheKey(PROFILE_CACHE_KEY, user?.id), [user?.id]);
  const tenantCacheKey = useMemo(() => makeCacheKey(TENANT_CACHE_KEY, tenantId), [tenantId]);

  const profileQ = useQuery({
    queryKey: ["account-profile", user?.id, onlineReady ? "online" : "offline"],
    enabled: !!user?.id,
    retry: onlineReady ? 1 : 0,
    refetchOnWindowFocus: onlineReady,
    queryFn: async (): Promise<ProfileRow | null> => {
      if (!user?.id) return null;

      if (!onlineReady) {
        const cached = await getCachedTable(profileCacheKey);
        return Array.isArray(cached) ? (cached[0] as ProfileRow) || null : null;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, display_name, phone, avatar_url")
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          const decryptedData = {
            ...data,
            display_name: decryptData(data.display_name || '') || null,
            phone: decryptData(data.phone || '') || null,
          };
          await saveCachedTable(profileCacheKey, [{ ...decryptedData, sync_status: "synced" }]);
          return decryptedData as ProfileRow | null;
        }

        return null;
      } catch (error: any) {
        if (isNetworkError(error)) {
          const cached = await getCachedTable(profileCacheKey);
          return Array.isArray(cached) ? (cached[0] as ProfileRow) || null : null;
        }

        throw error;
      }
    },
  });

  const tenantQ = useQuery({
    queryKey: ["account-tenant", tenantId, onlineReady ? "online" : "offline"],
    enabled: !!tenantId,
    retry: onlineReady ? 1 : 0,
    refetchOnWindowFocus: onlineReady,
    queryFn: async (): Promise<TenantRow | null> => {
      if (!tenantId) return null;

      if (!onlineReady) {
        const cached = await getCachedTable(tenantCacheKey);
        return Array.isArray(cached) ? (cached[0] as TenantRow) || null : null;
      }

      try {
        const { data, error } = await supabase
          .from("tenants")
          .select("id, name, plan, slug, brand_color, logo_url, contact_email")
          .eq("id", tenantId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          await saveCachedTable(tenantCacheKey, [data]);
        }

        return data as TenantRow | null;
      } catch (error: any) {
        if (isNetworkError(error)) {
          const cached = await getCachedTable(tenantCacheKey);
          return Array.isArray(cached) ? (cached[0] as TenantRow) || null : null;
        }

        throw error;
      }
    },
  });

  useEffect(() => {
    if (profileQ.data) {
      setDisplayName(profileQ.data.display_name ?? "");
      setPhone(profileQ.data.phone ?? "");
      setAvatarUrl(profileQ.data.avatar_url ?? "");
    }
  }, [profileQ.data]);

  const pendingProfile = isPendingSync(profileQ.data);
  const profileComplete = Boolean(displayName.trim() && (phone.trim() || user?.email));

  const saveProfileOffline = async () => {
    if (!user?.id) return;

    const now = new Date().toISOString();
    const base = normalizeProfileFromState(user.id, displayName, phone, avatarUrl);

    const offlineProfile = {
      ...base,
      tenant_id: tenantId || null,
      user_id: user.id,
      operation: profileQ.data?.id ? "update" : "create",
      sync_status: profileQ.data?.id ? "pending_update" : "pending",
      created_at: profileQ.data?.created_at || now,
      updated_at: now,
      updated_offline_at: now,
    } as ProfileRow;

    await saveCachedTable(profileCacheKey, [offlineProfile]);
    await saveCachedTable(PROFILE_CACHE_KEY, [offlineProfile]);
    await savePending("profiles", offlineProfile as any);

    qc.invalidateQueries({ queryKey: ["account-profile", user.id] });
    qc.invalidateQueries({ queryKey: ["profiles"] });

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("shopcore-local-data-changed"));
    }

    toast.success("Profile saved offline. It will sync when internet returns.");
  };

  const saveProfile = async () => {
    if (!user?.id) return;

    setSaving(true);

    try {
      const encryptedDisplayName = encryptData(displayName.trim() || '');
      const encryptedPhone = encryptData(phone.trim() || '');

      if (!onlineReady) {
        await saveProfileOffline();
        return;
      }

      const { error } = await (supabase as any).rpc(
        "validate_and_update_profile",
        {
          p_user_id: user.id,
          p_display_name: encryptedDisplayName,
          p_phone: encryptedPhone,
          p_avatar_url: avatarUrl.trim() || null,
        }
      );

      if (error) throw error;

      const dbPayload = {
        id: user.id,
        display_name: encryptedDisplayName,
        phone: encryptedPhone,
        avatar_url: avatarUrl.trim() || null,
      };

      await saveCachedTable(profileCacheKey, [
        {
          ...dbPayload,
          sync_status: "synced",
          updated_at: new Date().toISOString(),
        },
      ]);

      toast.success("Account profile updated");
      qc.invalidateQueries({ queryKey: ["account-profile", user.id] });
      qc.invalidateQueries({ queryKey: ["profiles"] });
      refreshTenant?.();
    } catch (error: any) {
      if (isNetworkError(error) || !isOnline()) {
        await saveProfileOffline();
        return;
      }

      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const resetLocalChanges = async () => {
    const row = profileQ.data;
    setDisplayName(row?.display_name ?? "");
    setPhone(row?.phone ?? "");
    setAvatarUrl(row?.avatar_url ?? "");
    toast.info("Profile form reset to the last cached values.");
  };

  const refreshProfileData = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["account-profile", user?.id] }),
      qc.invalidateQueries({ queryKey: ["account-tenant", tenantId] }),
    ]).catch(() => undefined);

    toast.info(onlineReady ? "Refreshing profile data..." : "Showing cached profile data.");
  };

  return (
    <PageBackground image={warehouseBg} opacity={0.04}>
      <PageShell
        title="Profile Settings"
        description="Manage personal identity, workspace access, account security, offline profile sync, and workspace context."
      >
        <div className="space-y-5">
          {(offlineModeActive || pendingProfile) && (
            <div className="rounded-3xl border border-orange-200 bg-orange-50 p-4 text-orange-800 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/75">
                    {offlineModeActive ? <WifiOff className="h-5 w-5" /> : <UploadCloud className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-bold">
                      {offlineModeActive ? "Profile is using offline cache" : "Profile changes waiting to sync"}
                    </p>
                    <p className="text-sm opacity-90">
                      Profile updates can be saved locally and synchronized when the workstation reconnects.
                    </p>
                  </div>
                </div>
                <Badge className="w-fit rounded-full bg-white/75 text-orange-800 hover:bg-white/75">
                  {offlineModeActive ? <WifiOff className="mr-1 h-3 w-3" /> : <UploadCloud className="mr-1 h-3 w-3" />}
                  {offlineModeActive ? "Offline Mode" : "Sync Pending"}
                </Badge>
              </div>
            </div>
          )}

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <div className="relative min-h-[260px] overflow-hidden rounded-[2rem] border border-blue-200 bg-blue-50 p-5 shadow-sm xl:col-span-7">
              <div className="pointer-events-none absolute -right-14 -top-16 h-40 w-40 rounded-full bg-blue-200/70" />
              <div className="pointer-events-none absolute -bottom-20 right-24 h-36 w-36 rounded-full bg-cyan-100" />

              <div className="relative flex items-start gap-4">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-blue-600 text-white shadow-sm">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <UserRound className="h-7 w-7" />
                  )}
                  <span className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-4 border-blue-50 ${onlineReady ? "bg-emerald-500" : "bg-orange-500"}`} />
                </div>

                <div className="min-w-0">
                  <Badge className="mb-3 rounded-full bg-blue-600 px-4 py-1 text-white hover:bg-blue-600">
                    <BadgeCheck className="mr-1 h-3.5 w-3.5" />
                    Account Operations Center
                  </Badge>

                  <h1 className="text-3xl font-black tracking-tight text-slate-950">
                    Profile Settings Control Center
                  </h1>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    Maintain personal identity, contact details, workspace role, access context, account readiness, and offline profile synchronization from one secure workspace.
                  </p>

                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                      <p className="text-xs font-medium text-emerald-700">Display Name</p>
                      <p className="mt-1 truncate text-sm font-black text-slate-950">
                        {displayName || "Unnamed user"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3">
                      <p className="text-xs font-medium text-violet-700">Access Role</p>
                      <p className="mt-1 truncate text-sm font-black text-slate-950">
                        {formatRole(role)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-3">
                      <p className="text-xs font-medium text-cyan-700">Workspace</p>
                      <p className="mt-1 truncate text-sm font-black text-slate-950">
                        {tenantQ.data?.name ?? "Workspace"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 xl:col-span-5">
              {[
                {
                  label: "Email",
                  value: user?.email ?? "No email",
                  helper: "login identity",
                  icon: Mail,
                  card: "bg-blue-600",
                },
                {
                  label: "Access Role",
                  value: formatRole(role),
                  helper: "permission scope",
                  icon: ShieldCheck,
                  card: "bg-emerald-600",
                },
                {
                  label: "Plan",
                  value: tenantQ.data?.plan ?? "free",
                  helper: "workspace plan",
                  icon: CreditCard,
                  card: "bg-orange-600",
                },
                {
                  label: "Mode",
                  value: onlineReady ? "Online" : "Offline",
                  helper: onlineReady ? "live session" : "cached session",
                  icon: onlineReady ? Wifi : WifiOff,
                  card: "bg-violet-600",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className={`relative h-[150px] overflow-hidden rounded-3xl p-5 text-white shadow-sm ${item.card}`}>
                    <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/15" />
                    <div className="pointer-events-none absolute right-5 top-8 h-3 w-3 rounded-full bg-white/35" />
                    <div className="relative flex h-full flex-col justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/18">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white/90">{item.label}</p>
                        <p className="mt-1 truncate text-2xl font-black font-data capitalize">{item.value}</p>
                        <p className="mt-2 w-fit rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-semibold text-white">
                          {item.helper}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[2rem] border border-blue-200 bg-blue-50 p-5 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
                <Lock className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-blue-700">Authentication</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{onlineReady ? "Active" : "Cached"}</p>
              <p className="mt-3 rounded-full border border-blue-200 bg-white/75 px-3 py-1 text-xs text-blue-700">
                {onlineReady ? "Supabase Auth session" : "Offline session cache"}
              </p>
            </div>

            <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                <BadgeCheck className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-emerald-700">Tenant Scope</p>
              <p className="mt-1 text-2xl font-black text-slate-950">
                {tenantId ? "Connected" : "Missing"}
              </p>
              <p className="mt-3 rounded-full border border-emerald-200 bg-white/75 px-3 py-1 text-xs text-emerald-700">
                Workspace data access
              </p>
            </div>

            <div className="rounded-[2rem] border border-orange-200 bg-orange-50 p-5 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-600 text-white">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-orange-700">Profile Score</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{profileComplete ? "100%" : "60%"}</p>
              <p className="mt-3 rounded-full border border-orange-200 bg-white/75 px-3 py-1 text-xs text-orange-700">
                {profileComplete ? "Ready profile" : "Add contact details"}
              </p>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-4">
            <div className="rounded-[2rem] border border-rose-200 bg-rose-50 p-5 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-600 text-white">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-rose-700">Security Readiness</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{user?.email ? "Verified" : "Review"}</p>
              <p className="mt-3 text-xs leading-5 text-rose-700">Email identity, role scope, and workspace context are checked before profile actions.</p>
            </div>

            <div className="rounded-[2rem] border border-cyan-200 bg-cyan-50 p-5 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-600 text-white">
                <UploadCloud className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-cyan-700">Sync State</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{pendingProfile ? "Pending" : "Clean"}</p>
              <p className="mt-3 text-xs leading-5 text-cyan-700">Offline profile edits are queued for later synchronization.</p>
            </div>

            <div className="rounded-[2rem] border border-violet-200 bg-violet-50 p-5 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-white">
                <Building2 className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-violet-700">Workspace Plan</p>
              <p className="mt-1 text-2xl font-black capitalize text-slate-950">{tenantQ.data?.plan ?? "free"}</p>
              <p className="mt-3 text-xs leading-5 text-violet-700">Your profile is connected to the active business workspace.</p>
            </div>

            <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                <Palette className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-emerald-700">Brand Context</p>
              <p className="mt-1 text-2xl font-black text-slate-950">Active</p>
              <p className="mt-3 text-xs leading-5 text-emerald-700">Workspace color and tenant identity are available for branded screens.</p>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="rounded-[2rem] border border-blue-200 bg-blue-50 p-5 shadow-sm">
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
                    <UserRound className="h-5 w-5" />
                  </div>

                  <div>
                    <h3 className="font-black text-slate-950">Personal Information</h3>
                    <p className="text-xs text-blue-700">
                      Update the profile details shown across the workspace.
                    </p>
                  </div>
                </div>

                <Button className="rounded-2xl border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100" variant="outline" onClick={refreshProfileData}>
                  <Database className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>

              {profileQ.isLoading ? (
                <div className="flex items-center justify-center rounded-3xl border border-blue-200 bg-white/70 py-12 text-blue-700">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Loading account profile...
                </div>
              ) : (
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="md:col-span-2 flex items-center gap-4 rounded-3xl border border-cyan-200 bg-cyan-50 p-4">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-blue-600 text-white">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                      ) : (
                        <UserRound className="h-9 w-9" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-950">{displayName || "Unnamed user"}</p>
                      <p className="truncate text-sm text-cyan-700">{user?.email}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge
                          variant="outline"
                          className="rounded-full border-blue-300 bg-blue-50 uppercase text-blue-700"
                        >
                          {role ?? "viewer"}
                        </Badge>
                        {pendingProfile && (
                          <Badge
                            variant="outline"
                            className="rounded-full border-orange-300 bg-orange-50 text-orange-700"
                          >
                            <UploadCloud className="mr-1 h-3 w-3" />
                            Pending Sync
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="displayName">Display Name</Label>
                    <div className="relative mt-1.5">
                      <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-600" />
                      <Input
                        id="displayName"
                        className="rounded-2xl border-blue-200 bg-white pl-10"
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                        placeholder="Your full name"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative mt-1.5">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
                      <Input
                        id="email"
                        className="rounded-2xl border-emerald-200 bg-emerald-50 pl-10"
                        value={user?.email ?? ""}
                        disabled
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <div className="relative mt-1.5">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-600" />
                      <Input
                        id="phone"
                        className="rounded-2xl border-orange-200 bg-white pl-10"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder="+250..."
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="avatar">Avatar URL</Label>
                    <div className="relative mt-1.5">
                      <Camera className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-600" />
                      <Input
                        id="avatar"
                        className="rounded-2xl border-violet-200 bg-white pl-10"
                        value={avatarUrl}
                        onChange={(event) => setAvatarUrl(event.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button
                      variant="outline"
                      onClick={resetLocalChanges}
                      className="h-12 rounded-2xl border-orange-200 bg-orange-50 px-5 text-orange-700 hover:bg-orange-100"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reset
                    </Button>

                    <Button
                      onClick={saveProfile}
                      disabled={saving}
                      className="h-12 rounded-2xl bg-blue-600 px-5 text-white hover:bg-blue-700"
                    >
                      {saving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      {offlineModeActive ? "Save Offline" : "Save Profile"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-5">
              <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                    <Building2 className="h-5 w-5" />
                  </div>

                  <div>
                    <h3 className="font-black text-slate-950">Workspace Context</h3>
                    <p className="text-xs text-emerald-700">Your active workspace.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl border border-emerald-200 bg-white/75 p-4">
                    <p className="text-xs text-emerald-700">Name</p>
                    <p className="font-semibold">{tenantQ.data?.name ?? "-"}</p>
                  </div>

                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
                    <p className="text-xs text-cyan-700">Slug</p>
                    <p className="text-sm font-semibold">{tenantQ.data?.slug ?? "-"}</p>
                  </div>

                  <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                    <p className="text-xs text-violet-700">Plan</p>
                    <p className="font-semibold capitalize">{tenantQ.data?.plan ?? "free"}</p>
                  </div>

                  <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                    <p className="text-xs text-orange-700">Contact</p>
                    <p className="truncate text-sm">{tenantQ.data?.contact_email ?? "-"}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-violet-200 bg-violet-50 p-5 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-white">
                    <Palette className="h-5 w-5" />
                  </div>

                  <div>
                    <h3 className="font-black text-slate-950">Brand Preview</h3>
                    <p className="text-xs text-violet-700">Workspace color identity.</p>
                  </div>
                </div>

                <div
                  className="h-20 rounded-3xl shadow-inner"
                  style={{ background: tenantQ.data?.brand_color || NAVY }}
                />

                <div className="mt-3 flex items-center gap-2 rounded-2xl border border-violet-200 bg-white/75 p-3 text-xs text-violet-700">
                  <Link className="h-3.5 w-3.5" />
                  {tenantQ.data?.brand_color || NAVY}
                </div>
              </div>
            </div>
          </section>
        </div>
      </PageShell>
    </PageBackground>
  );
}
