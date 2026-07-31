import { useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import {
  Bell,
  Building2,
  ChevronDown,
  CircleAlert,
  LockKeyhole,
  MapPin,
  RefreshCw,
  Settings,
  ShieldCheck,
  Wifi,
  WifiOff,
} from "lucide-react";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

import { AppSidebar } from "@/components/AppSidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { AIAssistant } from "@/components/AIAssistant";
import { LanguageSelector } from "@/components/settings/LanguageSelector";
import { ThemeToggle } from "@/components/settings/ThemeToggle";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { isOnline } from "@/lib/offlineStore";
import { isOfflineMode } from "@/lib/offlineAuth";

function formatPlanName(value: string | null | undefined) {
  if (!value) {
    return "No plan assigned";
  }

  return value
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatWorkspaceStatus(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  return value
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function AppLayout() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const {
    user,
    tenantId,
    tenantName,
    subscriptionPlan,
    workspaceAccessStatus,
    entitlementLoading,
    getModuleAccess,
    refreshEntitlements,
  } = useAuth();

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const [refreshingAccess, setRefreshingAccess] = useState(false);
  const [onlineState, setOnlineState] = useState(
    isOnline() && !isOfflineMode(),
  );

  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const branchRef = useRef<HTMLDivElement | null>(null);

  const branchAccess = useMemo(
    () => getModuleAccess("warehouses"),
    [getModuleAccess],
  );

  const intelligenceAccess = useMemo(
    () => getModuleAccess("ai_operations"),
    [getModuleAccess],
  );

  const profileLabel =
    user?.user_metadata?.display_name ||
    user?.email ||
    tenantName ||
    "Workspace User";

  const initials = profileLabel
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  useEffect(() => {
    const updateConnectionState = () => {
      setOnlineState(isOnline() && !isOfflineMode());
    };

    window.addEventListener("online", updateConnectionState);
    window.addEventListener("offline", updateConnectionState);
    window.addEventListener("shopcore-online-login", updateConnectionState);
    window.addEventListener("shopcore-offline-login", updateConnectionState);

    return () => {
      window.removeEventListener("online", updateConnectionState);
      window.removeEventListener("offline", updateConnectionState);
      window.removeEventListener(
        "shopcore-online-login",
        updateConnectionState,
      );
      window.removeEventListener(
        "shopcore-offline-login",
        updateConnectionState,
      );
    };
  }, []);

  useEffect(() => {
    const closeMenus = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(target)
      ) {
        setNotificationsOpen(false);
      }

      if (branchRef.current && !branchRef.current.contains(target)) {
        setBranchOpen(false);
      }
    };

    document.addEventListener("mousedown", closeMenus);

    return () => {
      document.removeEventListener("mousedown", closeMenus);
    };
  }, []);

  const handleRefreshAccess = async () => {
    if (refreshingAccess || isOfflineMode()) {
      return;
    }

    setRefreshingAccess(true);

    try {
      await refreshEntitlements();
    } finally {
      setRefreshingAccess(false);
    }
  };

  const openBranches = () => {
    setBranchOpen(false);
    navigate("/branches");
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card px-4 shadow-sm sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger className="shrink-0" />

              <div className="hidden h-7 w-px bg-border sm:block" />

              <CommandPalette />
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div
                className={[
                  "hidden items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-black md:flex",
                  onlineState
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
                ].join(" ")}
              >
                {onlineState ? (
                  <Wifi className="h-3.5 w-3.5" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5" />
                )}

                {onlineState ? t("layout.cloudConnected") : t("layout.offlineContinuity")}
              </div>

              <button
                type="button"
                onClick={() => navigate("/billing")}
                className="hidden rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-left transition hover:bg-violet-500/20 lg:block"
              >
                <p className="text-[9px] font-black uppercase tracking-[0.13em] text-violet-600 dark:text-violet-300">
                  Current edition
                </p>

                <p className="mt-0.5 text-xs font-black text-violet-800 dark:text-violet-200">
                  {formatPlanName(subscriptionPlan)}
                </p>
              </button>

              <div className="flex items-center gap-2">
                <LanguageSelector compact />
                <ThemeToggle />
              </div>

              <div ref={notificationsRef} className="relative">
                <button
                  type="button"
                  aria-label={t("layout.openNotifications")}
                  aria-expanded={notificationsOpen}
                  onClick={() => {
                    setNotificationsOpen((current) => !current);
                    setBranchOpen(false);
                  }}
                  className="relative rounded-xl border border-transparent p-2.5 text-muted-foreground transition hover:border-border hover:bg-background hover:text-foreground"
                >
                  <Bell className="h-4 w-4" />

                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-card bg-rose-500/100" />
                </button>

                {notificationsOpen ? (
                  <div className="absolute right-0 z-50 mt-3 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_70px_-35px_rgba(15,23,42,0.55)]">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                      <div>
                        <p className="text-sm font-black text-foreground">
                          Operations notifications
                        </p>

                        <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                          Workspace alerts requiring review
                        </p>
                      </div>

                      <span className="rounded-full bg-rose-500/10 px-2 py-1 text-[10px] font-black text-rose-700 dark:text-rose-300">
                        2 new
                      </span>
                    </div>

                    <div className="space-y-2 p-3">
                      <button
                        type="button"
                        onClick={() => {
                          setNotificationsOpen(false);
                          navigate("/inventory");
                        }}
                        className="w-full rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-left transition hover:bg-orange-500/15"
                      >
                        <div className="flex gap-3">
                          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-orange-700" />

                          <div>
                            <p className="text-sm font-black text-orange-950 dark:text-orange-100">
                              Inventory attention
                            </p>

                            <p className="mt-1 text-xs font-medium leading-5 text-orange-800 dark:text-orange-200">
                              {t("layout.inventoryAttentionDescription")}
                            </p>
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setNotificationsOpen(false);
                          navigate("/notifications");
                        }}
                        className="w-full rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-left transition hover:bg-cyan-500/15"
                      >
                        <div className="flex gap-3">
                          <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" />

                          <div>
                            <p className="text-sm font-black text-cyan-950 dark:text-cyan-100">
                              Synchronization review
                            </p>

                            <p className="mt-1 text-xs font-medium leading-5 text-cyan-800 dark:text-cyan-200">
                              {t("layout.syncReviewDescription")}
                            </p>
                          </div>
                        </div>
                      </button>
                    </div>

                    <div className="border-t border-border bg-background p-3">
                      <Button
                        variant="outline"
                        className="h-10 w-full rounded-xl bg-card font-black"
                        onClick={() => {
                          setNotificationsOpen(false);
                          navigate("/notifications");
                        }}
                      >
                        View notification center
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div ref={branchRef} className="relative">
                <button
                  type="button"
                  aria-label={t("layout.openWorkspaceMenu")}
                  aria-expanded={branchOpen}
                  onClick={() => {
                    setBranchOpen((current) => !current);
                    setNotificationsOpen(false);
                  }}
                  className="flex items-center gap-2 rounded-xl border-l border-border py-1 pl-3 pr-2 transition hover:bg-background"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary">
                    <span className="text-[10px] font-black text-white">
                      {initials || "SC"}
                    </span>
                  </div>

                  <div className="hidden min-w-0 text-left sm:block">
                    <p className="max-w-36 truncate text-xs font-black text-foreground">
                      {tenantName || t("layout.businessWorkspace")}
                    </p>

                    <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
                      {formatWorkspaceStatus(workspaceAccessStatus)}
                    </p>
                  </div>

                  <ChevronDown
                    className={[
                      "hidden h-3.5 w-3.5 text-muted-foreground transition-transform sm:block",
                      branchOpen ? "rotate-180" : "",
                    ].join(" ")}
                  />
                </button>

                {branchOpen ? (
                  <div className="absolute right-0 z-50 mt-3 w-[min(21rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_70px_-35px_rgba(15,23,42,0.55)]">
                    <div className="border-b border-border px-4 py-4">
                      <p className="text-sm font-black text-foreground">
                        Workspace control
                      </p>

                      <p className="mt-1 text-xs font-medium text-muted-foreground">
                        Manage locations and operating preferences
                      </p>
                    </div>

                    <div className="space-y-2 p-3">
                      <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-card text-blue-700 dark:text-blue-300">
                            <MapPin className="h-4 w-4" />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-blue-950 dark:text-blue-100">
                              {tenantName || t("layout.primaryWorkspace")}
                            </p>

                            <p className="mt-1 text-xs font-medium text-blue-700 dark:text-blue-300">
                              Current operating context
                            </p>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={openBranches}
                        className="flex w-full items-center justify-between rounded-xl p-3 text-left transition hover:bg-background"
                      >
                        <div className="flex items-center gap-3">
                          <Building2 className="h-4 w-4 text-muted-foreground" />

                          <div>
                            <p className="text-sm font-bold text-foreground">
                              Manage branches
                            </p>

                            <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                              Locations and operating units
                            </p>
                          </div>
                        </div>

                        {!branchAccess.allowed ? (
                          <LockKeyhole className="h-4 w-4 text-orange-600" />
                        ) : null}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setBranchOpen(false);
                          navigate("/settings");
                        }}
                        className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-background"
                      >
                        <Settings className="h-4 w-4 text-muted-foreground" />

                        <div>
                          <p className="text-sm font-bold text-foreground">
                            Workspace settings
                          </p>

                          <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                            Business profile and configuration
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        disabled={
                          entitlementLoading ||
                          refreshingAccess ||
                          isOfflineMode()
                        }
                        onClick={() => void handleRefreshAccess()}
                        className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <RefreshCw
                          className={[
                            "h-4 w-4 text-muted-foreground",
                            refreshingAccess ? "animate-spin" : "",
                          ].join(" ")}
                        />

                        <div>
                          <p className="text-sm font-bold text-foreground">
                            Refresh subscription access
                          </p>

                          <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                            Reload features and resource limits
                          </p>
                        </div>
                      </button>
                    </div>

                    <div className="border-t border-border bg-background px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-emerald-600" />

                          <span className="text-[11px] font-black text-muted-foreground">
                            Tenant-isolated workspace
                          </span>
                        </div>

                        <span className="text-[10px] font-bold text-muted-foreground">
                          {tenantId?.slice(0, 8) || t("status.pending")}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 overflow-auto p-4 sm:p-6">
            <Outlet />
          </main>
        </div>

        {intelligenceAccess.allowed ? <AIAssistant /> : null}
      </div>
    </SidebarProvider>
  );
}
