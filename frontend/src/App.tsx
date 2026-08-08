import {
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  onlineManager,
} from "@tanstack/react-query";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { toast } from "sonner";

import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LegacyUiTranslationBridge } from "@/components/LegacyUiTranslationBridge";

import {
  AuthProvider,
  useAuth,
} from "@/contexts/AuthContext";
import {
  LanguageProvider,
  useLanguage,
} from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PlatformAdminRoute } from "@/components/PlatformAdminRoute";
import { RoleGate } from "@/components/RoleGate";
import PlanGuard from "@/components/PlanGuard";
import { AppLayout } from "@/components/AppLayout";

import {
  syncOfflineData,
  hasPendingOfflineData,
} from "@/lib/syncOfflineData";
import { isOnline } from "@/lib/offlineStore";
import { isOfflineMode } from "@/lib/offlineAuth";
import { authApi } from "@/lib/apiClient";
import {
  onConnectivityChange,
  startConnectivityMonitor,
} from "@/lib/connectivity";

import OperatingSystemLanding from "./pages/OperatingSystemLanding";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import AcceptInvite from "./pages/AcceptInvite";
import WorkspaceChat from "./pages/WorkspaceChat";

import HeroPage from "./pages/landing/HeroPage";
import CommandCenterPage from "./pages/landing/CommandCenterPage";
import ModuleExplorerPage from "./pages/landing/ModuleExplorerPage";
import WorkspaceEcosystemPage from "./pages/landing/WorkspaceEcosystemPage";
import BranchIntelligencePage from "./pages/landing/BranchIntelligencePage";
import ExecutiveIntelligencePage from "./pages/landing/ExecutiveIntelligencePage";
import OfflineEnginePage from "./pages/landing/OfflineEnginePage";
import EBMIntegrationPage from "./pages/landing/EBMIntegrationPage";
import SecurityCenterPage from "./pages/landing/SecurityCenterPage";
import EnterpriseProofPage from "./pages/landing/EnterpriseProofPage";
import PricingPage from "./pages/landing/PricingPage";
import EnterpriseConversionPage from "./pages/landing/EnterpriseConversionPage";

import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Categories from "./pages/Categories";
import Brands from "./pages/Brands";
import Units from "./pages/Units";
import Inventory from "./pages/Inventory";
import StockAdjustments from "./pages/StockAdjustments";
import Transfers from "./pages/Transfers";
import StockCounts from "./pages/StockCounts";
import StockMovements from "./pages/StockMovements";
import POS from "./pages/POS";
import Sales from "./pages/Sales";
import Quotations from "./pages/Quotations";
import Purchases from "./pages/Purchases";
import Suppliers from "./pages/Suppliers";
import Customers from "./pages/Customers";
import Loyalty from "./pages/Loyalty";
import Expenses from "./pages/Expenses";
import Reports from "./pages/Reports";
import Staff from "./pages/Staff";
import Branches from "./pages/Branches";
import WarehousesPage from "./pages/Warehouses";
import Notifications from "./pages/Notifications";
import Support from "./pages/Support";
import SettingsPage from "./pages/Settings";
import EBMSettings from "./pages/EBMSettings";
import ProfileSettings from "./pages/ProfileSettings";
import ActivityLogs from "./pages/ActivityLogs";
import QA from "./pages/QA";
import TenantSettings from "./pages/TenantSettings";

import Login from "@/pages/onboarding/Login";
import Signup from "@/pages/onboarding/Signup";
import Activation from "@/pages/onboarding/Activation";
import Payment from "@/pages/onboarding/Payment";
import PendingApproval from "@/pages/PendingApproval";

import UserManagement from "@/pages/UserManagement";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import SupportPage from "./pages/SupportPage";
import ContactSalesPage from "./pages/ContactSalesPage";
import BillingPortal from "@/pages/BillingPortal";

import EnterpriseBlueprintPage from "./pages/trust/EnterpriseBlueprintPage";
import DataLifecyclePage from "./pages/trust/DataLifecyclePage";
import DataClassificationPage from "./pages/trust/DataClassificationPage";
import TenantBoundaryPage from "./pages/trust/TenantBoundaryPage";
import IdentityJourneyPage from "./pages/trust/IdentityJourneyPage";
import ComplianceFrameworkPage from "./pages/trust/ComplianceFrameworkPage";
import EnterpriseFAQPage from "./pages/trust/EnterpriseFAQPage";
import SecurityResponsePage from "./pages/trust/SecurityResponsePage";

