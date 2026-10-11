/**
 * ShopCore in-app design system.
 *
 * These primitives capture the layout language used by User Management —
 * the reference page every workspace screen is aligned to:
 *
 *   • one 1480px column, 5-unit vertical rhythm
 *   • a ghost-button toolbar with the single primary action pushed right
 *   • KPI cards carrying a filled, rounded-square icon tile in the card's
 *     tone — the tile is the only saturated element; no coloured hero
 *     banners, no "control centre" panels
 *   • one rounded-3xl card per section, holding filters, table and pager
 *   • data-table for every table, so headers, padding, borders and row
 *     hover are identical everywhere
 *
 * Everything is token-based (bg-card, text-muted-foreground, border), so
 * the whole app follows light/dark theming instead of hardcoded palette
 * shades. Status colour is used only where the colour means something.
 */
import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CardGridSkeleton,
  ListSkeleton,
  SkeletonRegion,
  TableSkeleton,
} from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Lock, Inbox } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Tone                                                                */
/* ------------------------------------------------------------------ */

/**
 * A tone carries meaning first: a figure that reads as good is `emerald`,
 * one that needs attention is `amber`, one that is a problem is `rose`.
 *
 * Beyond that, every KPI in a row gets its own tone. A row where four of six
 * figures happen to sit at zero should still read as six distinct cards, so a
 * status figure escalates *into* amber/rose from a resting tone of its own
 * rather than falling back to a shared `neutral`. What the pages settled on:
 *
 *   indigo   total / catalog count — the "how many are there" figure
 *   emerald  active, approved, completed, received
 *   teal     a health, accuracy or readiness score at rest
 *   cyan     sync state at rest, and secondary time buckets
 *   sky      a plain secondary count with no status of its own
 *   violet   money: value, capital, payroll, spend
 *   amber    needs attention now
 *   rose     a real problem now
 *
 * `neutral` (primary-tinted) is left for a card with no identity of its own;
 * a whole row of it is what this convention exists to avoid.
 */
export type Tone =
  | "neutral"
  | "emerald"
  | "amber"
  | "rose"
  | "sky"
  | "violet"
  | "indigo"
  | "cyan"
  | "teal";

/**
 * KPI icon tiles: a solid block of the tone with a white icon on it.
 *
 * These were a soft tint, on the reasoning that a row of saturated blocks
 * reads as six buttons rather than as data. Filled is the house style now —
 * it gives each metric a colour you can find on the page from across a room,
 * which is what a KPI row is for.
 *
 * The trade-off that reasoning was guarding against is real, so it is handled
 * rather than ignored: the tile is the *only* saturated thing on the card, the
 * card itself stays `bg-card` with a hairline border, and `Tone` is assigned
 * by meaning (see the doc above) so the colours carry information instead of
 * decorating.
 *
 * Every tone is a 600-weight in light and 500 in dark — a 600 block on a dark
 * card is heavy enough to glow, and white-on-500 keeps the icon legible. Both
 * clear 4.5:1 against white.
 */
export const toneIconClass: Record<Tone, string> = {
  neutral: "bg-primary text-primary-foreground",
  emerald: "bg-emerald-600 text-white dark:bg-emerald-500",
  amber: "bg-amber-500 text-white dark:bg-amber-500",
  rose: "bg-rose-500 text-white dark:bg-rose-500",
  sky: "bg-sky-600 text-white dark:bg-sky-500",
  violet: "bg-violet-600 text-white dark:bg-violet-500",
  indigo: "bg-indigo-600 text-white dark:bg-indigo-500",
  cyan: "bg-cyan-600 text-white dark:bg-cyan-500",
  teal: "bg-teal-600 text-white dark:bg-teal-500",
};

