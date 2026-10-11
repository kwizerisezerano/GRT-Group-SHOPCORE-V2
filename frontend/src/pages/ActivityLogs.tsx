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
import {
  PageContainer,
  SectionCard,
  StatGrid,
} from "@/components/patterns";
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

const NAVY = "hsl(var(--primary))";

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
        <PageContainer>
          {(offlineModeActive || pendingProfile) && (
            <div className="rounded-3xl border border-orange-500/25 bg-orange-500/10 p-4 text-orange-700 dark:text-orange-300 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-background/75">
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
                <Badge className="w-fit rounded-full bg-background/75 text-orange-700 dark:text-orange-300 hover:bg-background/75">
                  {offlineModeActive ? <WifiOff className="mr-1 h-3 w-3" /> : <UploadCloud className="mr-1 h-3 w-3" />}
                  {offlineModeActive ? "Offline Mode" : "Sync Pending"}
                </Badge>
              </div>
            </div>
          )}

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <div className="relative min-h-[260px] overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-sm xl:col-span-7">

              <div className="relative flex items-start gap-4">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-sm">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <UserRound className="h-7 w-7" />
                  )}
                  <span className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-4 border-indigo-50 ${onlineReady ? "bg-emerald-500" : "bg-orange-500"}`} />
                </div>

                <div className="min-w-0">
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    Maintain personal identity, contact details, workspace role, access context, account readiness, and offline profile synchronization from one secure workspace.
                  </p>

                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3">
                      <p className="text-xs font-medium text-emerald-700">Display Name</p>
                      <p className="mt-1 truncate text-sm font-black text-foreground">
                        {displayName || "Unnamed user"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-border bg-muted/40 p-3">
                      <p className="text-xs font-medium text-foreground">Access Role</p>
                      <p className="mt-1 truncate text-sm font-black text-foreground">
                        {formatRole(role)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-border bg-muted/40 p-3">
                      <p className="text-xs font-medium text-foreground">Workspace</p>
                      <p className="mt-1 truncate text-sm font-black text-foreground">
                        {tenantQ.data?.name ?? "Workspace"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <StatGrid
              className="xl:col-span-5"
              columns={4}
              items={[
                {
                  label: "Email",
                  value: user?.email ?? "No email",
                  helper: "login identity",
                  icon: Mail,
                  tone: "indigo",
                },
                {
                  label: "Access Role",
                  value: formatRole(role),
                  helper: "permission scope",
                  icon: ShieldCheck,
                  tone: "emerald",
                },
                {
                  label: "Plan",
                  value: tenantQ.data?.plan ?? "free",
                  helper: "workspace plan",
                  icon: CreditCard,
                  tone: "violet",
                },
                {
                  label: "Mode",
                  value: onlineReady ? "Online" : "Offline",
                  helper: onlineReady ? "live session" : "cached session",
                  icon: onlineReady ? Wifi : WifiOff,
                  tone: onlineReady ? "cyan" : "amber",
                },
              ]}
            />
          </section>

          <StatGrid
            columns={3}
            items={[
              {
                label: "Authentication",
                value: onlineReady ? "Active" : "Cached",
                icon: Lock,
                tone: "indigo",
                helper: onlineReady ? "Supabase Auth session" : "Offline session cache",
              },
              {
                label: "Tenant Scope",
                value: tenantId ? "Connected" : "Missing",
                icon: BadgeCheck,
                tone: tenantId ? "emerald" : "rose",
                helper: "Workspace data access",
              },
              {
                label: "Profile Score",
                value: profileComplete ? "100%" : "60%",
                icon: CheckCircle2,
                tone: profileComplete ? "teal" : "amber",
                helper: profileComplete ? "Ready profile" : "Add contact details",
              },
            ]}
          />

          <StatGrid
            columns={4}
            items={[
              {
                label: "Security Readiness",
                value: user?.email ? "Verified" : "Review",
                icon: ShieldCheck,
                tone: user?.email ? "emerald" : "rose",
                helper: "Identity, role scope and workspace context",
              },
              {
                label: "Sync State",
                value: pendingProfile ? "Pending" : "Clean",
                icon: UploadCloud,
                tone: pendingProfile ? "amber" : "cyan",
                helper: "Offline profile edits queued for sync",
              },
              {
                label: "Workspace Plan",
                value: tenantQ.data?.plan ?? "free",
                icon: Building2,
                tone: "violet",
                helper: "Connected to the active workspace",
              },
              {
                label: "Brand Context",
                value: "Active",
                icon: Palette,
                tone: "sky",
                helper: "Workspace colour and tenant identity",
              },
            ]}
          />

          <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
            <SectionCard
              icon={UserRound}
              title="Personal Information"
              description="Update the profile details shown across the workspace."
              actions={
                <>
                  <Button className="rounded-2xl border-border bg-muted/40 text-foreground hover:bg-muted/40" variant="outline" onClick={refreshProfileData}>
                  <Database className="mr-2 h-4 w-4" />
                  Refresh
                  </Button>
                </>
              }
            >

              {profileQ.isLoading ? (
                <div className="flex items-center justify-center rounded-3xl border border-border bg-background/70 py-12 text-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Loading account profile...
                </div>
              ) : (
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="md:col-span-2 flex items-center gap-4 rounded-3xl border border-border bg-card p-4">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-primary text-primary-foreground">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                      ) : (
                        <UserRound className="h-9 w-9" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{displayName || "Unnamed user"}</p>
                      <p className="truncate text-sm text-foreground">{user?.email}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge
                          variant="outline"
                          className="rounded-full border-border bg-muted/40 uppercase text-foreground"
                        >
                          {role ?? "viewer"}
                        </Badge>
                        {pendingProfile && (
                          <Badge
                            variant="outline"
                            className="rounded-full border-orange-300 bg-orange-500/10 text-orange-700"
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
                      <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="displayName"
                        className="rounded-2xl border-border bg-card pl-10"
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
                        className="rounded-2xl border-emerald-500/25 bg-emerald-500/10 pl-10"
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
                        className="rounded-2xl border-orange-500/25 bg-card pl-10"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder="+250..."
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="avatar">Avatar URL</Label>
                    <div className="relative mt-1.5">
                      <Camera className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="avatar"
                        className="rounded-2xl border-border bg-card pl-10"
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
                      className="h-12 rounded-2xl border-orange-500/25 bg-orange-500/10 px-5 text-orange-700 hover:bg-orange-100"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reset
                    </Button>

                    <Button
                      onClick={saveProfile}
                      disabled={saving}
                      className="h-12 rounded-2xl bg-primary px-5 text-primary-foreground hover:bg-primary"
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
            </SectionCard>

            <div className="space-y-5">
              <SectionCard
                icon={Building2}
                tone="emerald"
                title="Workspace Context"
                description="Your active workspace."
              >

                <div className="space-y-3">
                  <div className="rounded-2xl border border-emerald-500/25 bg-background/75 p-4">
                    <p className="text-xs text-emerald-700">Name</p>
                    <p className="font-semibold">{tenantQ.data?.name ?? "-"}</p>
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="text-xs text-foreground">Slug</p>
                    <p className="text-sm font-semibold">{tenantQ.data?.slug ?? "-"}</p>
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="text-xs text-foreground">Plan</p>
                    <p className="font-semibold capitalize">{tenantQ.data?.plan ?? "free"}</p>
                  </div>

                  <div className="rounded-2xl border border-orange-500/25 bg-orange-500/10 p-4">
                    <p className="text-xs text-orange-700">Contact</p>
                    <p className="truncate text-sm">{tenantQ.data?.contact_email ?? "-"}</p>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                icon={Palette}
                title="Brand Preview"
                description="Workspace color identity."
              >

                <div
                  className="h-20 rounded-3xl shadow-inner"
                  style={{ background: tenantQ.data?.brand_color || NAVY }}
                />

                <div className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-background/75 p-3 text-xs text-foreground">
                  <Link className="h-3.5 w-3.5" />
                  {tenantQ.data?.brand_color || NAVY}
                </div>
              </SectionCard>
            </div>
          </section>
        </PageContainer>
      </PageShell>
    </PageBackground>
  );
}
