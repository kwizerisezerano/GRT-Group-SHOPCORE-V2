import { memo, type ComponentType, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, type LucideProps } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSelector } from "@/components/settings/LanguageSelector";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { PoweredBy } from "@/components/AppFooter";

/**
 * The frame every signed-out screen sits in.
 *
 * Two panels. The left one says where you are and what is on the other side of
 * the form — an icon, a line of context, and two or three things worth knowing
 * before you type. The right one is the form and nothing else.
 *
 * ## Why a split rather than a centred card
 *
 * A lone form on an empty field gives a person no idea which product they are
 * signing into, what the account is for, or whether they are on the right
 * screen at all — and every one of these pages looks identical at a glance.
 * The context panel answers that in the place the eye lands first, and gives
 * each screen a distinct identity: signing in reads differently from entering
 * a six-digit code.
 *
 * ## Flat, not painted
 *
 * No gradients and no coloured panel. Both halves sit on the page background
 * and are separated by a single hairline, so the screen is the same surface in
 * light and in dark — dark mode in particular gets no special treatment, it is
 * just the theme background throughout.
 *
 * That is a deliberate reversal of an earlier pass that filled the left half
 * with a navy gradient. It looked striking and it fought the form: a saturated
 * block beside a white column pulls the eye away from the one thing the screen
 * exists for, and it meant maintaining a second set of colours that only
 * worked on that one surface.
 *
 * The panel is full-bleed to the viewport edge — no card, no rounded corners,
 * no outer margin — so the split reads as the page's structure rather than as
 * two boxes floating on it.
 *
 * Below `lg` the panel collapses to a compact header above the form, so a
 * phone gets the same context in two lines instead of losing it entirely.
 */

/** One labelled input, with room for a leading icon and a trailing control. */
export const AuthField = memo(function AuthField({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  icon,
  required,
  right,
  autoComplete,
  hint,
  disabled,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: ReactNode;
  required?: boolean;
  right?: ReactNode;
  autoComplete?: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[13px] font-semibold text-foreground">
        {label} {required && <span className="text-rose-500">*</span>}
      </Label>

      <div className="relative">
        {icon && (
          <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70">
            {icon}
          </div>
        )}

        <Input
          id={id}
          type={type}
          required={required}
          disabled={disabled}
          value={value}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={cn(
            "h-11 rounded-xl border-border bg-background text-[15px] font-medium text-foreground shadow-none transition",
            "placeholder:font-normal placeholder:text-muted-foreground/60",
            "focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10",
            icon && "pl-10",
            right && "pr-11",
          )}
        />

        {right}
      </div>

      {hint ? <p className="text-xs font-medium text-muted-foreground">{hint}</p> : null}
    </div>
  );
});

