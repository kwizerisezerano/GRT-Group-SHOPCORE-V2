import { useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  LockKeyhole,
  MapPin,
  RefreshCw,
  Settings,
  ShieldCheck,
  Wifi,
  WifiOff,
  LogOut,
  User
} from "lucide-react";

import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { AppFooter } from "@/components/AppFooter";
import { WorkspaceLocked } from "@/components/WorkspaceLocked";
import {
  isReachableWhileLocked,
  isWorkspaceLocked,
} from "@/lib/workspaceLock";
import { AppSidebar } from "@/components/AppSidebar";
import { CommandPalette } from "@/components/CommandPalette";
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


function CustomSidebarTrigger() {
  const { toggleSidebar, state } = useSidebar();
  const isCollapsed = state === "collapsed";
  return (
    /*
     * A surface of its own, rather than a bare glyph on the page background.
     * Sitting unstyled above the content it read as a stray chevron with no
     * indication it was a control at all — and on the light page it all but
     * disappeared.
     */
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      className="lift flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
    </button>
  );
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
    signOut,
  } = useAuth();

  const location = useLocation();

  /*
   * Anything outside the handful of screens that still work needs an open
   * subscription; the rest show the lock panel in place of the page. The list
   * lives in lib/workspaceLock.ts because the sidebar filters its menu by the
   * same one.
   */
  const workspaceLocked =
    Boolean(tenantId) &&
    isWorkspaceLocked(workspaceAccessStatus) &&
    !isReachableWhileLocked(location.pathname);

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
    <SidebarProvider className="flex h-screen w-full flex-col bg-background overflow-hidden" style={{ "--sidebar-width": "16rem", "--sidebar-width-mobile": "18rem" } as React.CSSProperties}>
      <header className="z-40 flex h-16 w-full shrink-0 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground shadow-md transition-colors duration-200 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex items-center gap-2">
            <img src="/shopcore-icon.png" alt="ShopCore" className="h-10 w-10 shrink-0 object-contain drop-shadow-md" />
            <div className="hidden sm:flex min-w-0 flex-col leading-tight">
              <span className="truncate text-xl font-extrabold tracking-tight text-white">
                {tenantName || "ShopCore"}
              </span>
              <span className="truncate text-[9px] font-semibold uppercase tracking-[0.16em] text-white/70">
                {tenantName ? "ShopCore Business OS" : "Business Operating System"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-white">
            <ThemeToggle />
            <LanguageSelector compact />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative flex items-center gap-2 h-auto px-2 py-1 rounded-full border border-white/20 hover:bg-background/10 ml-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={(user?.user_metadata as any)?.avatar_url || undefined} />
                    <AvatarFallback className="bg-background/20 text-white font-medium text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{profileLabel}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/settings")}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Workspace Settings</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void signOut()}>
                  <LogOut className="mr-2 h-4 w-4 text-red-500" />
                  <span className="text-red-500">Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 w-full relative">
        <AppSidebar />
        <main className="flex min-w-0 flex-1 flex-col overflow-auto bg-background">
          <div className="flex-1 p-4 sm:p-6">
            <div className="mb-4">
              <CustomSidebarTrigger />
            </div>

            {/*
              A closed workspace keeps the shell — header, menu, footer — and
              swaps the page for an explanation. Redirecting to a bare
              activation screen instead left people with no way to reach
              billing, support or their own settings.
            */}
            {workspaceLocked ? <WorkspaceLocked status={workspaceAccessStatus} /> : <Outlet />}
          </div>
          <AppFooter insideApp />
        </main>
      </div>

    </SidebarProvider>
  );
}
