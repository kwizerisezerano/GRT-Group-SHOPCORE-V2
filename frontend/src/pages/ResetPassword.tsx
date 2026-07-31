import { useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  BarChart3,
  Building2,
  Eye,
  EyeOff,
  LockKeyhole,
  Package,
  ShoppingCart,
} from "lucide-react";
import { LanguageSelector } from "@/components/settings/LanguageSelector";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
import { useLanguage } from "@/contexts/LanguageContext";

const chartBars = [46, 58, 64, 52, 49, 56, 61, 68, 55, 72, 79, 84];

const operatingSignals = [
  { labelKey: "navigation.pos", icon: ShoppingCart, tone: "bg-blue-600" },
  { labelKey: "navigation.inventory", icon: Package, tone: "bg-emerald-600" },
  { labelKey: "navigation.branches", icon: Building2, tone: "bg-cyan-600" },
  { labelKey: "navigation.reports", icon: BarChart3, tone: "bg-violet-600" },
];

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

function AuthShell({ children }: { children: ReactNode }) {
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
                Home
              </Link>
            </div>
          </div>

          <div className="grid gap-8 p-5 lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
            <BrandPanel />

            <section className="flex min-h-[650px] items-center justify-center rounded-[22px] bg-background px-4 py-10 sm:px-8">
              <div className="w-full max-w-[430px]">{children}</div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");

  const validatePassword = (pwd: string): string => {
    if (pwd.length < 8) {
      return "Password must be at least 8 characters";
    }
    if (!/[A-Z]/.test(pwd)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/[a-z]/.test(pwd)) {
      return "Password must contain at least one lowercase letter";
    }
    if (!/[0-9]/.test(pwd)) {
      return "Password must contain at least one number";
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) {
      return "Password must contain at least one special character";
    }
    return "";
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setPasswordError(validatePassword(value));
    if (confirmPassword && value !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match");
    } else if (confirmPassword && value === confirmPassword) {
      setConfirmPasswordError("");
    }
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    if (value && value !== password) {
      setConfirmPasswordError("Passwords do not match");
    } else {
      setConfirmPasswordError("");
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const pwdError = validatePassword(password);
    if (pwdError) {
      toast.error(pwdError);
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await authApi.completePasswordReset(token, password);
      toast.success("Password updated successfully! Please log in.");
      navigate("/auth", { replace: true });
    } catch (error: any) {
      toast.error(error?.message || "Password reset failed");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthShell>
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-500/10">
            <LockKeyhole className="h-6 w-6 text-rose-600" />
          </div>
          <h2 className="text-3xl font-black tracking-tight text-foreground">
            Invalid Link
          </h2>
          <p className="mt-3 text-sm font-medium leading-6 text-muted-foreground">
            This password reset link is invalid or has expired.
          </p>
          <Button
            className="mt-8 h-12 w-full rounded-lg bg-blue-600 text-sm font-black text-white hover:bg-blue-700"
            onClick={() => navigate("/auth")}
          >
            Back to Login
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
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
          </div>
        </Link>

        <h2 className="text-3xl font-black tracking-tight text-foreground">
          Set New Password
        </h2>
        <p className="mt-3 text-sm font-medium leading-6 text-muted-foreground">
          Enter your new password below.
        </p>
      </div>

      <form onSubmit={handleReset} className="mt-8 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="new-password" className="text-xs font-black text-foreground">
            New Password <span className="text-rose-600">*</span>
          </Label>

          <div className="relative">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <LockKeyhole className="h-4 w-4" />
            </div>

            <Input
              id="new-password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              placeholder="Min 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special"
              autoComplete="new-password"
              className={`h-11 rounded-md border-border bg-card pl-10 pr-12 text-sm font-medium text-card-foreground shadow-none placeholder:text-muted-foreground focus:border-transparent focus:outline-none ${passwordError ? 'border-rose-500' : ''}`}
            />

            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          {passwordError && (
            <p className="text-xs font-medium text-rose-600">{passwordError}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password" className="text-xs font-black text-foreground">
            Confirm Password <span className="text-rose-600">*</span>
          </Label>

          <div className="relative">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <LockKeyhole className="h-4 w-4" />
            </div>

            <Input
              id="confirm-password"
              type={showConfirmPassword ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => handleConfirmPasswordChange(e.target.value)}
              placeholder="Re-enter your new password"
              autoComplete="new-password"
              className={`h-11 rounded-md border-border bg-card pl-10 pr-12 text-sm font-medium text-card-foreground shadow-none placeholder:text-muted-foreground focus:border-transparent focus:outline-none ${confirmPasswordError ? 'border-rose-500' : ''}`}
            />

            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          {confirmPasswordError && (
            <p className="text-xs font-medium text-rose-600">{confirmPasswordError}</p>
          )}
        </div>

        <Button
          type="submit"
          className="h-12 w-full rounded-lg bg-blue-600 text-sm font-black text-white hover:bg-blue-700"
          disabled={loading || !!passwordError || !!confirmPasswordError}
        >
          {loading ? "Updating..." : "Update Password"}
        </Button>
      </form>
    </AuthShell>
  );
}
