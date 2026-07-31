import { memo, useState, type ReactNode } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { authApi } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Package,
  ShoppingCart,
} from "lucide-react";
import { loginOffline, setupOfflineLogin } from "@/lib/offlineAuth";
import { LanguageSelector } from "@/components/settings/LanguageSelector";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
import { useLanguage } from "@/contexts/LanguageContext";

const OFFLINE_MODE_KEY = "shopcore_offline_mode";

const chartBars = [46, 58, 64, 52, 49, 56, 61, 68, 55, 72, 79, 84];

const operatingSignals = [
  { labelKey: "navigation.pos", icon: ShoppingCart, tone: "bg-blue-600" },
  { labelKey: "navigation.inventory", icon: Package, tone: "bg-emerald-600" },
  { labelKey: "navigation.branches", icon: Building2, tone: "bg-cyan-600" },
  { labelKey: "navigation.reports", icon: BarChart3, tone: "bg-violet-600" },
];

function clearOfflineModeOnly() {
  try {
    localStorage.removeItem(OFFLINE_MODE_KEY);
  } catch {
    // ignore
  }
}

const Field = memo(function Field({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  icon,
  required,
  right,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon?: ReactNode;
  required?: boolean;
  right?: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs font-black text-foreground">
        {label} {required && <span className="text-rose-600">*</span>}
      </Label>

      <div className="relative">
        {icon && (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </div>
        )}

        <Input
          id={id}
          type={type}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={[
            "h-11 rounded-md border-border bg-card text-sm font-medium text-card-foreground shadow-none placeholder:text-muted-foreground focus:border-transparent focus:outline-none",
            icon ? "pl-10" : "",
            right ? "pr-12" : "",
          ].join(" ")}
        />

        {right}
      </div>
    </div>
  );
});

function AuthHeader() {
  const { t } = useLanguage();

  return (
    <div>
      <Link to="/" className="mb-8 inline-flex items-center gap-4">
        <img
          src="/shopcore-icon.png"
          alt="ShopCore"
          className="h-14 w-14 object-contain"
        />
        <div>
          <p className="text-xl font-black leading-tight text-foreground">
            ShopCore
          </p>
          <p className="text-sm font-semibold text-muted-foreground">
            {t("login.enterpriseRetailOs")}
          </p>
        </div>
      </Link>

      <h2 className="text-3xl font-black tracking-tight text-foreground">
        {t("login.title")}
      </h2>
      <p className="mt-3 text-sm font-medium leading-6 text-muted-foreground">
        {t("login.description")}
      </p>
    </div>
  );
}