import Invoices from "@/pages/platform-admin/Invoices";
import PlatformAdminLayout from "@/pages/platform-admin/PlatformAdminLayout";
import TrialManagement from "@/pages/platform-admin/TrialManagement";
import Tenants from "@/pages/platform-admin/Tenants";
import Payments from "@/pages/platform-admin/PaymentsPage";
import PlatformUsers from "@/pages/platform-admin/PlatformUsers";
import PlatformDashboard from "@/pages/platform-admin/PlatformDashboard";
import PlatformAuditLogs from "@/pages/platform-admin/PlatformAuditLogs";
import Monitoring from "@/pages/platform-admin/Monitoring";
import FeatureFlags from "@/pages/platform-admin/FeatureFlags";
import PlatformSettings from "@/pages/platform-admin/PlatformSettings";
import Plans from "@/pages/platform-admin/Plans";
import PaymentAttempts from "@/pages/platform-admin/PaymentAttempts";
import RevenueIntelligence from "@/pages/platform-admin/RevenueIntelligence";
import PlatformSupport from "@/pages/platform-admin/PlatformSupport";
import AutomationEngine from "@/pages/platform-admin/AutomationEngine";
import PlatformSubscriptions from "@/pages/platform-admin/Subscriptions";
import SubscriptionApprovals from "@/pages/platform-admin/SubscriptionApprovals";
import SupportAccessBridge from "@/pages/platform-admin/SupportAccessBridge";
import ActiveSupportSessions from "@/pages/platform-admin/ActiveSupportSessions";
import WorkspaceRequests from "@/pages/platform-admin/WorkspaceRequests";
import PlatformRoles from "@/pages/platform-admin/PlatformRoles";
import PlatformPermissions from "@/pages/platform-admin/PlatformPermissions";
import LoginSessions from "@/pages/platform-admin/LoginSessions";
import Infrastructure from "@/pages/platform-admin/Infrastructure";
import StorageCenter from "@/pages/platform-admin/StorageCenter";
import PlatformAnalytics from "@/pages/platform-admin/PlatformAnalytics";
import NotificationCenter from "@/pages/platform-admin/NotificationCenter";
import SalesInquiries from "@/pages/platform-admin/SalesInquiries";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (
        failureCount,
        error: any,
      ) => {
        const message = String(
          error?.message || error || "",
        ).toLowerCase();

        if (
          message.includes("failed to fetch") ||
          message.includes("network") ||
          message.includes("name_not_resolved") ||
          message.includes("connection_closed")
        ) {
          return false;
        }

        return failureCount < 1;
      },

      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 15_000,
    },

    mutations: {
      retry: false,
    },
  },
});

/**
 * Whether there is a session the API will accept.
 *
 * This asked Supabase until the modules started moving to the ShopCore API,
 * at which point it could only ever answer no — `refreshSession()` goes to an
 * unconfigured host — and every automatic sync gave up here before touching a
 * single queued record.
 */
async function hasRealApiSession() {
  if (isOfflineMode() || !isOnline()) return false;
  return authApi.hasValidSession();
}

async function canReachApi() {
  return (
    isOnline() &&
    !isOfflineMode()
  );
}

