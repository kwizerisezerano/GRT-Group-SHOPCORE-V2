import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Headphones,
  Scale,
  ShieldCheck,
} from "lucide-react";
import TrustCommandDashboard from "./TrustCommandDashboard";
import { LanguageSelector } from "@/components/settings/LanguageSelector";
import { ThemeToggle } from "@/components/settings/ThemeToggle";

type PublicCenter = "trust" | "legal" | "success";

const centerStyles = {
  trust: {
    label: "Trust Center",
    eyebrow: "Trust framework",
    badge: "border-cyan-200 bg-cyan-50 text-cyan-700",
    accent: "text-cyan-700",
    darkButton: "bg-[#0B1220] hover:bg-[#111827]",
    icon: ShieldCheck,
  },
  legal: {
    label: "Legal Center",
    eyebrow: "Legal framework",
    badge: "border-violet-200 bg-violet-50 text-violet-700",
    accent: "text-violet-700",
    darkButton: "bg-[#161B26] hover:bg-[#1F2937]",
    icon: Scale,
  },
  success: {
    label: "Success Center",
    eyebrow: "Success framework",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    accent: "text-emerald-700",
    darkButton: "bg-[#111827] hover:bg-[#1F2937]",
    icon: Headphones,
  },
};

type PublicExperienceLayoutProps = {
  center: PublicCenter;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

const heroPoints = [
  "Enterprise governance",
  "Operational resilience",
  "Secure workspaces",
  "Platform intelligence",
];

export function PublicExperienceLayout({
  center,
  eyebrow,
  title,
  description,
  children,
}: PublicExperienceLayoutProps) {
  const style = centerStyles[center];
  const Icon = style.icon;

  return (
    <main className="shopcore-theme-scope min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <img
              src="/shopcore-icon.png"
              alt="ShopCore"
              className="h-11 w-11 object-contain"
            />

            <div>
              <p className="text-lg font-black leading-tight text-slate-950">
                ShopCore
              </p>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Enterprise Business OS
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 text-sm font-bold md:flex">
            <Link
              to="/privacy"
              className={[
                "rounded-full border px-4 py-2 transition",
                center === "trust"
                  ? style.badge
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100",
              ].join(" ")}
            >
              Trust
            </Link>

            <Link
              to="/terms"
              className={[
                "rounded-full border px-4 py-2 transition",
                center === "legal"
                  ? style.badge
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100",
              ].join(" ")}
            >
              Legal
            </Link>

            <Link
              to="/support-center"
              className={[
                "rounded-full border px-4 py-2 transition",
                center === "success"
                  ? style.badge
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100",
              ].join(" ")}
            >
              Success
            </Link>

            <LanguageSelector compact />
            <ThemeToggle />

            <Link
              to="/auth"
              className={[
                "rounded-full px-4 py-2 text-white transition",
                style.darkButton,
              ].join(" ")}
            >
              Sign in
            </Link>
          </nav>

          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Home
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:py-20">
          <div>
            <Link
              to="/"
              className="mb-8 hidden items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400 transition hover:text-slate-900 md:inline-flex"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Home
            </Link>

            <div
              className={[
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black",
                style.badge,
              ].join(" ")}
            >
              <Icon className="h-3.5 w-3.5" />
              {style.label}
            </div>

            <p className="mt-8 text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              {eyebrow || style.eyebrow}
            </p>

            <h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl lg:text-[44px] break-words">
              {title}
            </h1>

            <p className="mt-5 max-w-3xl text-base font-medium leading-8 text-slate-600 break-words">
              {description}
            </p>

            <div className="mt-7 flex flex-wrap gap-2">
              {heroPoints.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <TrustCommandDashboard center={center} />
          </div>
        </div>
      </section>

      <div>{children}</div>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/shopcore-icon.png"
              alt="ShopCore"
              className="h-10 w-10 object-contain"
            />

            <div>
              <p className="font-black text-slate-950">ShopCore</p>
              <p className="text-xs font-semibold text-slate-500">
                Enterprise Business Operating System
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm font-bold text-slate-500">
            <Link to="/privacy" className="hover:text-slate-950">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-slate-950">
              Terms
            </Link>
            <Link to="/support-center" className="hover:text-slate-950">
              Support
            </Link>
            <Link to="/auth" className="hover:text-slate-950">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

export function PublicSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              {eyebrow}
            </p>

            <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              {title}
            </h2>

            {description ? (
              <p className="mt-4 text-sm font-medium leading-7 text-slate-600 sm:text-base">
                {description}
              </p>
            ) : null}
          </div>

          <div>{children}</div>
        </div>
      </div>
    </section>
  );
}

export function PublicCard({
  icon: Icon,
  title,
  text,
  tone = "blue",
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  tone?: "blue" | "cyan" | "emerald" | "violet" | "orange";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    cyan: "bg-cyan-50 text-cyan-700 border-cyan-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div
        className={[
          "flex h-10 w-10 items-center justify-center rounded-xl border",
          tones[tone],
        ].join(" ")}
      >
        <Icon className="h-5 w-5" />
      </div>

      <h3 className="mt-5 text-lg font-black text-slate-950">{title}</h3>

      <p className="mt-3 text-sm font-medium leading-7 text-slate-600">
        {text}
      </p>
    </article>
  );
}