/**
 * The colour of the bar down the left edge of a KPI card.
 *
 * The card surface stays `bg-card` — plain white, plain dark. The tone shows
 * only as a 6px bar on the leading edge, clipped by the card's own rounded
 * corners so it curves with them.
 *
 * This replaced a full tone wash across the card. The wash worked, but it
 * spent the tone on the largest area of the card to say the smallest thing,
 * and six tinted panels in a row leaves nothing for a figure that genuinely
 * needs to shout. A bar is read at the same glance, costs no contrast against
 * the text, and leaves the surface neutral.
 *
 * These are plain backgrounds because the bar is a painted element rather than
 * a left border — see `StatCard` for why a border could not be used.
 */
export const toneCardClass: Record<Tone, string> = {
  neutral: "bg-primary",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
  indigo: "bg-indigo-500",
  cyan: "bg-cyan-500",
  teal: "bg-teal-500",
};

export const toneBadgeClass: Record<Tone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  rose: "border-rose-500/30 bg-rose-500/10 text-rose-600",
  sky: "border-sky-500/30 bg-sky-500/10 text-sky-600",
  violet: "border-violet-500/30 bg-violet-500/10 text-violet-600",
  indigo: "border-indigo-500/30 bg-indigo-500/10 text-indigo-600",
  cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-600",
  teal: "border-teal-500/30 bg-teal-500/10 text-teal-600",
};

/* ------------------------------------------------------------------ */
/* Page frame                                                          */
/* ------------------------------------------------------------------ */

/** The single content column every workspace page sits in. */
export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-[1480px] space-y-5 px-4 py-5 lg:px-6", className)}>
      {children}
    </div>
  );
}

/**
 * Toolbar row. Secondary actions are ghost buttons on the left; give the
 * primary action `ml-auto` so it anchors to the right edge.
 */
export function PageToolbar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}

