import {
  memo,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Link,
  Navigate,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LanguageSelector } from "@/components/settings/LanguageSelector";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarRange,
  Check,
  CheckCircle2,
  CircleMinus,
  CreditCard,
  Eye,
  EyeOff,
  Landmark,
  LockKeyhole,
  Mail,
  MapPin,
  Package,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Store,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import { encryptData } from "@/lib/encryption";
import { toast } from "sonner";

import { authApi, workspaceApi } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";

type SignupStep = 1 | 2 | 3 | 4;

type WorkspacePlan =
  | "none"
  | "starter"
  | "professional"
  | "business_plus"
  | "enterprise_pro";

type BillingCycle = "monthly" | "six_months" | "annual";

type PaymentMethod = "mobile_money" | "card" | "bank_transfer";

type PlanPrice = {
  billing_cycle: BillingCycle;
  billing_months: number;
  list_price: number;
  discount_percent: number;
  final_price: number;
  currency: string;
};

type PlanFeature = {
  feature_key: string;
  name: string;
  description: string | null;
  category: string;
  feature_type: string;
  access_level: "included" | "limited" | "addon" | "unavailable";
  display_note: string | null;
  is_highlighted: boolean;
};

type PlanLimit = {
  limit_key: string;
  name: string;
  value: number | null;
  is_unlimited: boolean;
  unit: string | null;
};

type SubscriptionPlan = {
  id: string;
  code: WorkspacePlan;
  name: string;
  description: string;
  short_description: string;
  currency: string;
  monthly_price: number;
  six_month_price: number;
  yearly_price: number;
  six_month_discount: number;
  yearly_discount: number;
  is_popular: boolean;
  display_order: number;
  badge_text: string | null;
  button_label: string | null;
  prices: PlanPrice[];
  features: PlanFeature[];
  limits: PlanLimit[];
};

const planCodes: WorkspacePlan[] = [
  "none",
  "starter",
  "professional",
  "business_plus",
  "enterprise_pro",
];

const billingCycles: Array<{
  value: BillingCycle;
  label: string;
  compactLabel: string;
  description: string;
  discount: number;
}> = [
  {
    value: "monthly",
    label: "Monthly billing",
    compactLabel: "Monthly",
    description: "Flexible monthly payment",
    discount: 0,
  },
  {
    value: "six_months",
    label: "6-month billing",
    compactLabel: "6 months",
    description: "Pay six months and save 8%",
    discount: 8,
  },
  {
    value: "annual",
    label: "12-month billing",
    compactLabel: "12 months",
    description: "Pay annually and save 15%",
    discount: 15,
  },
];

const paymentMethods: Array<{
  value: PaymentMethod;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  {
    value: "mobile_money",
    label: "Mobile Money",
    description: "Continue with MTN MoMo or Airtel Money.",
    icon: Smartphone,
  },
  {
    value: "card",
    label: "Card payment",
    description: "Continue to secure hosted card checkout.",
    icon: CreditCard,
  },
  {
    value: "bank_transfer",
    label: "Bank transfer",
    description: "Receive bank instructions and submit a reference.",
    icon: Landmark,
  },
];

const chartBars = [46, 58, 64, 52, 49, 56, 61, 68, 55, 72, 79, 84];

const operatingSignals = [
  {
    label: "POS",
    icon: ShoppingCart,
    tone: "bg-blue-600",
  },
  {
    label: "Inventory",
    icon: Package,
    tone: "bg-emerald-600",
  },
  {
    label: "Branches",
    icon: Building2,
    tone: "bg-cyan-600",
  },
  {
    label: "Reports",
    icon: BarChart3,
    tone: "bg-violet-600",
  },
];

const isWorkspacePlan = (
  value: string | null,
): value is WorkspacePlan =>
  Boolean(value && planCodes.includes(value as WorkspacePlan));

const isBillingCycle = (
  value: string | null,
): value is BillingCycle =>
  value === "monthly" ||
  value === "six_months" ||
  value === "annual";

const asNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
};

const getText = (
  source: Record<string, unknown>,
  key: string,
  fallback = "",
) => {
  const value = source[key];

  return typeof value === "string" && value.trim()
    ? value
    : fallback;
};