function AutoSyncOfflineData() {
  const { t } = useLanguage();
  const syncingRef = useRef(false);

  const warnedOfflineAuthRef =
    useRef(false);

  const lastSyncAttemptRef =
    useRef(0);

  const runSync = async (
    source:
      | "startup"
      | "online"
      | "manual-event" = "startup",
  ) => {
    if (syncingRef.current) {
      return;
    }

    if (!isOnline()) {
      return;
    }

    const now = Date.now();

    if (
      source !== "manual-event" &&
      now -
        lastSyncAttemptRef.current <
        12_000
    ) {
      return;
    }

    lastSyncAttemptRef.current = now;

    const hasPending =
      await hasPendingOfflineData();

    if (!hasPending) {
      return;
    }

    if (isOfflineMode()) {
      if (
        !warnedOfflineAuthRef.current
      ) {
        warnedOfflineAuthRef.current =
          true;

        toast.warning(
          t("sync.waitingOnline"),
        );
      }

      return;
    }

    const reachable =
      await canReachApi();

    if (!reachable) {
      if (source === "manual-event") {
        toast.warning(
          t("sync.connectionNotReady"),
        );
      }

      return;
    }

    const hasSession =
      await hasRealApiSession();

    if (!hasSession) {
      if (
        !warnedOfflineAuthRef.current
      ) {
        warnedOfflineAuthRef.current =
          true;

        toast.warning(
          t("sync.loginRequired"),
        );
      }

      return;
    }

    syncingRef.current = true;

    try {
      toast.info(
        t("sync.syncing"),
      );

      const result =
        await syncOfflineData();

      if (result.failed > 0) {
        const message = t("sync.failedCount", {
          count: result.failed,
        });

        toast.error(message, {
          duration: 12000,
        });

        console.error(
          "Synchronization errors:",
          JSON.stringify(
            result.errors,
            null,
            2,
          ),
        );

        window.dispatchEvent(
          new CustomEvent(
            "shopcore-sync-failed",
            {
              detail: {
                synced: result.synced,
                failed: result.failed,
                errors: result.errors,
                message,
                syncedAt:
                  new Date().toISOString(),
                source,
              },
            },
          ),
        );

        return;
      }

      if (result.synced > 0) {
        await queryClient.invalidateQueries();

        const message = t("sync.success", {
          count: result.synced,
        });

        toast.success(message, {
          duration: 10000,
        });

        window.dispatchEvent(
          new CustomEvent(
            "shopcore-sync-success",
            {
              detail: {
                synced: result.synced,
                failed: result.failed,
                message,
                syncedAt:
                  new Date().toISOString(),
                source,
              },
            },
          ),
        );
      } else {
        window.dispatchEvent(
          new CustomEvent(
            "shopcore-sync-success",
            {
              detail: {
                synced: 0,
                failed: 0,
                message:
                  t("sync.none"),
                syncedAt:
                  new Date().toISOString(),
                source,
              },
            },
          ),
        );
      }
    } catch (error) {
      console.error(
        "Background synchronization failed:",
        error,
      );

      toast.error(
        t("sync.failed"),
        {
          duration: 12000,
        },
      );

      window.dispatchEvent(
        new CustomEvent(
          "shopcore-sync-failed",
          {
            detail: {
              synced: 0,
              failed: 1,
              errors: [
                String(
                  (error as any)
                    ?.message || error,
                ),
              ],
              message:
                t("sync.failed"),
              syncedAt:
                new Date().toISOString(),
              source,
            },
          },
        ),
      );
    } finally {
      syncingRef.current = false;
    }
  };

  useEffect(() => {
    onlineManager.setOnline(
      isOnline() &&
        !isOfflineMode(),
    );

    /*
     * The connectivity monitor decides what "online" means, by asking the API
     * rather than trusting the browser. This is the whole automatic switch:
     * the monitor notices the connection has gone, the app drops to offline
     * and queues; the monitor notices it is back, and the queue is replayed
     * without anyone pressing anything.
     *
     * The browser's own online/offline events are still handled below, but
     * only as prompts to re-check — a network interface coming up is not the
     * same as the internet coming back, and a shop's router being reachable
     * while its line is down is the ordinary case here, not an edge case.
     */
    const stopMonitor =
      startConnectivityMonitor();

    const unsubscribe =
      onConnectivityChange(
        (state) => {
          onlineManager.setOnline(
            state === "online" &&
              !isOfflineMode(),
          );

          if (state === "offline") {
            toast.warning(
              t("sync.wentOffline"),
            );
            return;
          }

          toast.success(
            t("sync.backOnline"),
          );

          // Let the connection settle before replaying — the first seconds
          // after a link comes back are the least reliable.
          warnedOfflineAuthRef.current =
            false;

          window.setTimeout(() => {
            void runSync("online");
          }, 2000);
        },
      );

    const handleOnline = () => {
      onlineManager.setOnline(true);
      warnedOfflineAuthRef.current =
        false;

      window.setTimeout(() => {
        void runSync("online");
      }, 3000);
    };

    const handleOffline = () => {
      onlineManager.setOnline(false);
    };

    const handleOnlineLogin = () => {
      onlineManager.setOnline(true);
      warnedOfflineAuthRef.current =
        false;

      window.setTimeout(() => {
        void runSync("manual-event");
      }, 1200);
    };

    const handleOfflineLogin = () => {
      onlineManager.setOnline(false);
      focusManager.setFocused(false);
    };

    window.addEventListener(
      "online",
      handleOnline,
    );

    window.addEventListener(
      "offline",
      handleOffline,
    );

    window.addEventListener(
      "shopcore-online-login",
      handleOnlineLogin,
    );

    window.addEventListener(
      "shopcore-offline-login",
      handleOfflineLogin,
    );

    if (
      isOnline() &&
      !isOfflineMode()
    ) {
      window.setTimeout(() => {
        void runSync("startup");
      }, 3500);
    }

    return () => {
      window.removeEventListener(
        "online",
        handleOnline,
      );

      window.removeEventListener(
        "offline",
        handleOffline,
      );

      window.removeEventListener(
        "shopcore-online-login",
        handleOnlineLogin,
      );

      window.removeEventListener(
        "shopcore-offline-login",
        handleOfflineLogin,
      );

      unsubscribe();
      stopMonitor();
    };
  }, []);

  return null;
}

