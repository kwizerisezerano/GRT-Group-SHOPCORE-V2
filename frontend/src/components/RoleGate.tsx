import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const ROUTE_MODULES: Record<string, string> = {
  "/dashboard": "dashboard",
  "/pos": "pos",
  "/sales": "sales",
  "/quotations": "sales",
  "/products": "products",
  "/categories": "products",
  "/brands": "products",
  "/units": "products",
  "/inventory": "inventory",
  "/stock-adjustments": "inventory",
  "/stock-counts": "inventory",
  "/stock-movements": "inventory",
  "/transfers": "inventory",
  "/purchases": "purchases",
  "/suppliers": "suppliers",
  "/customers": "customers",
  "/loyalty": "loyalty",
  "/expenses": "expenses",
  "/reports": "reports",
  "/staff": "staff",
  "/branches": "branches",
  "/warehouses": "warehouses",
  "/settings": "settings",
  "/workspace": "settings",
  "/profile": "settings",
  "/activity-logs": "activity_logs",
  "/qa": "qa",
  "/user-management": "staff",
  "/workspace-chat": "workspace",
  "/notifications": "notifications",
  "/support": "support",
  "/ebm-settings": "settings",
};

function getModuleFromPath(pathname: string) {
  const cleanPath = pathname.replace(/\/$/, "");
  return ROUTE_MODULES[cleanPath] || null;
}

export function RoleGate({ children }: { children: ReactNode }) {
  const { bootstrapping, loading, user, session, role, tenantId, canViewModule } =
    useAuth();
  const location = useLocation();

  if (loading || bootstrapping) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!user && !session?.access_token) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  if (!tenantId || !role) {
    return (
      <div className="mx-auto mt-24 max-w-md rounded-lg border bg-card p-6 text-center">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <h2 className="mb-1 text-lg font-semibold">No workspace found</h2>
        <p className="text-sm text-muted-foreground">
          Your account is not attached to any workspace yet. Please contact the
          workspace administrator.
        </p>
      </div>
    );
  }

  const module = getModuleFromPath(location.pathname);

  if (module && !canViewModule(module)) {
    return (
      <div className="mx-auto mt-24 max-w-md rounded-lg border bg-card p-6 text-center">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-destructive" />
        <h2 className="mb-1 text-lg font-semibold">No permission</h2>
        <p className="text-sm text-muted-foreground">
          Your role (<span className="font-medium">{role}</span>) does not
          allow access to this page.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}