const normalisePlan = (value: unknown): SubscriptionPlan | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;
  const code = getText(row, "code") as WorkspacePlan;

  // Allow any plan code, not just those in planCodes
  // This prevents filtering out valid plans from database
  if (!code) {
    return null;
  }

  const prices = Array.isArray(row.prices)
    ? row.prices
        .map((item): PlanPrice | null => {
          if (!item || typeof item !== "object") {
            return null;
          }

          const price = item as Record<string, unknown>;
          const cycle = getText(price, "billing_cycle");

          if (!isBillingCycle(cycle)) {
            return null;
          }

          return {
            billing_cycle: cycle,
            billing_months: asNumber(price.billing_months),
            list_price: asNumber(price.list_price),
            discount_percent: asNumber(price.discount_percent),
            final_price: asNumber(price.final_price),
            currency: getText(price, "currency", "RWF"),
          };
        })
        .filter(Boolean) as PlanPrice[]
    : [];

  const features = Array.isArray(row.features)
    ? row.features
        .map((item): PlanFeature | null => {
          if (!item || typeof item !== "object") {
            return null;
          }

          const feature = item as Record<string, unknown>;
          const featureKey = getText(feature, "feature_key");

          if (!featureKey) {
            return null;
          }

          const rawAccess = getText(
            feature,
            "access_level",
            "included",
          );

          const accessLevel: PlanFeature["access_level"] =
            rawAccess === "limited" ||
            rawAccess === "addon" ||
            rawAccess === "unavailable"
              ? rawAccess
              : "included";

          return {
            feature_key: featureKey,
            name: getText(feature, "name", featureKey),
            description:
              typeof feature.description === "string"
                ? feature.description
                : null,
            category: getText(feature, "category", "Platform"),
            feature_type: getText(
              feature,
              "feature_type",
              "capability",
            ),
            access_level: accessLevel,
            display_note:
              typeof feature.display_note === "string"
                ? feature.display_note
                : null,
            is_highlighted: feature.is_highlighted === true,
          };
        })
        .filter(Boolean) as PlanFeature[]
    : [];

  const limits = Array.isArray(row.limits)
    ? row.limits
        .map((item): PlanLimit | null => {
          if (!item || typeof item !== "object") {
            return null;
          }

          const limit = item as Record<string, unknown>;
          const limitKey = getText(limit, "limit_key");

          if (!limitKey) {
            return null;
          }

          return {
            limit_key: limitKey,
            name: getText(limit, "name", limitKey),
            value:
              typeof limit.value === "number" ||
              typeof limit.value === "string"
                ? asNumber(limit.value)
                : null,
            is_unlimited: limit.is_unlimited === true,
            unit:
              typeof limit.unit === "string"
                ? limit.unit
                : null,
          };
        })
        .filter(Boolean) as PlanLimit[]
    : [];

  return {
    id: getText(row, "id", `plan-${code}`),
    code,
    name: getText(row, "name", code),
    description: getText(row, "description"),
    short_description: getText(
      row,
      "short_description",
      getText(row, "description"),
    ),
    currency: getText(row, "currency", "RWF"),
    monthly_price: asNumber(row.monthly_price),
    six_month_price: asNumber(row.six_month_price),
    yearly_price: asNumber(row.yearly_price),
    six_month_discount: asNumber(row.six_month_discount),
    yearly_discount: asNumber(row.yearly_discount),
    is_popular: row.is_popular === true,
    display_order: asNumber(row.display_order, 99),
    badge_text:
      typeof row.badge_text === "string"
        ? row.badge_text
        : null,
    button_label:
      typeof row.button_label === "string"
        ? row.button_label
        : null,
    prices,
    features,
    limits,
  };
};

const formatMoney = (value: number, currency = "RWF") =>
  new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    maximumFractionDigits: 0,
  })
    .format(value)
    .replace(/\s+/g, " ");

const formatCompactNumber = (value: number) =>
  new Intl.NumberFormat("en", {
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);

const getPlanPrice = (
  plan: SubscriptionPlan | undefined,
  cycle: BillingCycle,
): PlanPrice => {
  if (!plan) {
    return {
      billing_cycle: cycle,
      billing_months: cycle === "six_months" ? 6 : cycle === "annual" ? 12 : 1,
      list_price: 0,
      discount_percent: 0,
      final_price: 0,
      currency: "RWF",
    };
  }

  const exactPrice = plan.prices.find(
    (price) => price.billing_cycle === cycle,
  );

  if (exactPrice) {
    return exactPrice;
  }

  if (cycle === "six_months") {
    return {
      billing_cycle: cycle,
      billing_months: 6,
      list_price: plan.monthly_price * 6,
      discount_percent: plan.six_month_discount,
      final_price: plan.six_month_price,
      currency: plan.currency,
    };
  }

  if (cycle === "annual") {
    return {
      billing_cycle: cycle,
      billing_months: 12,
      list_price: plan.monthly_price * 12,
      discount_percent: plan.yearly_discount,
      final_price: plan.yearly_price,
      currency: plan.currency,
    };
  }

  return {
    billing_cycle: cycle,
    billing_months: 1,
    list_price: plan.monthly_price,
    discount_percent: 0,
    final_price: plan.monthly_price,
    currency: plan.currency,
  };
};

const getPlanLimit = (
  plan: SubscriptionPlan,
  limitKey: string,
) =>
  plan.limits.find((limit) => limit.limit_key === limitKey);

const formatLimit = (limit?: PlanLimit) => {
  if (!limit) {
    return "Not specified";
  }

  if (limit.is_unlimited) {
    return "Unlimited";
  }

  if (limit.value === null) {
    return "Not specified";
  }

  const value = formatCompactNumber(limit.value);

  return limit.unit ? `${value} ${limit.unit}` : value;
};

const normalizeTenantId = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "tenant_id" in value &&
    typeof (value as { tenant_id?: unknown }).tenant_id === "string"
  ) {
    return (value as { tenant_id: string }).tenant_id;
  }

  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value[0] &&
    typeof value[0] === "object" &&
    "tenant_id" in value[0] &&
    typeof (value[0] as { tenant_id?: unknown }).tenant_id ===
      "string"
  ) {
    return (value[0] as { tenant_id: string }).tenant_id;
  }

  return null;
};

