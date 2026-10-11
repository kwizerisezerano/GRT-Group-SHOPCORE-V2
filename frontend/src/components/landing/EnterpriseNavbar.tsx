import { Link, useLocation } from "react-router-dom";
import {
  AppWindow,
  Boxes,
  ChevronDown,
  FileText,
  Headphones,
  Menu,
  ReceiptText,
  Scale,
  ShieldCheck,
  WifiOff,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LanguageSelector } from "@/components/settings/LanguageSelector";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
import { useLanguage } from "@/contexts/LanguageContext";

const platformItems = [
  {
    labelKey: "publicNav.workspace",
    descriptionKey: "publicNav.workspaceDescription",
    to: "/landing/command-center",
    id: "command-center",
    icon: AppWindow,
  },
  {
    labelKey: "publicNav.modules",
    descriptionKey: "publicNav.modulesDescription",
    to: "/landing/modules",
    id: "modules",
    icon: Boxes,
  },
  {
    labelKey: "publicNav.offline",
    descriptionKey: "publicNav.offlineDescription",
    to: "/landing/offline",
    id: "offline",
    icon: WifiOff,
  },
  {
    labelKey: "publicNav.ebm",
    descriptionKey: "publicNav.ebmDescription",
    to: "/landing/ebm",
    id: "ebm",
    icon: ReceiptText,
  },
];

const directNavItems = [
  { labelKey: "publicNav.security", to: "/landing/security", id: "security" },
  { labelKey: "publicNav.pricing", to: "/landing/pricing", id: "pricing" },
];

const navItems = [...platformItems, ...directNavItems];

const trustLinks = [
  {
    labelKey: "publicNav.privacyCenter",
    descriptionKey: "publicNav.privacyDescription",
    to: "/privacy",
    icon: ShieldCheck,
  },
  {
    labelKey: "publicNav.terms",
    descriptionKey: "publicNav.termsDescription",
    to: "/terms",
    icon: Scale,
  },
  {
    labelKey: "publicNav.supportCenter",
    descriptionKey: "publicNav.supportDescription",
    to: "/support-center",
    icon: Headphones,
  },
];