function ActivationGuard({
  children,
}: {
  children: ReactNode;
}) {
  const {
    loading,
    bootstrapping,
    requiresActivation,
  } = useAuth();

  const location = useLocation();

  if (loading || bootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (
    requiresActivation &&
    location.pathname !== "/activation"
  ) {
    return (
      <Navigate
        to="/activation"
        replace
      />
    );
  }

  return <>{children}</>;
}

type WorkspaceModuleRouteProps = {
  feature: string;
  featureName: string;
  requiredPlan?: string;
  children: ReactNode;
};

function WorkspaceModuleRoute({
  feature,
  featureName,
  requiredPlan,
  children,
}: WorkspaceModuleRouteProps) {
  return (
    <RoleGate>
      <PlanGuard
        feature={feature}
        featureName={featureName}
        requiredPlan={requiredPlan}
      >
        {children}
      </PlanGuard>
    </RoleGate>
  );
}

const ProtectedAppLayout = () => (
  <ActivationGuard>
    <AppLayout />
  </ActivationGuard>
);

const App = () => (
  <ThemeProvider>
    <LanguageProvider>
      <LegacyUiTranslationBridge />
      <QueryClientProvider
        client={queryClient}
      >
        <TooltipProvider>
      <Toaster />
      <Sonner />

      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <AuthProvider>
          <AutoSyncOfflineData />

          <Routes>
            {/* Public experience */}

            <Route
              path="/"
              element={
                <OperatingSystemLanding />
              }
            />

            <Route
              path="/privacy"
              element={<PrivacyPage />}
            />

            <Route
              path="/terms"
              element={<TermsPage />}
            />

            <Route
              path="/support-center"
              element={<SupportPage />}
            />

            <Route
              path="/contact-sales"
              element={<ContactSalesPage />}
            />

            {/* Legacy landing routes for backward compatibility */}

            <Route
              path="/offline"
              element={<OfflineEnginePage />}
            />

            <Route
              path="/ebm"
              element={<EBMIntegrationPage />}
            />

            <Route
              path="/security"
              element={<SecurityCenterPage />}
            />

            <Route
              path="/pricing"
              element={<PricingPage />}
            />

            <Route
              path="/modules"
              element={<ModuleExplorerPage />}
            />

            {/* Landing section pages */}

            <Route
              path="/landing/hero"
              element={<HeroPage />}
            />

            <Route
              path="/landing/command-center"
              element={<CommandCenterPage />}
            />

            <Route
              path="/landing/modules"
              element={<ModuleExplorerPage />}
            />

            <Route
              path="/landing/ecosystem"
              element={<WorkspaceEcosystemPage />}
            />

            <Route
              path="/landing/branch-intelligence"
              element={<BranchIntelligencePage />}
            />

            <Route
              path="/landing/executive-intelligence"
              element={<ExecutiveIntelligencePage />}
            />

            <Route
              path="/landing/offline"
              element={<OfflineEnginePage />}
            />

            <Route
              path="/landing/ebm"
              element={<EBMIntegrationPage />}
            />

            <Route
              path="/landing/security"
              element={<SecurityCenterPage />}
            />

            <Route
              path="/landing/proof"
              element={<EnterpriseProofPage />}
            />

            <Route
              path="/landing/pricing"
              element={<PricingPage />}
            />

            <Route
              path="/landing/conversion"
              element={<EnterpriseConversionPage />}
            />

            {/* Trust Center pages */}

            <Route
              path="/trust/blueprint"
              element={<EnterpriseBlueprintPage />}
            />

            <Route
              path="/trust/data-lifecycle"
              element={<DataLifecyclePage />}
            />

            <Route
              path="/trust/data-classification"
              element={<DataClassificationPage />}
            />

            <Route
              path="/trust/tenant-boundary"
              element={<TenantBoundaryPage />}
            />

            <Route
              path="/trust/identity-journey"
              element={<IdentityJourneyPage />}
            />

            <Route
              path="/trust/compliance"
              element={<ComplianceFrameworkPage />}
            />

            <Route
              path="/trust/faq"
              element={<EnterpriseFAQPage />}
            />

            <Route
              path="/trust/security-response"
              element={<SecurityResponsePage />}
            />

            <Route
              path="/auth"
              element={<Login />}
            />

            <Route
              path="/signup"
              element={<Signup />}
            />

            <Route
              path="/reset-password"
              element={<ResetPassword />}
            />

            <Route
              path="/accept-invite"
              element={<AcceptInvite />}
            />

            <Route
              path="/support-access/:sessionId"
              element={
                <SupportAccessBridge />
              }
            />

            {/* Subscription onboarding */}

            <Route
              path="/onboarding/payment/:tenantId"
              element={
                <ProtectedRoute>
                  <Payment />
                </ProtectedRoute>
              }
            />

            <Route
              path="/pending-approval"
              element={
                <ProtectedRoute>
                  <PendingApproval />
                </ProtectedRoute>
              }
            />

            <Route
              path="/activation"
              element={
                <ProtectedRoute>
                  <Activation />
                </ProtectedRoute>
              }
            />

            {/* Platform Administration */}

            <Route
              path="/platform-admin"
              element={
                <ProtectedRoute>
                  <PlatformAdminRoute>
                    <PlatformAdminLayout />
                  </PlatformAdminRoute>
                </ProtectedRoute>
              }
            >
              <Route
                index
                element={
                  <PlatformDashboard />
                }
              />

              <Route
                path="settings"
                element={
                  <PlatformSettings />
                }
              />

              <Route
                path="features"
                element={<FeatureFlags />}
              />

              <Route
                path="monitoring"
                element={<Monitoring />}
              />

              <Route
                path="audit"
                element={
                  <PlatformAuditLogs />
                }
              />

              <Route
                path="users"
                element={<PlatformUsers />}
              />

              <Route
                path="trials"
                element={
                  <TrialManagement />
                }
              />

              <Route
                path="tenants"
                element={<Tenants />}
              />

              <Route
                path="payments"
                element={<Payments />}
              />

              <Route
                path="plans"
                element={<Plans />}
              />

              <Route
                path="support"
                element={
                  <PlatformSupport />
                }
              />

              <Route
                path="active-support"
                element={
                  <ActiveSupportSessions />
                }
              />

              <Route
                path="invoices"
                element={<Invoices />}
              />

              <Route
                path="payment-attempts"
                element={
                  <PaymentAttempts />
                }
              />

              <Route
                path="revenue-intelligence"
                element={
                  <RevenueIntelligence />
                }
              />

              <Route
                path="automation"
                element={
                  <AutomationEngine />
                }
              />

              <Route
                path="subscriptions"
                element={
                  <PlatformSubscriptions />
                }
              />

              <Route
                path="subscription-approvals"
                element={
                  <SubscriptionApprovals />
                }
              />

              <Route
                path="notifications"
                element={
                  <NotificationCenter />
                }
              />

              <Route
                path="workspaces"
                element={
                  <WorkspaceRequests />
                }
              />

              <Route
                path="roles"
                element={<PlatformRoles />}
              />

              <Route
                path="permissions"
                element={
                  <PlatformPermissions />
                }
              />

              <Route
                path="sessions"
                element={<LoginSessions />}
              />

              <Route
                path="infrastructure"
                element={<Infrastructure />}
              />

              <Route
                path="storage"
                element={<StorageCenter />}
              />

              <Route
                path="analytics"
                element={
                  <PlatformAnalytics />
                }
              />

              <Route
                path="sales-inquiries"
                element={
                  <SalesInquiries />
                }
              />
            </Route>


            <Route
              element={
                <ProtectedRoute>
                  <ProtectedAppLayout />
                </ProtectedRoute>
              }
            >
              
              <Route
                path="/dashboard"
                element={
                  <RoleGate>
                    <Dashboard />
                  </RoleGate>
                }
              />

              <Route
                path="/notifications"
                element={
                  <RoleGate>
                    <Notifications />
                  </RoleGate>
                }
              />

              <Route
                path="/billing"
                element={<BillingPortal />}
              />

              <Route
                path="/support"
                element={
                  <RoleGate>
                    <Support />
                  </RoleGate>
                }
              />

              <Route
                path="/settings"
                element={
                  <RoleGate>
                    <SettingsPage />
                  </RoleGate>
                }
              />

              <Route
                path="/profile"
                element={
                  <RoleGate>
                    <ProfileSettings />
                  </RoleGate>
                }
              />

              <Route
                path="/workspace"
                element={
                  <RoleGate>
                    <TenantSettings />
                  </RoleGate>
                }
              />

              <Route
                path="/user-management"
                element={
                  <RoleGate>
                    <UserManagement />
                  </RoleGate>
                }
              />

              <Route
                path="/qa"
                element={
                  <RoleGate>
                    <QA />
                  </RoleGate>
                }
              />


              <Route
                path="/products"
                element={
                  <WorkspaceModuleRoute
                    feature="products"
                    featureName="Product Catalog"
                  >
                    <Products />
                  </WorkspaceModuleRoute>
                }
              />

              <Route
                path="/categories"
                element={
                  <WorkspaceModuleRoute
                    feature="categories"
                    featureName="Product Categories"
                  >
                    <Categories />
                  </WorkspaceModuleRoute>
                }
              />

              <Route
                path="/brands"
                element={
                  <WorkspaceModuleRoute
                    feature="brands"
                    featureName="Product Brands"
                    requiredPlan="Professional"
                  >
                    <Brands />
                  </WorkspaceModuleRoute>
                }
              />

              <Route
                path="/units"
                element={
                  <WorkspaceModuleRoute
                    feature="units"
                    featureName="Units of Measure"
                    requiredPlan="Professional"
                  >
                    <Units />
                  </WorkspaceModuleRoute>
                }
              />


              <Route
                path="/inventory"
                element={
                  <WorkspaceModuleRoute
                    feature="inventory_basic"
                    featureName="Inventory Control"
                  >
                    <Inventory />
                  </WorkspaceModuleRoute>
                }
              />

              <Route
                path="/stock-adjustments"
                element={
                  <WorkspaceModuleRoute
                    feature="inventory_advanced"
                    featureName="Stock Adjustments"
                    requiredPlan="Professional"
                  >
                    <StockAdjustments />
                  </WorkspaceModuleRoute>
                }
              />

              <Route
                path="/transfers"
                element={
                  <WorkspaceModuleRoute
                    feature="stock_transfers"
                    featureName="Stock Transfers"
                    requiredPlan="Professional"
                  >
                    <Transfers />
                  </WorkspaceModuleRoute>
                }
              />

              <Route
                path="/stock-counts"
                element={
                  <WorkspaceModuleRoute
                    feature="inventory_advanced"
                    featureName="Stock Counts"
                    requiredPlan="Professional"
                  >
                    <StockCounts />
                  </WorkspaceModuleRoute>
                }
              />

              <Route
                path="/stock-movements"
                element={
                  <WorkspaceModuleRoute
                    feature="inventory_advanced"
                    featureName="Stock Movement Control"
                    requiredPlan="Professional"
                  >
                    <StockMovements />
                  </WorkspaceModuleRoute>
                }
              />

              <Route
                path="/warehouses"
                element={
                  <WorkspaceModuleRoute
                    feature="warehouses"
                    featureName="Warehouse Management"
                    requiredPlan="Professional"
                  >
                    <WarehousesPage />
                  </WorkspaceModuleRoute>
                }
              />

              <Route
                path="/branches"
                element={
                  <WorkspaceModuleRoute
                    feature="branches"
                    featureName="Multi-Branch Management"
                    requiredPlan="Professional"
                  >
                    <Branches />
                  </WorkspaceModuleRoute>
                }
              />

              <Route
                path="/pos"
                element={
                  <WorkspaceModuleRoute
                    feature="pos"
                    featureName="Point of Sale"
                  >
                    <POS />
                  </WorkspaceModuleRoute>
                }
              />

              <Route
                path="/sales"
                element={
                  <WorkspaceModuleRoute
                    feature="sales"
                    featureName="Sales Management"
                  >
                    <Sales />
                  </WorkspaceModuleRoute>
                }
              />

              <Route
                path="/quotations"
                element={
                  <WorkspaceModuleRoute
                    feature="quotations"
                    featureName="Quotations"
                    requiredPlan="Professional"
                  >
                    <Quotations />
                  </WorkspaceModuleRoute>
                }
              />

              {/* Procurement */}

              <Route
                path="/purchases"
                element={
                  <WorkspaceModuleRoute
                    feature="purchases"
                    featureName="Purchasing"
                    requiredPlan="Professional"
                  >
                    <Purchases />
                  </WorkspaceModuleRoute>
                }
              />

              <Route
                path="/suppliers"
                element={
                  <WorkspaceModuleRoute
                    feature="suppliers"
                    featureName="Supplier Management"
                    requiredPlan="Professional"
                  >
                    <Suppliers />
                  </WorkspaceModuleRoute>
                }
              />

              {/* Customer operations */}

              <Route
                path="/customers"
                element={
                  <WorkspaceModuleRoute
                    feature="customers"
                    featureName="Customer Management"
                  >
                    <Customers />
                  </WorkspaceModuleRoute>
                }
              />

              <Route
                path="/loyalty"
                element={
                  <WorkspaceModuleRoute
                    feature="loyalty"
                    featureName="Customer Loyalty"
                    requiredPlan="Professional"
                  >
                    <Loyalty />
                  </WorkspaceModuleRoute>
                }
              />

              {/* Finance, reporting and workforce */}

              <Route
                path="/expenses"
                element={
                  <WorkspaceModuleRoute
                    feature="expenses"
                    featureName="Expense Management"
                    requiredPlan="Professional"
                  >
                    <Expenses />
                  </WorkspaceModuleRoute>
                }
              />

              <Route
                path="/reports"
                element={
                  <WorkspaceModuleRoute
                    feature="reports_basic"
                    featureName="Business Reports"
                  >
                    <Reports />
                  </WorkspaceModuleRoute>
                }
              />

              <Route
                path="/staff"
                element={
                  <WorkspaceModuleRoute
                    feature="staff"
                    featureName="Staff Management"
                    requiredPlan="Business Plus"
                  >
                    <Staff />
                  </WorkspaceModuleRoute>
                }
              />

              {/* Collaboration and governance */}

              <Route
                path="/workspace-chat"
                element={
                  <WorkspaceModuleRoute
                    feature="workspace"
                    featureName="Workspace Collaboration"
                    requiredPlan="Business Plus"
                  >
                    <WorkspaceChat />
                  </WorkspaceModuleRoute>
                }
              />

              <Route
                path="/ebm-settings"
                element={
                  <WorkspaceModuleRoute
                    feature="ebm"
                    featureName="RRA EBM Integration"
                    requiredPlan="Professional"
                  >
                    <EBMSettings />
                  </WorkspaceModuleRoute>
                }
              />

              <Route
                path="/activity-logs"
                element={
                  <WorkspaceModuleRoute
                    feature="audit_logs"
                    featureName="Audit Logs"
                    requiredPlan="Business Plus"
                  >
                    <ActivityLogs />
                  </WorkspaceModuleRoute>
                }
              />
            </Route>

            <Route
              path="*"
              element={<NotFound />}
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </LanguageProvider>
  </ThemeProvider>
);

export default App;
