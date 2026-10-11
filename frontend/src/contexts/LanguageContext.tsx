import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";
import { hasTranslation, translate } from "@/i18n";
import { readStoredLanguage, resolveBrowserLanguage, storeLanguage } from "@/i18n/storage";
import {
  LANGUAGE_LOCALES, SUPPORTED_LANGUAGES, type AppLanguage, type LocaleCode, type TranslationParams,
} from "@/i18n/types";
import { supabase } from "@/integrations/supabase/client";

const SUPPORTED_LANGUAGE_CODES = new Set(SUPPORTED_LANGUAGES.map((entry) => entry.code));

function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === "string" && SUPPORTED_LANGUAGE_CODES.has(value as AppLanguage);
}

type DateInput = Date | string | number | null | undefined;
type NumberInput = number | null | undefined;

type LanguageContextValue = {
  language: AppLanguage;
  locale: LocaleCode;
  setLanguage: (language: AppLanguage) => void;
  t: (key: string, params?: TranslationParams) => string;
  has: (key: string) => boolean;
  formatDate: (value: DateInput, options?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (value: DateInput, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: NumberInput, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (value: NumberInput, currency?: string, options?: Intl.NumberFormatOptions) => string;
  formatPercent: (value: NumberInput, options?: Intl.NumberFormatOptions) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);
const initialLanguage = (): AppLanguage =>
  readStoredLanguage() ?? resolveBrowserLanguage() ?? "en";

function asDate(value: DateInput) {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(initialLanguage);
  const locale = LANGUAGE_LOCALES[language];

  const setLanguage = useCallback((next: AppLanguage) => {
    setLanguageState(next);
    storeLanguage(next);

    supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user?.id;
      if (!userId) return;
      void (supabase as any).from("profiles").update({ language: next }).eq("id", userId);
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = "ltr";
    document.documentElement.dataset.language = language;
  }, [language, locale]);

  // An explicit local choice always wins and gets pushed up to the DB (this
  // also self-heals accounts whose profiles.language is still the 'en'
  // column default from before this existed). Only a browser/device with no
  // local choice at all pulls the language down from the DB.
  useEffect(() => {
    let cancelled = false;

    const reconcileWithProfile = async (userId: string) => {
      const localPreference = readStoredLanguage();

      if (localPreference) {
        void (supabase as any)
          .from("profiles")
          .update({ language: localPreference })
          .eq("id", userId)
          .neq("language", localPreference);
        return;
      }

      const { data } = await (supabase as any)
        .from("profiles")
        .select("language")
        .eq("id", userId)
        .maybeSingle();

      const profileLanguage = (data as { language?: string } | null)?.language;
      if (!cancelled && isAppLanguage(profileLanguage) && profileLanguage !== language) {
        setLanguageState(profileLanguage);
        storeLanguage(profileLanguage);
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user?.id;
      if (userId) void reconcileWithProfile(userId);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user?.id) {
        void reconcileWithProfile(session.user.id);
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
    // Runs once on mount (and on auth changes); `language` is read only to
    // avoid redundant state writes, not to re-trigger this sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const t = useCallback(
    (key: string, params?: TranslationParams) => translate(language, key, params),
    [language],
  );
  const has = useCallback((key: string) => hasTranslation(language, key), [language]);

  const formatDate = useCallback((value: DateInput, options?: Intl.DateTimeFormatOptions) => {
    const date = asDate(value);
    return date
      ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", ...options }).format(date)
      : t("common.notSet");
  }, [locale, t]);

  const formatDateTime = useCallback((value: DateInput, options?: Intl.DateTimeFormatOptions) => {
    const date = asDate(value);
    return date
      ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", ...options }).format(date)
      : t("common.notSet");
  }, [locale, t]);

  const formatNumber = useCallback(
    (value: NumberInput, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, options).format(Number(value || 0)),
    [locale],
  );

  const formatCurrency = useCallback(
    (value: NumberInput, currency = "RWF", options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        currencyDisplay: "code",
        maximumFractionDigits: currency === "RWF" ? 0 : 2,
        ...options,
      }).format(Number(value || 0)),
    [locale],
  );

  const formatPercent = useCallback(
    (value: NumberInput, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, {
        style: "percent",
        maximumFractionDigits: 1,
        ...options,
      }).format(Number(value || 0)),
    [locale],
  );

  const value = useMemo(() => ({
    language, locale, setLanguage, t, has,
    formatDate, formatDateTime, formatNumber, formatCurrency, formatPercent,
  }), [language, locale, setLanguage, t, has, formatDate, formatDateTime, formatNumber, formatCurrency, formatPercent]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useTranslation must be used inside LanguageProvider.");
  return value;
}

export const useLanguage = useTranslation;