/** The heading above a form. */
export function AuthHeading({
  title,
  description,
  align = "left",
}: {
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
}) {
  return (
    <div className={cn(align === "center" && "text-center")}>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
      {description ? (
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

const BrandLockup = memo(function BrandLockup({
  compact,
  onPanel,
}: {
  compact?: boolean;
  /** On the coloured panel, where the page's own text colours would vanish. */
  onPanel?: boolean;
}) {
  const { t } = useLanguage();

  return (
    <Link to="/" className="flex items-center gap-2.5">
      <img
        src="/shopcore-icon.png"
        alt=""
        aria-hidden="true"
        className={cn("object-contain", compact ? "h-7 w-7" : "h-8 w-8")}
      />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "text-[15px] font-bold",
            onPanel ? "text-sidebar-primary" : "text-foreground",
          )}
        >
          ShopCore
        </span>
        {!compact && (
          <span
            className={cn(
              "mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em]",
              onPanel ? "text-sidebar-muted" : "text-muted-foreground",
            )}
          >
            {t("login.retailOperatingSystem")}
          </span>
        )}
      </span>
    </Link>
  );
});

/**
 * What the left panel says on this screen.
 *
 * Every signed-out page passes its own, because "sign in to reach your
 * workspace" and "we sent a code to your phone" are not the same reassurance —
 * and a panel that said the same thing on all six would be wallpaper.
 */
export type AuthAside = {
  /** The glyph in the tile. Sized and coloured by the panel. */
  icon: ComponentType<LucideProps>;
  eyebrow: string;
  title: string;
  description: string;
  /** Two or three short lines. Omit where the screen has nothing to add. */
  points?: string[];
};

function AsidePanel({ aside }: { aside: AuthAside }) {
  const Icon = aside.icon;

  return (
    /*
      Painted with the workspace's own sidebar palette.

      `--sidebar-background` is the deep brand blue in light mode and a near-
      black in dark mode, which is exactly what is wanted here: signing in
      should look like the product you are signing into, and a slab of bright
      blue in a dark room is the one thing a dark theme exists to avoid. Reusing
      the token rather than hard-coding two colours means the panel follows the
      workspace if that blue is ever retuned.
    */
    <aside className="hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
      {/*
        The brand is pinned to the top; everything else is one centred group.
        Pinning the footnote to the bottom too spread three short bands across
        900px and left two obvious voids — a column with nothing to fill it
        reads better dense and centred than stretched.
      */}
      <div className="px-10 pt-8 xl:px-14">
        <BrandLockup onPanel />
      </div>

      <div className="flex flex-1 items-center px-10 pb-16 xl:px-14">
        {/*
          Centred in the column and capped, so the left half mirrors the right
          about the divider. Flush against the outer edge, it read as two
          unrelated blocks rather than one split.
        */}
        <div className="mx-auto w-full max-w-[420px]">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sidebar-accent text-sidebar-primary">
            <Icon className="h-6 w-6" />
          </div>

          <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.16em] text-sidebar-primary">
            {aside.eyebrow}
          </p>

          <h2 className="mt-2.5 text-[30px] font-bold leading-[1.15] tracking-tight text-sidebar-primary">
            {aside.title}
          </h2>

          <p className="mt-4 text-[15px] leading-relaxed text-sidebar-muted">
            {aside.description}
          </p>

          {aside.points && aside.points.length > 0 && (
            <ul className="mt-8 space-y-3.5">
              {aside.points.map((point, index) => (
                <li
                  key={point}
                  className="flex animate-rise items-start gap-3"
                  /* Staggered so the list assembles rather than appearing. */
                  style={{ animationDelay: `${120 + index * 70}ms` }}
                >
                  <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
                    <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                  </span>
                  <span className="text-[14px] leading-snug text-sidebar-foreground">{point}</span>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-10 border-t border-sidebar-border pt-6 text-[13px] text-sidebar-muted">
            Built for Rwandan retail.
          </p>
        </div>
      </div>
    </aside>
  );
}

/** The same context, two lines, for the screens too narrow to show the panel. */
function AsideStrip({ aside }: { aside: AuthAside }) {
  const Icon = aside.icon;

  return (
    <div className="mb-7 flex items-center gap-3 rounded-xl border border-border p-3.5 lg:hidden">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>

      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-primary">
          {aside.eyebrow}
        </span>
        <span className="mt-0.5 block truncate text-[13px] font-semibold text-foreground">
          {aside.title}
        </span>
      </span>
    </div>
  );
}

/**
 * @param aside - The left panel's content. Omit it for the steps that need the
 * whole width (choosing a plan lays four cards side by side, and squeezing
 * them into half the viewport to make room for a paragraph is the wrong
 * trade).
 * @param width - "narrow" is a single form. "wide" is a full-width step.
 */
export function AuthShell({
  children,
  aside,
  width = "narrow",
  footer,
}: {
  children: ReactNode;
  aside?: AuthAside;
  width?: "narrow" | "wide";
  /** Replaces the default legal links, for flows with their own footer. */
  footer?: ReactNode;
}) {
  const { t } = useLanguage();
  const split = Boolean(aside) && width === "narrow";

  const legal = footer ?? (
    <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] font-medium text-muted-foreground">
      <Link to="/privacy" className="transition hover:text-foreground">
        {t("login.privacy")}
      </Link>
      <Link to="/terms" className="transition hover:text-foreground">
        {t("login.terms")}
      </Link>
      <Link to="/support-center" className="transition hover:text-foreground">
        {t("login.support")}
      </Link>
    </nav>
  );

  /* The right-hand column: the bar, then the form, centred. */
  const formColumn = (
    <div className="flex min-w-0 flex-col">
      <div className="flex items-center gap-3 px-5 pt-6 sm:px-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary transition hover:opacity-80"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("login.home")}
        </Link>

        <div className="ml-auto flex items-center gap-1.5">
          <LanguageSelector compact />
          <ThemeToggle />
        </div>
      </div>

      {/* On a phone the panel is not drawn, so the brand belongs here. */}
      {split && (
        <div className="mt-6 px-5 sm:px-10 lg:hidden">
          <BrandLockup />
        </div>
      )}

      <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
        <div
          className={cn(
            "w-full animate-rise",
            split ? "max-w-[440px]" : width === "wide" ? "max-w-5xl" : "max-w-[440px]",
          )}
        >
          {aside ? <AsideStrip aside={aside} /> : null}
          {children}
        </div>
      </div>
    </div>
  );

  const pageFooter = (
    <footer className="border-t border-border">
      <div
        className={cn(
          "mx-auto flex w-full flex-col items-center gap-3 px-5 py-5 sm:flex-row sm:justify-between sm:px-10",
          // Uncapped beside the panel, where the column is already half the
          // page; capped when the footer spans the whole width on its own.
          split ? "" : "max-w-6xl",
        )}
      >
        {legal}
        <PoweredBy />
      </div>
    </footer>
  );

  if (split) {
    return (
      <div className="shopcore-theme-scope grid min-h-screen bg-background text-foreground lg:grid-cols-2">
        <AsidePanel aside={aside!} />

        {/*
          The form and the footer share the right-hand column, so the panel
          beside them runs the full height of the page.
        */}
        <div className="flex min-h-screen min-w-0 flex-col">
          <div className="flex flex-1 flex-col">{formColumn}</div>
          {pageFooter}
        </div>
      </div>
    );
  }

  return (
    <div className="shopcore-theme-scope flex min-h-screen flex-col bg-background text-foreground">
      <div className="flex flex-1 flex-col">{formColumn}</div>
      {pageFooter}
    </div>
  );
}
