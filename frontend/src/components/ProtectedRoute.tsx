import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { getCachedOfflineAuth, isOfflineMode } from "@/lib/offlineAuth";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, session, loading, bootstrapping } = useAuth();
  const location = useLocation();

  if (loading || bootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  const cachedOfflineUser = getCachedOfflineAuth()?.user;

  const authenticated =
    !!user ||
    !!session?.access_token ||
    (isOfflineMode() && !!cachedOfflineUser);

  if (!authenticated) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}