const Field = memo(function Field({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  icon,
  required,
  minLength,
  error,
  onBlur,
  showToggle,
  showPassword,
  onTogglePassword,
  iconWidth = "normal",
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon?: ReactNode;
  required?: boolean;
  minLength?: number;
  error?: string;
  onBlur?: () => void;
  showToggle?: boolean;
  showPassword?: boolean;
  onTogglePassword?: () => void;
  iconWidth?: "normal" | "wide";
}) {
  return (
    <div className="space-y-2">
      <Label
        htmlFor={id}
        className="text-xs font-black text-foreground"
      >
        {label}

        {required ? (
          <span className="ml-1 text-rose-600">*</span>
        ) : null}
      </Label>

      <div className="relative">
        {icon ? (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </div>
        ) : null}

        <Input
          id={id}
          type={showToggle && showPassword ? "text" : type}
          required={required}
          minLength={minLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={
            id === "signup-email"
              ? "email"
              : id === "signup-password" ||
                  id === "confirm-password"
                ? "new-password"
                : undefined
          }
          className={[
            "h-11 rounded-lg border-border bg-background text-sm font-medium shadow-none placeholder:text-muted-foreground focus:border-transparent focus:outline-none",
            icon ? (iconWidth === "wide" ? "pl-20" : "pl-10") : "",
            showToggle ? "pr-10" : "",
            error ? "border-rose-500" : "",
          ].join(" ")}
        />

        {showToggle && onTogglePassword && (
          <button
            type="button"
            onClick={onTogglePassword}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs font-medium text-rose-600">{error}</p>
      )}
    </div>
  );
});

function BrandPanel({
  step,
}: {
  step: SignupStep;
}) {
  const stepContent = [
    {
      title: "Secure account",
      text: "Create the identity that will own and administer the workspace.",
    },
    {
      title: "Business profile",
      text: "Register the operating organization and primary business details.",
    },
    {
      title: "Commercial edition",
      text: "Choose the modules, capacity and billing commitment required.",
    },
    {
      title: "Activation method",
      text: "Confirm the payment method and continue to secure activation.",
    },
  ];

  return (
    <section className="relative hidden min-h-[720px] overflow-hidden rounded-[24px] bg-blue-600 px-10 py-12 text-white lg:block">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(37,99,235,0.28),transparent_32%),radial-gradient(circle_at_90%_80%,rgba(6,182,212,0.16),transparent_30%)]" />

      <div className="relative mx-auto max-w-xl">
        <Link to="/" className="inline-flex items-center gap-3">
          <img
            src="/shopcore-icon.png"
            alt="ShopCore"
            className="h-11 w-11 object-contain"
          />

          <div>
            <p className="text-lg font-black leading-none">
              ShopCore
            </p>

            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-blue-100/70">
              Enterprise Business Operating System
            </p>
          </div>
        </Link>

        <div className="mt-14">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
            Workspace registration
          </p>

          <h1 className="mt-4 max-w-lg text-4xl font-black tracking-[-0.04em]">
            Establish your operating workspace.
          </h1>

          <p className="mt-5 max-w-md text-sm font-medium leading-7 text-blue-100/75">
            Register the organization, select a commercial edition,
            and complete controlled subscription activation.
          </p>
        </div>

        <div className="mt-12 space-y-3">
          {stepContent.map((item, index) => {
            const itemStep = (index + 1) as SignupStep;
            const active = itemStep === step;
            const complete = itemStep < step;

            return (
              <div
                key={item.title}
                className={[
                  "flex items-start gap-4 rounded-2xl border p-4 transition",
                  active
                    ? "border-cyan-300/40 bg-white/10"
                    : complete
                      ? "border-emerald-300/20 bg-emerald-400/5"
                      : "border-white/10 bg-white/[0.03]",
                ].join(" ")}
              >
                <div
                  className={[
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-black",
                    complete
                      ? "border-emerald-400 bg-emerald-500 text-white"
                      : active
                        ? "border-cyan-300 bg-cyan-400 text-slate-950"
                        : "border-white/20 text-white/60",
                  ].join(" ")}
                >
                  {complete ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    itemStep
                  )}
                </div>

                <div>
                  <p className="text-sm font-black text-white">
                    {item.title}
                  </p>

                  <p className="mt-1 text-xs font-medium leading-5 text-blue-100/65">
                    {item.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
          <div className="flex h-28 items-end gap-2 rounded-xl bg-black/10 px-3 py-4">
            {chartBars.map((height, index) => (
              <div
                key={index}
                className="flex flex-1 flex-col justify-end"
              >
                <div
                  className="rounded-t-sm bg-cyan-300/80"
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
                  key={item.label}
                  className="rounded-xl border border-white/10 bg-white/[0.06] p-2"
                >
                  <div
                    className={[
                      "mb-2 flex h-7 w-7 items-center justify-center rounded-lg text-white",
                      item.tone,
                    ].join(" ")}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>

                  <p className="truncate text-[10px] font-black text-white/80">
                    {item.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Signup() {
  const { user, loading } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialPlan = searchParams.get("plan");
  const initialBilling = searchParams.get("billing");

  const [isLoading, setIsLoading] = useState(false);
  const [onboardingInProgress, setOnboardingInProgress] =
    useState(false);
  const [signupStep, setSignupStep] = useState<SignupStep>(1);

  const [displayName, setDisplayName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessLocation, setBusinessLocation] = useState("");
  const [businessType, setBusinessType] =
    useState("Retail Store");
  const [teamSize, setTeamSize] = useState("1-5");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateNameField = (value: string): string => {
    if (!value.trim()) return "";
    if (value.trim().length < 3) {
      return t("validation.nameMinLength");
    }
    // Allow only letters, spaces, hyphens, and apostrophes for names
    const validPattern = /^[a-zA-Z\s\-'\u00C0-\u017F]+$/;
    if (!validPattern.test(value)) {
      return t("validation.nameInvalidChars");
    }
    return "";
  };

  const validateEmailField = (value: string): string => {
    if (!value.trim()) return "";
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(value)) {
      return t("validation.emailInvalid");
    }
    return "";
  };

  const validatePhoneField = (value: string): string => {
    if (!value.trim()) return "";
    // Allow digits, spaces, hyphens for local number (without country code)
    const phonePattern = /^[0-9\s\-]+$/;
    if (!phonePattern.test(value)) {
      return t("validation.phoneInvalidChars");
    }
    // Check if the number (after removing non-digits) has 9 digits (Rwanda local number)
    const digitsOnly = value.replace(/\D/g, '');
    if (digitsOnly.length !== 9) {
      return t("validation.phoneRwandaFormat");
    }
    return "";
  };

  const validateLocationField = (value: string): string => {
    if (!value.trim()) return "";
    // Allow letters, numbers, spaces, commas, periods, and hyphens for locations
    const locationPattern = /^[a-zA-Z0-9\s,\.\-\u00C0-\u017F]+$/;
    if (!locationPattern.test(value)) {
      return t("validation.locationInvalidChars");
    }
    return "";
  };

  const validatePasswordField = (value: string): string => {
    if (!value) return "";
    if (value.length < 8) {
      return t("validation.passwordMinLength");
    }
    if (!/[A-Z]/.test(value)) {
      return t("validation.passwordUppercase");
    }
    if (!/[0-9]/.test(value)) {
      return t("validation.passwordNumber");
    }
    if (!/[^A-Za-z0-9]/.test(value)) {
      return t("validation.passwordSymbol");
    }
    return "";
  };

  const validateConfirmPasswordField = (value: string, password: string): string => {
    if (!value) return "";
    if (value !== password) {
      return t("validation.passwordMismatch");
    }
    return "";
  };

  const handleDisplayNameChange = (value: string) => {
    const error = validateNameField(value);
    setFieldErrors(prev => ({ ...prev, displayName: error }));
    setDisplayName(value);
  };

  const handleDisplayNameBlur = () => {
    const error = validateNameField(displayName);
    setFieldErrors(prev => ({ ...prev, displayName: error }));
  };

  const handleSignupEmailChange = (value: string) => {
    const error = validateEmailField(value);
    setFieldErrors(prev => ({ ...prev, signupEmail: error }));
    setSignupEmail(value);
  };

  const handleSignupEmailBlur = () => {
    const error = validateEmailField(signupEmail);
    setFieldErrors(prev => ({ ...prev, signupEmail: error }));
  };

  const handleSignupPasswordChange = (value: string) => {
    const error = validatePasswordField(value);
    setFieldErrors(prev => ({ ...prev, signupPassword: error }));
    setSignupPassword(value);
  };

  const handleSignupPasswordBlur = () => {
    const error = validatePasswordField(signupPassword);
    setFieldErrors(prev => ({ ...prev, signupPassword: error }));
  };

  const handleConfirmPasswordChange = (value: string) => {
    const error = validateConfirmPasswordField(value, signupPassword);
    setFieldErrors(prev => ({ ...prev, confirmPassword: error }));
    setConfirmPassword(value);
  };

  const handleConfirmPasswordBlur = () => {
    const error = validateConfirmPasswordField(confirmPassword, signupPassword);
    setFieldErrors(prev => ({ ...prev, confirmPassword: error }));
  };

  const handleBusinessNameChange = (value: string) => {
    const error = validateNameField(value);
    setFieldErrors(prev => ({ ...prev, businessName: error }));
    setBusinessName(value);
  };

  const handleBusinessNameBlur = () => {
    const error = validateNameField(businessName);
    setFieldErrors(prev => ({ ...prev, businessName: error }));
  };

  const handleBusinessPhoneChange = (value: string) => {
    const error = validatePhoneField(value);
    setFieldErrors(prev => ({ ...prev, businessPhone: error }));
    setBusinessPhone(value);
  };

  const handleBusinessPhoneBlur = () => {
    const error = validatePhoneField(businessPhone);
    setFieldErrors(prev => ({ ...prev, businessPhone: error }));
  };

  const formatPhoneNumberForStorage = (phone: string): string => {
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length === 9) {
      return `+250${digitsOnly}`;
    }
    return phone;
  };

  const handleBusinessLocationChange = (value: string) => {
    const error = validateLocationField(value);
    setFieldErrors(prev => ({ ...prev, businessLocation: error }));
    setBusinessLocation(value);
  };

  const handleBusinessLocationBlur = () => {
    const error = validateLocationField(businessLocation);
    setFieldErrors(prev => ({ ...prev, businessLocation: error }));
  };

  const [selectedPlan, setSelectedPlan] =
    useState<WorkspacePlan>(
      isWorkspacePlan(initialPlan)
        ? initialPlan
        : "starter",
    );

  const [selectedBillingCycle, setSelectedBillingCycle] =
    useState<BillingCycle>(
      isBillingCycle(initialBilling)
        ? initialBilling
        : "monthly",
    );

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("mobile_money");

  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const {
    data: catalogData,
    isLoading: plansLoading,
    isError: plansError,
  } = useQuery({
    queryKey: ["signup-subscription-plan-catalog"],
    queryFn: async () => {
      try {
        const { plans } = await workspaceApi.plans();
        return plans as unknown[];
      } catch (error) {
        console.error("Error fetching subscription plans:", error);
        return [];
      }
    },
  });

  const {
    data: availablePaymentMethods,
    isLoading: paymentMethodsLoading,
  } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: async () => {
      try {
        const { paymentMethods } = await workspaceApi.paymentMethods();
        return paymentMethods;
      } catch (error) {
        console.error("Error fetching payment methods:", error);
        return [];
      }
    },
  });

  const plans = (catalogData ?? [])
    .map(normalisePlan)
    .filter(Boolean) as SubscriptionPlan[];

  const sortedPlans = useMemo(
    () =>
      (catalogData?.length ? catalogData : [])
        .slice()
        .sort(
          (first: any, second: any) =>
            (first.display_order ?? 0) - (second.display_order ?? 0),
        ),
    [catalogData],
  );

  const selectedPackage = useMemo(
    () =>
      plans.find((plan) => plan.code === selectedPlan) ??
      plans[1] ??
      plans[0],
    [plans, selectedPlan],
  );

  const selectedPrice = useMemo(
    () =>
      getPlanPrice(
        selectedPackage,
        selectedBillingCycle,
      ),
    [selectedPackage, selectedBillingCycle],
  );

  const passwordScore = useMemo(() => {
    let score = 0;

    if (signupPassword.length >= 8) score += 1;
    if (/[A-Z]/.test(signupPassword)) score += 1;
    if (/[0-9]/.test(signupPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(signupPassword)) score += 1;

    return score;
  }, [signupPassword]);

  const passwordLabel =
    passwordScore >= 4
      ? "Strong"
      : passwordScore >= 3
        ? "Good"
        : "Weak";

  useEffect(() => {
    const updated = new URLSearchParams(searchParams);

    updated.set("plan", selectedPlan);
    updated.set("billing", selectedBillingCycle);

    if (updated.toString() !== searchParams.toString()) {
      setSearchParams(updated, {
        replace: true,
      });
    }
  }, [
    searchParams,
    selectedBillingCycle,
    selectedPlan,
    setSearchParams,
  ]);

  if (
    !loading &&
    user &&
    !onboardingInProgress &&
    !isLoading
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  const canContinueSignup = () => {
    if (signupStep === 1) {
      const hasErrors = Boolean(
        fieldErrors.displayName ||
        fieldErrors.signupEmail ||
        fieldErrors.signupPassword ||
        fieldErrors.confirmPassword
      );
      const hasValues = Boolean(
        displayName.trim() &&
          signupEmail.trim() &&
          signupPassword &&
          confirmPassword,
      );
      return !hasErrors && hasValues;
    }

    if (signupStep === 2) {
      const hasErrors = Boolean(
        fieldErrors.businessName ||
        fieldErrors.businessPhone ||
        fieldErrors.businessLocation
      );
      const hasValues = Boolean(
        businessName.trim() &&
          businessPhone.trim() &&
          businessLocation.trim(),
      );
      return !hasErrors && hasValues;
    }

    if (signupStep === 3) {
      return Boolean(
        selectedPlan && selectedBillingCycle,
      );
    }

    return Boolean(acceptedTerms && paymentMethod);
  };

  const nextSignupStep = () => {
    if (!canContinueSignup()) {
      toast.error(
        "Complete the required information before continuing.",
      );
      return;
    }

    if (signupStep === 1) {
      if (signupPassword !== confirmPassword) {
        toast.error("Passwords do not match.");
        return;
      }

      if (passwordScore < 3) {
        toast.error(
          "Use a stronger password before continuing.",
        );
        return;
      }
    }

    setSignupStep(
      (current) =>
        Math.min(4, current + 1) as SignupStep,
    );
  };

  const previousSignupStep = () => {
    setSignupStep(
      (current) =>
        Math.max(1, current - 1) as SignupStep,
    );
  };

  const handleSignup = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (isLoading || onboardingInProgress) {
      return;
    }

    if (!acceptedTerms) {
      toast.error(
        "Accept the Terms and Privacy Policy to continue.",
      );
      return;
    }

    if (signupPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    if (passwordScore < 3) {
      toast.error("Please use a stronger password.");
      return;
    }

    const normalizedEmail = signupEmail
      .trim()
      .toLowerCase();

    setIsLoading(true);
    setOnboardingInProgress(true);

    try {
      /*
       * The new backend creates the account, the workspace/tenant, and the
       * subscription record in one synchronous call - no email-confirmation
       * gap to bridge across page loads, and no separate "pending upgrade
       * request" write for paid plans (the approval workflow itself is
       * deferred to a later phase; subscriptions are created pre-approved).
       * display_name/businessPhone are still AES-encrypted client-side
       * exactly as before - the backend only ever sees/stores ciphertext.
       */
      const { tenantId } = await authApi.signup({
        email: normalizedEmail,
        password: signupPassword,
        displayName: encryptData(displayName.trim()),
        businessName: businessName.trim(),
        businessPhone: formatPhoneNumberForStorage(businessPhone.trim()),
        businessLocation: businessLocation.trim(),
        businessType,
        teamSize,
        language,
        planCode: selectedPlan,
        billingCycle: selectedBillingCycle,
        paymentMethod,
      });

      sessionStorage.setItem(
        "shopcore_pending_payment_tenant_id",
        tenantId,
      );

      sessionStorage.setItem(
        "shopcore_pending_payment_route",
        `/onboarding/payment/${tenantId}`,
      );

      sessionStorage.setItem(
        "shopcore_pending_payment_plan",
        selectedPlan,
      );

      sessionStorage.setItem(
        "shopcore_pending_payment_billing_cycle",
        selectedBillingCycle,
      );

      sessionStorage.setItem(
        "shopcore_pending_payment_method",
        paymentMethod,
      );

      toast.success(
        "Workspace created successfully. You can start using the free plan."
      );

      // Always redirect to dashboard since all users get free plan
      navigate("/dashboard", {
        replace: true,
        state: {
          fromSignup: true,
          selectedPlan,
          requestedPlanUpgrade: selectedPlan !== "starter",
          tenantId,
        },
      });
    } catch (error: any) {
      console.error(
        "Signup or workspace provisioning failed:",
        error,
      );

      toast.error(
        error?.message ||
          "The account or workspace could not be created.",
        {
          duration: 10000,
        },
      );
    } finally {
      setIsLoading(false);
      setOnboardingInProgress(false);
    }
  };

  const previewFeatures = selectedPackage?.features
    ?.filter(
      (feature) =>
        feature.access_level !== "unavailable",
    )
    ?.sort(
      (first, second) =>
        Number(second.is_highlighted) -
        Number(first.is_highlighted),
    )
    ?.slice(0, 6) || [];

  const selectedSavings = Math.max(
    selectedPrice.list_price -
      selectedPrice.final_price,
    0,
  );

  return (
    <main className="shopcore-theme-scope min-h-screen bg-background text-foreground px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-[1440px] items-center justify-center">
        <div className="w-full overflow-hidden rounded-[30px] border border-border bg-card shadow-[0_35px_110px_-55px_rgba(15,23,42,0.75)]">
          <div className="flex h-14 items-center justify-between border-b border-border bg-card px-5 sm:px-7">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-rose-500" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
            </div>

            <div className="hidden items-center gap-2 rounded-lg border border-border bg-muted px-4 py-2 text-[11px] font-bold text-muted-foreground md:flex">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Secure workspace registration
            </div>

            <div className="flex items-center gap-4">
              <LanguageSelector compact />
              <ThemeToggle />
              <Link
                to="/"
                className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground transition hover:text-foreground"
              >
                Home
              </Link>
            </div>
          </div>

          <div className="grid gap-6 p-5 lg:grid-cols-[0.9fr_1.1fr] lg:p-7">
            <BrandPanel step={signupStep} />

            <section className="min-h-[720px] rounded-[24px] border border-border bg-card px-4 py-8 sm:px-8 lg:px-10">
              <div className="mx-auto w-full max-w-[760px]">
                <div className="flex items-center justify-between gap-4">
                  <Link
                    to="/"
                    className="inline-flex items-center gap-3"
                  >
                    <img
                      src="/shopcore-icon.png"
                      alt="ShopCore"
                      className="h-11 w-11 object-contain"
                    />

                    <div>
                      <p className="text-lg font-black leading-tight text-foreground">
                        ShopCore
                      </p>

                      <p className="text-xs font-semibold text-muted-foreground">
                        Enterprise Business OS
                      </p>
                    </div>
                  </Link>

                  <span className="rounded-full border border-border bg-muted px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-muted-foreground">
                    Step {signupStep} of 4
                  </span>
                </div>

                <div className="mt-8">
                  <h1 className="text-3xl font-black tracking-[-0.035em] text-foreground">
                    {signupStep === 1
                      ? "Create your account"
                      : signupStep === 2
                        ? "Register the business"
                        : signupStep === 3
                          ? "Select your edition"
                          : "Review and continue"}
                  </h1>

                  <p className="mt-3 text-sm font-medium leading-6 text-muted-foreground">
                    {signupStep === 1
                      ? "Establish the primary workspace owner and secure login credentials."
                      : signupStep === 2
                        ? "Provide the operating details used to provision the tenant workspace."
                        : signupStep === 3
                          ? "Choose the modules, capacity and payment commitment that fit the business."
                          : "Confirm the subscription and preferred activation payment method."}
                  </p>
                </div>

                <div className="mt-7 grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      className={[
                        "h-1.5 rounded-full transition",
                        signupStep >= step
                          ? "bg-blue-600"
                          : "bg-muted",
                      ].join(" ")}
                    />
                  ))}
                </div>

                <form
                  onSubmit={handleSignup}
                  className="mt-8 space-y-6"
                >
                  {signupStep === 1 ? (
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Field
                          id="display-name"
                          label="Full name"
                          type="text"
                          value={displayName}
                          onChange={handleDisplayNameChange}
                          onBlur={handleDisplayNameBlur}
                          placeholder="Enter your full name"
                          icon={<Users className="h-4 w-4" />}
                          required
                          error={fieldErrors.displayName}
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <Field
                          id="signup-email"
                          label="Email address"
                          type="email"
                          value={signupEmail}
                          onChange={handleSignupEmailChange}
                          onBlur={handleSignupEmailBlur}
                          placeholder="Enter your email address"
                          icon={<Mail className="h-4 w-4" />}
                          required
                          error={fieldErrors.signupEmail}
                        />
                      </div>

                      <Field
                        id="signup-password"
                        label="Password"
                        type="password"
                        value={signupPassword}
                        onChange={handleSignupPasswordChange}
                        onBlur={handleSignupPasswordBlur}
                        placeholder="Minimum 8 characters"
                        icon={
                          <LockKeyhole className="h-4 w-4" />
                        }
                        required
                        minLength={8}
                        showToggle
                        showPassword={showPassword}
                        onTogglePassword={() => setShowPassword(!showPassword)}
                        error={fieldErrors.signupPassword}
                      />

                      <Field
                        id="confirm-password"
                        label="Confirm password"
                        type="password"
                        value={confirmPassword}
                        onChange={handleConfirmPasswordChange}
                        onBlur={handleConfirmPasswordBlur}
                        placeholder="Repeat your password"
                        icon={
                          <ShieldCheck className="h-4 w-4" />
                        }
                        required
                        minLength={8}
                        showToggle
                        showPassword={showConfirmPassword}
                        onTogglePassword={() => setShowConfirmPassword(!showConfirmPassword)}
                        error={fieldErrors.confirmPassword}
                      />

                      <div className="rounded-xl border border-border bg-muted p-4 sm:col-span-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-foreground">
                            Password security
                          </span>

                          <span
                            className={[
                              "text-xs font-black",
                              passwordScore >= 4
                                ? "text-emerald-700"
                                : passwordScore >= 3
                                  ? "text-blue-700"
                                  : "text-rose-700",
                            ].join(" ")}
                          >
                            {passwordLabel}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-4 gap-1.5">
                          {[1, 2, 3, 4].map((level) => (
                            <span
                              key={level}
                              className={[
                                "h-1.5 rounded-full",
                                passwordScore >= level
                                  ? "bg-blue-600"
                                  : "bg-muted",
                              ].join(" ")}
                            />
                          ))}
                        </div>

                        <p className="mt-3 text-xs font-medium leading-5 text-muted-foreground">
                          Use at least eight characters with an
                          uppercase letter, a number and a symbol.
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {signupStep === 2 ? (
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Field
                          id="business-name"
                          label="Business name"
                          type="text"
                          value={businessName}
                          onChange={handleBusinessNameChange}
                          onBlur={handleBusinessNameBlur}
                          placeholder="Enter the registered or trading name"
                          icon={<Store className="h-4 w-4" />}
                          required
                          error={fieldErrors.businessName}
                        />
                      </div>

                      <Field
                        id="business-phone"
                        label="Business phone"
                        type="tel"
                        value={businessPhone}
                        onChange={handleBusinessPhoneChange}
                        onBlur={handleBusinessPhoneBlur}
                        placeholder="788 123 456"
                        icon={
                          <div className="flex items-center gap-1">
                            <span className="text-sm">🇷🇼</span>
                            <span className="text-xs font-medium text-muted-foreground">+250</span>
                          </div>
                        }
                        required
                        error={fieldErrors.businessPhone}
                        iconWidth="wide"
                      />

                      <Field
                        id="business-location"
                        label="Business location"
                        type="text"
                        value={businessLocation}
                        onChange={handleBusinessLocationChange}
                        onBlur={handleBusinessLocationBlur}
                        placeholder="Kigali, Rwanda"
                        icon={<MapPin className="h-4 w-4" />}
                        required
                        error={fieldErrors.businessLocation}
                      />

                      <div className="space-y-2">
                        <Label
                          htmlFor="business-type"
                          className="text-xs font-black text-foreground"
                        >
                          Business type
                        </Label>

                        <select
                          id="business-type"
                          value={businessType}
                          onChange={(event) =>
                            setBusinessType(
                              event.target.value,
                            )
                          }
                          className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        >
                          <option>Retail Store</option>
                          <option>Supermarket</option>
                          <option>Pharmacy</option>
                          <option>Restaurant</option>
                          <option>Hardware</option>
                          <option>Wholesale</option>
                          <option>Distribution</option>
                          <option>Multi-branch Retail</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="team-size"
                          className="text-xs font-black text-foreground"
                        >
                          Team size
                        </Label>

                        <select
                          id="team-size"
                          value={teamSize}
                          onChange={(event) =>
                            setTeamSize(event.target.value)
                          }
                          className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        >
                          <option>1-5</option>
                          <option>6-20</option>
                          <option>21-50</option>
                          <option>51-100</option>
                          <option>100+</option>
                        </select>
                      </div>
                    </div>
                  ) : null}

                  {signupStep === 3 ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-3 rounded-xl border border-border bg-muted p-1.5">
                        {billingCycles.map((cycle) => {
                          const selected =
                            cycle.value ===
                            selectedBillingCycle;

                          return (
                            <button
                              key={cycle.value}
                              type="button"
                              onClick={() =>
                                setSelectedBillingCycle(
                                  cycle.value,
                                )
                              }
                              className={[
                                "rounded-lg px-2 py-2.5 text-center transition",
                                selected
                                  ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                                  : "text-muted-foreground hover:text-foreground",
                              ].join(" ")}
                            >
                              <span className="block text-xs font-black">
                                {cycle.compactLabel}
                              </span>

                              <span
                                className={[
                                  "mt-1 block text-[9px] font-black uppercase tracking-wide",
                                  cycle.discount > 0
                                    ? "text-emerald-700"
                                    : "text-muted-foreground",
                                ].join(" ")}
                              >
                                {cycle.discount > 0
                                  ? `Save ${cycle.discount}%`
                                  : "Flexible"}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {plansLoading ? (
                        <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs font-semibold text-blue-700">
                          Loading the current commercial
                          catalog…
                        </div>
                      ) : null}

                      {plansError ? (
                        <div className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs font-semibold text-orange-700">
                          <CircleMinus className="h-4 w-4 shrink-0" />
                          Live pricing could not be refreshed.
                          Verified package values are displayed.
                        </div>
                      ) : null}

                      <div className="grid gap-4 md:grid-cols-2">
                        {/* Add "Free Plan" option first */}
                        <button
                          type="button"
                          onClick={() => setSelectedPlan("none")}
                          className={[
                            "relative rounded-2xl border p-4 text-left transition",
                            selectedPlan === "none"
                              ? "border-blue-600 bg-blue-50/70 ring-2 ring-blue-100"
                              : "border-border bg-card hover:border-border hover:bg-muted",
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-black text-foreground">
                                  Free Plan
                                </p>
                                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-green-700">
                                  Default - Auto Approved
                                </span>
                              </div>
                              <p className="mt-2 text-xs font-medium leading-5 text-muted-foreground">
                                Start immediately with basic features. Upgrade anytime.
                              </p>
                            </div>
                            {selectedPlan === "none" && (
                              <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0" />
                            )}
                          </div>
                        </button>

                        {plans.map((plan) => {
                          const selected =
                            selectedPlan === plan.code;
                          const price = getPlanPrice(
                            plan,
                            selectedBillingCycle,
                          );
                          const previewFeatures =
                            plan.features
                              .filter(
                                (feature) =>
                                  feature.access_level !==
                                  "unavailable",
                              )
                              .sort(
                                (first, second) =>
                                  Number(
                                    second.is_highlighted,
                                  ) -
                                  Number(
                                    first.is_highlighted,
                                  ),
                              )
                              .slice(0, 4);

                          return (
                            <button
                              key={plan.code}
                              type="button"
                              onClick={() =>
                                setSelectedPlan(plan.code)
                              }
                              className={[
                                "relative rounded-2xl border p-4 text-left transition",
                                selected
                                  ? "border-blue-600 bg-blue-50/70 ring-2 ring-blue-100"
                                  : "border-border bg-card hover:border-border hover:bg-muted",
                              ].join(" ")}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-black text-foreground">
                                      {plan.name}
                                    </p>

                                    {plan.badge_text ? (
                                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-700">
                                        {plan.badge_text}
                                      </span>
                                    ) : null}
                                  </div>

                                  <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">
                                    {
                                      plan.short_description
                                    }
                                  </p>
                                </div>

                                <div
                                  className={[
                                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                                    selected
                                      ? "border-blue-600 bg-blue-600 text-white"
                                      : "border-border bg-card text-transparent",
                                  ].join(" ")}
                                >
                                  <Check className="h-3 w-3" />
                                </div>
                              </div>

                              <div className="mt-4 flex flex-wrap items-end gap-2">
                                <p className="text-xl font-black tracking-tight text-foreground">
                                  {formatMoney(
                                    price.final_price,
                                    price.currency,
                                  )}
                                </p>

                                <p className="pb-0.5 text-[10px] font-bold text-muted-foreground">
                                  {selectedBillingCycle ===
                                  "monthly"
                                    ? "/ month"
                                    : selectedBillingCycle ===
                                        "six_months"
                                      ? "/ 6 months"
                                      : "/ year"}
                                </p>
                              </div>

                              {price.discount_percent > 0 ? (
                                <p className="mt-1 text-[10px] font-bold text-emerald-700">
                                  Save{" "}
                                  {formatMoney(
                                    price.list_price -
                                      price.final_price,
                                    price.currency,
                                  )}
                                </p>
                              ) : null}

                              <div className="mt-4 grid gap-2">
                                {previewFeatures.map(
                                  (feature) => (
                                    <span
                                      key={
                                        feature.feature_key
                                      }
                                      className="flex items-start gap-2 text-[11px] font-bold leading-4 text-foreground"
                                    >
                                      {feature.access_level ===
                                      "limited" ? (
                                        <CircleMinus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" />
                                      ) : (
                                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                      )}

                                      <span>
                                        {feature.name}
                                        {feature.display_note
                                          ? ` · ${feature.display_note}`
                                          : ""}
                                      </span>
                                    </span>
                                  ),
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {signupStep === 4 ? (
                    <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-border bg-muted p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-700">
                                Selected subscription
                              </p>

                              <h2 className="mt-2 text-xl font-black text-foreground">
                                {selectedPackage?.name || selectedPlan}
                              </h2>

                              <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">
                                {
                                  selectedPackage?.short_description || ""
                                }
                              </p>
                            </div>

                            <BadgeCheck className="h-6 w-6 shrink-0 text-emerald-600" />
                          </div>

                          <div className="mt-5 border-t border-border pt-5">
                            {selectedPrice.discount_percent >
                            0 ? (
                              <div className="mb-1 flex items-center gap-2">
                                <span className="text-xs font-bold text-muted-foreground line-through">
                                  {formatMoney(
                                    selectedPrice.list_price,
                                    selectedPrice.currency,
                                  )}
                                </span>

                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-800">
                                  Save{" "}
                                  {formatMoney(
                                    selectedSavings,
                                    selectedPrice.currency,
                                  )}
                                </span>
                              </div>
                            ) : null}

                            <p className="text-2xl font-black tracking-tight text-foreground">
                              {formatMoney(
                                selectedPrice.final_price,
                                selectedPrice.currency,
                              )}
                            </p>

                            <p className="mt-1 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                              <CalendarRange className="h-3.5 w-3.5" />
                              {
                                billingCycles.find(
                                  (cycle) =>
                                    cycle.value ===
                                    selectedBillingCycle,
                                )?.label
                              }
                            </p>
                          </div>

                          <div className="mt-5 grid grid-cols-2 gap-2">
                            {[
                              {
                                label: "Users",
                                value: formatLimit(
                                  getPlanLimit(
                                    selectedPackage,
                                    "users",
                                  ),
                                ),
                              },
                              {
                                label: "Branches",
                                value: formatLimit(
                                  getPlanLimit(
                                    selectedPackage,
                                    "branches",
                                  ),
                                ),
                              },
                              {
                                label: "Warehouses",
                                value: formatLimit(
                                  getPlanLimit(
                                    selectedPackage,
                                    "warehouses",
                                  ),
                                ),
                              },
                              {
                                label: "POS terminals",
                                value: formatLimit(
                                  getPlanLimit(
                                    selectedPackage,
                                    "pos_terminals",
                                  ),
                                ),
                              },
                            ].map((item) => (
                              <div
                                key={item.label}
                                className="rounded-xl border border-border bg-card p-3"
                              >
                                <p className="text-[9px] font-black uppercase tracking-wide text-muted-foreground">
                                  {item.label}
                                </p>

                                <p className="mt-1 text-xs font-black text-foreground">
                                  {item.value}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                          <p className="text-sm font-black text-foreground">
                            Controlled activation
                          </p>

                          <p className="mt-2 text-xs font-medium leading-5 text-blue-800">
                            The workspace will remain pending
                            until payment is securely confirmed or
                            an approved trial is granted.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <Label className="text-xs font-black text-foreground">
                            Preferred payment method
                          </Label>

                          <div className="mt-3 space-y-3">
                            {availablePaymentMethods?.map((method: any) => {
                              const selected =
                                paymentMethod === method.code;

                              return (
                                <button
                                  key={method.id}
                                  type="button"
                                  onClick={() =>
                                    setPaymentMethod(
                                      method.code,
                                    )
                                  }
                                  className={[
                                    "flex w-full items-start justify-between gap-3 rounded-xl border p-4 text-left transition",
                                    selected
                                      ? "border-blue-600 bg-blue-50"
                                      : "border-border bg-card hover:border-border hover:bg-muted",
                                  ].join(" ")}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold">
                                        {method.name}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {method.description}
                                      </p>
                                    </div>
                                  </div>
                                  {selected && (
                                    <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-4">
                          <input
                            type="checkbox"
                            checked={acceptedTerms}
                            onChange={(event) =>
                              setAcceptedTerms(
                                event.target.checked,
                              )
                            }
                            className="mt-1 h-4 w-4 rounded border-border text-blue-600"
                          />

                          <span className="text-xs font-medium leading-5 text-foreground">
                            I agree to the ShopCore{" "}
                            <Link
                              to="/terms"
                              className="font-black text-foreground hover:underline"
                            >
                              Terms
                            </Link>{" "}
                            and{" "}
                            <Link
                              to="/privacy"
                              className="font-black text-foreground hover:underline"
                            >
                              Privacy Policy
                            </Link>
                            .
                          </span>
                        </label>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row">
                    {signupStep > 1 ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 rounded-xl border-border px-6 text-sm font-black text-foreground"
                        disabled={isLoading}
                        onClick={previousSignupStep}
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                      </Button>
                    ) : null}

                    {signupStep < 4 ? (
                      <Button
                        type="button"
                        className="h-12 flex-1 rounded-xl bg-blue-600 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={nextSignupStep}
                        disabled={!canContinueSignup() || isLoading}
                      >
                        Continue
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        className="h-12 flex-1 rounded-xl bg-blue-600 text-sm font-black text-white hover:bg-blue-700"
                        disabled={
                          isLoading ||
                          onboardingInProgress
                        }
                      >
                        {isLoading
                          ? "Preparing workspace..."
                          : "Create workspace and continue"}

                        {!isLoading ? (
                          <ArrowRight className="ml-2 h-4 w-4" />
                        ) : null}
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
                    <p className="text-xs font-medium text-muted-foreground">
                      Already registered?
                    </p>

                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto p-0 text-xs font-black text-foreground hover:bg-transparent hover:text-blue-700"
                      disabled={isLoading}
                      onClick={() => navigate("/auth")}
                    >
                      Sign in to your workspace
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </form>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}