/** Ghost toolbar button — the standard secondary action. */
export function ToolbarButton({
  icon: Icon,
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { icon?: LucideIcon }) {
  return (
    <Button variant="ghost" size="sm" className={className} {...props}>
      {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
      {children}
    </Button>
  );
}

/** The one filled action per page, pinned right. */
export function PrimaryAction({
  icon: Icon,
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { icon?: LucideIcon }) {
  return (
    <Button size="sm" className={cn("ml-auto rounded-xl px-5 font-semibold", className)} {...props}>
      {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
      {children}
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/* KPI cards                                                           */
/* ------------------------------------------------------------------ */

export interface StatItem {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  /** Optional caption under the value. */
  helper?: string;
  /** Turns the card into a filter button. */
  onClick?: () => void;
  /** Highlights the card when its filter is the active one. */
  active?: boolean;
}

/**
 * Grid of KPI cards, four to a row at most.
 *
 * ## Why five and six no longer exist
 *
 * Pages asked for as many columns as they had figures — five here, six there —
 * and the grid obliged, so a six-figure page squeezed six cards into the width
 * of four. Each card then had roughly 150px for an icon tile, a label and a
 * number, which is how "Inventory value" came to be clipped and how a currency
 * figure ended up rendered a size smaller than the card beside it.
 *
 * Four is the widest a card stays legible at, so `columns` is now a ceiling
 * rather than an instruction: ask for five or six and you get four across with
 * the remainder on the next row, which is the intended reading anyway. The
 * prop keeps its old shape so the thirty-odd call sites need no edit, and a
 * page that genuinely wants three across still gets three.
 */
export function StatGrid({
  items,
  columns = 4,
  className,
}: {
  items: StatItem[];
  /** Four is the maximum; 5 and 6 are accepted and capped. */
  columns?: 3 | 4 | 5 | 6;
  className?: string;
}) {
  const columnClass = columns <= 3 ? "lg:grid-cols-3" : "lg:grid-cols-4";

  return (
    <div className={cn("stagger-children grid grid-cols-2 gap-3", columnClass, className)}>
      {items.map((item) => (
        <StatCard key={item.label} {...item} />
      ))}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  helper,
  onClick,
  active,
}: StatItem) {
  const body = (
    <div className="flex items-center gap-3">
      {/*
        A rounded square, not a circle. A filled circle at this size reads as
        an avatar — something belonging to a person — where a squared tile
        reads as a label on a figure. `shadow-sm` lifts it off the card just
        enough that the block does not look painted on.
      */}
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm",
          toneIconClass[tone],
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={2.2} />
      </div>
      <div className="min-w-0">
        {/*
          The label wraps; the figure does not.

          Back when six cards could share a row, a label like "Inventory
          value" was clipped to "Inventory V…", which is the one part of the
          card that says what the number means. Cards in a grid stretch together, so a second line
          costs a few pixels of row height and nothing else. The value keeps
          its `truncate` because a wrapped currency figure reads as two
          numbers.
        */}
        <p className="text-xs font-medium leading-tight text-muted-foreground">{label}</p>
        {/*
          Long figures step down a size rather than being clipped.

          A currency value like "RWF 85,200" did not fit a card in the old
          five-up row at `text-xl`, and truncating it produced "RWF 85,2…" — a
          number
          that is not merely hard to read but wrong. Wrapping is not the answer
          either: a currency split across two lines reads as two numbers. One
          size smaller fits, and the step is invisible unless two cards sit
          side by side.
        */}
        <p
          className={cn(
            "mt-0.5 truncate font-data font-bold text-foreground",
            typeof value === "string" && value.length > 9 ? "text-lg" : "text-xl",
          )}
        >
          {value}
        </p>
        {helper ? (
          <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{helper}</p>
        ) : null}
      </div>
    </div>
  );

  /*
   * The stripe is a painted element, not a left border.
   *
   * A border was the obvious way and it does not survive `cn()`:
   * tailwind-merge cannot tell `border-l-4` (width) from `border-l-emerald-500`
   * (colour) — same prefix, different properties — so given both it keeps the
   * last and drops the other. The result rendered as a correctly-coloured 1px
   * hairline no matter which string the width was written in. Measuring
   * `borderLeftWidth` is what caught it; it looks nearly right in a screenshot.
   *
   * A positioned span has no such ambiguity, and `overflow-hidden` on the card
   * makes the bar pick up the same rounded corners, so it reads as part of the
   * card's edge rather than a rectangle laid on top.
   */
  const base = cn(
    "relative overflow-hidden rounded-2xl border border-border bg-card py-4 pl-5 pr-4 text-left shadow-sm",
  );

  const stripe = (
    <span
      aria-hidden="true"
      className={cn("absolute inset-y-0 left-0 w-1.5", toneCardClass[tone])}
    />
  );

  if (!onClick) {
    return (
      <div className={base}>
        {stripe}
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        base,
        "lift hover:border-primary/40",
        active && "border-primary ring-1 ring-primary",
      )}
    >
      {stripe}
      {body}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Charts and empty states                                             */
/* ------------------------------------------------------------------ */

/**
 * Chrome for every Recharts `<Tooltip>` in the app.
 *
 * Recharts paints its tooltip white with near-black text by default, which on
 * a dark card is a bright rectangle with unreadable content. Feeding it the
 * popover tokens makes it follow the theme like everything else. Spread it:
 * `<Tooltip formatter={...} {...chartTooltip} />`.
 */
export const chartTooltip = {
  contentStyle: {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "0.75rem",
    color: "hsl(var(--popover-foreground))",
    fontSize: 12,
    boxShadow: "0 18px 40px -18px rgba(0,0,0,0.45)",
  },
  labelStyle: {
    color: "hsl(var(--muted-foreground))",
    fontWeight: 600,
    marginBottom: 4,
  },
  itemStyle: { color: "hsl(var(--popover-foreground))" },
  cursor: { fill: "hsl(var(--muted))", fillOpacity: 0.45 },
} as const;

/** Axis styling to match. Spread onto XAxis/YAxis. */
export const chartAxis = {
  tick: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
  axisLine: false,
  tickLine: false,
} as const;

/**
 * The one "there is nothing here yet" state.
 *
 * Every panel that can be empty should use it, so a screen with three empty
 * sections reads as three of the same thing rather than three different
 * authors' idea of blank.
 */
export function EmptyNote({
  icon: Icon,
  text,
  className,
}: {
  icon: LucideIcon;
  text: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 py-10 text-center",
        className,
      )}
    >
      <Icon className="h-8 w-8 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section card                                                        */
/* ------------------------------------------------------------------ */

/**
 * The standard content card: a titled header carrying a tone-tinted icon
 * badge, a one-line description, optional header actions, then the body.
 *
 * Every panel on a page should be one of these. A page that hand-rolls its
 * own `<Card><CardContent className="p-4"><h3>` per section drifts within a
 * single screen — three heading weights, four paddings, two corner radii —
 * and the drift is what reads as unfinished, not the content.
 */
export function SectionCard({
  icon: Icon,
  tone = "neutral",
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: {
  icon?: LucideIcon;
  /** Tints the icon badge. Same vocabulary as the KPI cards — see Tone. */
  tone?: Tone;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={cn("animate-rise rounded-3xl shadow-sm", className)}>
      <CardHeader>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2.5 text-base">
              {Icon ? (
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                    toneIconClass[tone],
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
              ) : null}
              <span className="min-w-0 truncate">{title}</span>
            </CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">{actions}</div>
          ) : null}
        </div>
      </CardHeader>
      {children ? (
        <CardContent className={cn("space-y-4", contentClassName)}>{children}</CardContent>
      ) : null}
    </Card>
  );
}

/** Outline button sized for a SectionCard header. */
export function SectionAction({
  icon: Icon,
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { icon?: LucideIcon }) {
  return (
    <Button variant="outline" className={cn("rounded-2xl", className)} {...props}>
      {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
      {children}
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/* Filters                                                             */
/* ------------------------------------------------------------------ */

/**
 * Filter row. Defaults to the User Management template — a flexible search
 * field followed by fixed-width selects.
 */
export function FilterRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("grid gap-3 xl:grid-cols-[1fr_auto]", className)}>{children}</div>;
}

export function SearchField({
  value,
  onChange,
  placeholder = "Search...",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[48px] items-center gap-3 rounded-2xl border border-input bg-background px-4",
        className,
      )}
    >
      <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

/** Select styled to line up with SearchField. */
export function FilterSelect({
  value,
  onValueChange,
  options,
  placeholder,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={cn("h-12 rounded-2xl", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ------------------------------------------------------------------ */
/* Filter chips                                                        */
/* ------------------------------------------------------------------ */

export interface FilterChip {
  key: string;
  label: string;
  count?: number;
  icon?: LucideIcon;
}

/**
 * Quick-filter pills. These deliberately do *not* look like KPI cards:
 * a card states a figure, a chip performs an action, and the pages used to
 * blur the two by rendering saved filters as another wall of tiles.
 */
export function FilterChips({
  chips,
  value,
  onChange,
  className,
}: {
  chips: FilterChip[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {chips.map((chip) => {
        const active = chip.key === value;
        const Icon = chip.icon;
        return (
          <button
            key={chip.key}
            type="button"
            onClick={() => onChange(chip.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
            {chip.label}
            {typeof chip.count === "number" ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-data font-semibold",
                  active ? "bg-primary-foreground/20" : "bg-muted",
                )}
              >
                {chip.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* View mode toggle                                                    */
/* ------------------------------------------------------------------ */

/** Grid / list / compact switch used by the catalog screens. */
export function ViewToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { key: T; label: string; icon: LucideIcon }[];
}) {
  return (
    <div className="flex rounded-2xl border border-border bg-muted/40 p-1">
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <Button
            key={option.key}
            type="button"
            size="sm"
            variant={value === option.key ? "default" : "ghost"}
            className="h-8 rounded-xl px-3"
            onClick={() => onChange(option.key)}
          >
            <Icon className="mr-1.5 h-4 w-4" />
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Table                                                               */
/* ------------------------------------------------------------------ */

/**
 * Scroll container for a data-table. Every table in the app is wrapped in
 * this so border radius and overflow behaviour match.
 */
export function TableShell({
  children,
  minWidth,
  className,
}: {
  children: React.ReactNode;
  /** e.g. 980 — keeps columns from collapsing on narrow screens. */
  minWidth?: number;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto rounded-2xl border border-border", className)}>
      <table className="data-table" style={minWidth ? { minWidth } : undefined}>
        {children}
      </table>
    </div>
  );
}

/** "Showing 1 to 25 of 340" + page-size select + prev/next. */
export function TablePagination({
  page,
  perPage,
  total,
  onPageChange,
  onPerPageChange,
  perPageOptions = [10, 25, 50, 100],
  noun = "records",
}: {
  page: number;
  perPage: number;
  total: number;
  onPageChange: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
  perPageOptions?: number[];
  noun?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const to = Math.min(currentPage * perPage, total);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        Showing {from} to {to} of {total} {noun}
      </p>

      <div className="flex items-center gap-2">
        {onPerPageChange ? (
          <Select value={String(perPage)} onValueChange={(value) => onPerPageChange(Number(value))}>
            <SelectTrigger className="h-8 w-[110px] rounded-lg text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {perPageOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option} per page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-lg px-2"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          >
            Prev
          </Button>
          <span className="px-2 text-xs font-medium text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-lg px-2"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* States                                                              */
/* ------------------------------------------------------------------ */

/**
 * The waiting state every list screen uses.
 *
 * It was the word "Loading..." centred in empty space, which tells somebody
 * nothing is ready and nothing else — and let the page jump the moment rows
 * arrived. A skeleton of the table that is coming holds the layout and reads
 * as almost-there, which on a slow connection is most of what "fast" means.
 *
 * Upgraded in one place deliberately: every page that already calls this got
 * skeleton loading without being touched.
 */
export function LoadingState({
  label = "Loading...",
  rows = 6,
  columns = 5,
  variant = "table",
}: {
  /**
   * Announced to assistive tech rather than drawn: the shapes below are
   * `aria-hidden`, so this is the only thing a screen reader hears.
   */
  label?: string;
  rows?: number;
  columns?: number;
  /** "cards" for the grid views, "list" for anything with a leading avatar. */
  variant?: "table" | "cards" | "list";
}) {
  if (variant === "cards") {
    return (
      <SkeletonRegion label={label}>
        <CardGridSkeleton count={rows} columns="sm:grid-cols-2 xl:grid-cols-3" height="h-44" />
      </SkeletonRegion>
    );
  }

  if (variant === "list") {
    return (
      <SkeletonRegion label={label}>
        <ListSkeleton rows={rows} />
      </SkeletonRegion>
    );
  }

  return (
    <SkeletonRegion label={label}>
      <TableSkeleton rows={rows} columns={columns} />
    </SkeletonRegion>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border py-12 text-center text-muted-foreground">
      <Icon className="mx-auto mb-2 h-10 w-10 opacity-30" />
      <p className="font-medium text-foreground">{title}</p>
      {description ? <p className="mt-1 text-sm">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Banners                                                             */
/* ------------------------------------------------------------------ */

/** Single-line permission / advisory notice. */
export function NoticeBar({
  icon: Icon = Lock,
  children,
}: {
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-3xl border bg-amber-500/10 p-4 text-amber-700 dark:text-amber-200">
      <Icon className="h-5 w-5 shrink-0" />
      <div className="text-sm">{children}</div>
    </div>
  );
}

/** Status pill matching the directory table in User Management. */
export function StatusPill({
  tone = "neutral",
  icon: Icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("rounded-full", toneBadgeClass[tone], className)}>
      {Icon ? <Icon className="mr-1 h-3 w-3" /> : null}
      {children}
    </Badge>
  );
}