function BrandPanel() {
  const { t } = useLanguage();

  return (
    <section className="relative hidden min-h-[650px] overflow-hidden rounded-[22px] bg-blue-600 px-10 py-12 text-white lg:block">
      <div className="mx-auto max-w-xl text-center">
        <Link to="/" className="mx-auto inline-flex items-center gap-3">
          <img
            src="/shopcore-icon.png"
            alt="ShopCore"
            className="h-11 w-11 object-contain"
          />
          <div className="text-left">
            <p className="text-lg font-black leading-none">ShopCore</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-blue-100/70">
              {t("login.retailOperatingSystem")}
            </p>
          </div>
        </Link>

        <div className="mt-14">
          <h1 className="text-3xl font-black tracking-tight">
            {t("login.welcome")}
          </h1>
          <p className="mt-5 text-2xl font-semibold text-white/95">
            {t("login.signIntoWorkspace")}
          </p>
          <p className="mx-auto mt-5 max-w-md text-sm font-medium leading-6 text-blue-100/70">
            {t("login.platformDescription")}
          </p>
        </div>
      </div>

      <div className="relative mx-auto mt-20 max-w-[430px] rounded-2xl bg-card p-4 text-foreground shadow-[0_30px_80px_-45px_rgba(0,0,0,0.65)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-black">{t("login.operationsReport")}</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              {t("login.monthlyActivity")}
            </p>
          </div>

          <div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-700" />
              {t("login.revenue")}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {t("login.stock")}
            </span>
          </div>
        </div>

        <div className="flex h-36 items-end gap-3 rounded-xl bg-muted px-3 py-4">
          {chartBars.map((height, index) => (
            <div key={index} className="flex flex-1 flex-col justify-end">
              <div
                className="rounded-t-md bg-blue-600"
                style={{ height: `${height}%` }}
              />
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          {operatingSignals.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.labelKey}
                className="rounded-xl border border-border bg-card p-2 shadow-sm"
              >
                <div
                  className={[
                    "mb-2 flex h-7 w-7 items-center justify-center rounded-lg text-white",
                    item.tone,
                  ].join(" ")}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <p className="truncate text-[10px] font-black text-foreground">
                  {t(item.labelKey)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="absolute bottom-16 right-16 w-[118px] rounded-2xl bg-card p-4 text-center text-foreground shadow-[0_24px_70px_-40px_rgba(0,0,0,0.75)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-[9px] border-emerald-500">
          <span className="text-xs font-black">100%</span>
        </div>
        <p className="mt-3 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
          {t("login.onlineOffline")}
        </p>
      </div>
    </section>
  );
}

export default function Login() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const isBrowserOffline =
        typeof navigator !== "undefined" && !navigator.onLine;

      if (isBrowserOffline) {
        await loginOffline(loginEmail.trim(), loginPassword);

        toast.success("Workspace opened in offline mode.");
        window.dispatchEvent(new Event("shopcore-offline-login"));
        navigate("/dashboard", { replace: true });
        return;
      }

      clearOfflineModeOnly();

      const activeSession = await authApi.login(loginEmail.trim(), loginPassword);

      await setupOfflineLogin(activeSession, loginPassword);

      // The subscription-approval workflow (is_platform_admin gating aside)
      // is deferred - new subscriptions are always created pre-approved by
      // the new backend, so there's no "pending approval" state to check
      // for here anymore.
      const me = await authApi.me();

      toast.success("Welcome back.");
      window.dispatchEvent(new Event("shopcore-online-login"));

      if (me.isPlatformAdmin) {
        navigate("/platform-admin", { replace: true });
        return;
      }

      navigate("/dashboard", { replace: true });
    } catch (error: any) {
      toast.error(error?.message || t("login.loginFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Language for the reset email is resolved server-side from the
      // account's stored profile.language, not passed on the link.
      await authApi.requestPasswordReset(forgotEmail.trim());

      toast.success(t("login.resetSent"));
      setShowForgot(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="shopcore-theme-scope min-h-screen bg-background text-foreground px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center justify-center">
        <div className="w-full overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_30px_90px_-50px_rgba(15,23,42,0.65)]">
          <div className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-rose-500" />
              <span className="h-3 w-3 rounded-full bg-yellow-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
            </div>

            <div className="hidden h-8 w-[360px] rounded-lg bg-muted md:block" />

            <div className="flex items-center gap-4">
              <LanguageSelector compact />
              <ThemeToggle />
              <Link
                to="/"
                className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
              >
                {t("login.home")}
              </Link>
            </div>
          </div>

          <div className="grid gap-8 p-5 lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
            <BrandPanel />

            <section className="flex min-h-[650px] items-center justify-center rounded-[22px] bg-background px-4 py-10 sm:px-8">
              <div className="w-full max-w-[430px]">
                {showForgot ? (
                  <>
                    <AuthHeader />
                    <form
                      onSubmit={handleForgotPassword}
                      className="mt-8 space-y-5"
                    >
                      <Field
                        id="forgot-email"
                        label={t("login.email")}
                        type="email"
                        value={forgotEmail}
                        onChange={setForgotEmail}
                        placeholder={t("login.emailPlaceholder")}
                        icon={<Mail className="h-4 w-4" />}
                        required
                      />

                      <Button
                        type="submit"
                        className="h-12 w-full rounded-lg bg-blue-600 text-sm font-black text-white hover:bg-blue-700"
                        disabled={isLoading}
                      >
                        {isLoading
                          ? t("login.sendingReset")
                          : t("login.sendReset")}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 w-full rounded-lg border-border text-sm font-black"
                        onClick={() => setShowForgot(false)}
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        {t("login.backToLogin")}
                      </Button>
                    </form>
                  </>
                ) : (
                  <>
                    <AuthHeader />

                    <form onSubmit={handleLogin} className="mt-8 space-y-5">
                      <Field
                        id="login-email"
                        label={t("login.email")}
                        type="email"
                        value={loginEmail}
                        onChange={setLoginEmail}
                        placeholder={t("login.emailPlaceholder")}
                        icon={<Mail className="h-4 w-4" />}
                        required
                      />

                      <Field
                        id="login-password"
                        label={t("login.password")}
                        type={showPassword ? "text" : "password"}
                        value={loginPassword}
                        onChange={setLoginPassword}
                        placeholder={t("login.passwordPlaceholder")}
                        icon={<LockKeyhole className="h-4 w-4" />}
                        required
                        right={
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        }
                      />

                      <button
                        type="button"
                        onClick={() => setShowForgot(true)}
                        className="text-xs font-black text-foreground hover:text-blue-700"
                      >
                        {t("login.forgotPassword")}
                      </button>

                      <Button
                        type="submit"
                        className="h-12 w-full rounded-lg bg-blue-600 text-sm font-black text-white hover:bg-blue-700"
                        disabled={isLoading}
                      >
                        {isLoading
                          ? t("login.signingIn")
                          : t("publicNav.login")}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 w-full rounded-lg border-blue-600 text-sm font-black text-blue-600 dark:border-blue-400 dark:text-blue-300"
                        onClick={() => navigate("/signup")}
                      >
                        {t("login.signupPrompt")}
                      </Button>
                    </form>
                  </>
                )}

                <div className="mt-7 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-muted-foreground">
  <Link to="/privacy" className="hover:text-foreground">
    {t("login.privacy")}
  </Link>

  <span>•</span>

  <Link to="/terms" className="hover:text-foreground">
    {t("login.terms")}
  </Link>

  <span>•</span>

  <Link to="/support-center" className="hover:text-foreground">
    {t("login.support")}
  </Link>
</div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