export default function EnterpriseNavbar() {
  const { t } = useLanguage();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [platformOpen, setPlatformOpen] = useState(false);
  const [trustOpen, setTrustOpen] = useState(false);

  // Derive active section from current pathname
  const activeSection = location.pathname.replace('/landing/', '') || 'hero';

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-[1600px] items-center px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-3">
          <img
            src="/shopcore-icon.png"
            alt="ShopCore"
            className="h-12 w-12 object-contain"
          />

          <div className="leading-tight">
            <p className="text-xl font-extrabold tracking-tight text-foreground">
              ShopCore
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Enterprise Business OS
            </p>
          </div>
        </Link>

        <nav className="ml-8 hidden items-center gap-1 xl:flex">
          <div
            className="relative"
            onMouseEnter={() => setPlatformOpen(true)}
            onMouseLeave={() => setPlatformOpen(false)}
          >
            <button
              type="button"
              onClick={() => setPlatformOpen((value) => !value)}
              aria-expanded={platformOpen}
              className={[
                "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition",
                platformItems.some((item) => item.id === activeSection)
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              ].join(" ")}
            >
              {t("publicNav.platform")}
              <ChevronDown
                className={[
                  "h-4 w-4 transition-transform",
                  platformOpen ? "rotate-180" : "",
                ].join(" ")}
              />
            </button>

            {platformOpen ? (
              <div className="absolute left-0 top-full z-50 w-[480px] pt-3">
                <div className="rounded-3xl border border-border bg-popover p-3 text-popover-foreground shadow-2xl shadow-slate-900/10">
                  <div className="grid grid-cols-2 gap-1">
                    {platformItems.map((item) => {
                      const Icon = item.icon;
                      const active = activeSection === item.id;

                      return (
                        <Link
                          key={item.id}
                          to={item.to}
                          onClick={() => setPlatformOpen(false)}
                          className={[
                            "flex gap-3 rounded-2xl p-3.5 transition",
                            active
                              ? "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200"
                              : "text-popover-foreground hover:bg-muted",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                              active
                                ? "bg-blue-600 text-white dark:bg-blue-500"
                                : "bg-muted text-muted-foreground",
                            ].join(" ")}
                          >
                            <Icon className="h-5 w-5" />
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-black truncate">
                              {t(item.labelKey)}
                            </span>
                            <span className="mt-1 block text-xs font-medium leading-4 text-muted-foreground line-clamp-2">
                              {t(item.descriptionKey)}
                            </span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {directNavItems.map((item) => {
            const active = activeSection === item.id;

            return (
              <Link
                key={item.id}
                to={item.to}
                className={[
                  "rounded-full px-4 py-2 text-sm font-bold transition",
                  active
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                ].join(" ")}
              >
                {t(item.labelKey)}
              </Link>
            );
          })}

          <div
            className="relative"
            onMouseEnter={() => setTrustOpen(true)}
            onMouseLeave={() => setTrustOpen(false)}
          >
            <button
              type="button"
              onClick={() => setTrustOpen((value) => !value)}
              className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {t("publicNav.trustCenter")}
              <ChevronDown className="h-4 w-4" />
            </button>

            {trustOpen ? (
              <div className="absolute right-0 top-full z-50 w-[360px] pt-3">
                <div className="rounded-3xl border border-border bg-popover p-3 text-popover-foreground shadow-2xl shadow-slate-900/10">
                  <div className="border-b border-border px-3 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <p className="text-sm font-black text-popover-foreground">
                        ShopCore Trust Center
                      </p>
                    </div>
                    <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">
                      {t("publicNav.trustDescription")}
                    </p>
                  </div>

                  <div className="mt-2 space-y-1">
                    {trustLinks.map((item) => {
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.labelKey}
                          to={item.to}
                          onClick={() => setTrustOpen(false)}
                          className="flex gap-3 rounded-2xl p-3 transition hover:bg-muted"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200">
                            <Icon className="h-5 w-5" />
                          </span>

                          <span>
                            <span className="block text-sm font-black text-popover-foreground">
                              {t(item.labelKey)}
                            </span>
                            <span className="mt-1 block text-xs font-medium leading-5 text-muted-foreground">
                              {t(item.descriptionKey)}
                            </span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </nav>

        <div className="ml-auto hidden items-center gap-2.5 xl:flex">
          <LanguageSelector compact className="shrink-0" />
          <ThemeToggle className="shrink-0" />

          <div className="hidden items-center gap-2 whitespace-nowrap rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200 2xl:flex">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t("publicNav.enterpriseReady")}
          </div>

          <Button variant="ghost" size="sm" className="whitespace-nowrap" asChild>
            <Link to="/auth">{t("publicNav.login")}</Link>
          </Button>

          <Button
            size="sm"
            className="whitespace-nowrap bg-blue-600 px-4 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
            asChild
          >
            <Link to="/signup">{t("publicNav.startWorkspace")}</Link>
          </Button>
        </div>

        <button
          type="button"
          className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-card-foreground xl:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-label={t("publicNav.toggleNavigation")}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-border bg-background px-4 py-5 xl:hidden">
          <nav className="mx-auto max-w-3xl">
            <p className="px-2 pb-3 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
              {t("publicNav.platform")}
            </p>

            <div className="grid gap-2 sm:grid-cols-2">
              {platformItems.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;

                return (
                  <Link
                    key={item.id}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={[
                      "flex items-center gap-3 rounded-2xl border p-3 transition",
                      active
                        ? "border-blue-200 bg-blue-50 text-blue-800"
                        : "border-border text-foreground hover:bg-muted",
                    ].join(" ")}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-blue-700 shadow-sm dark:text-blue-300">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black truncate">
                        {t(item.labelKey)}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">
                        {t(item.descriptionKey)}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {directNavItems.map((item) => (
                <Link
                  key={item.id}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-border px-3 py-2.5 text-center text-sm font-black text-foreground transition hover:bg-muted"
                >
                  {t(item.labelKey)}
                </Link>
              ))}
            </div>

            <div className="my-3 border-t border-border pt-3">
              <p className="px-3 pb-2 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                {t("publicNav.trustCenter")}
              </p>

              {trustLinks.map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.labelKey}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-foreground transition hover:bg-muted"
                  >
                    <Icon className="h-4 w-4 text-blue-600" />
                    {t(item.labelKey)}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="mx-auto mt-4 grid max-w-3xl gap-2">
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-card p-3">
              <LanguageSelector className="min-w-0 flex-1 justify-between" />
              <ThemeToggle />
            </div>

            <Button variant="outline" asChild>
              <Link to="/auth">{t("publicNav.login")}</Link>
            </Button>

            <Button className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400" asChild>
              <Link to="/signup">{t("publicNav.startWorkspace")}</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </header>
  );
}
