import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * The loading vocabulary for the whole app.
 *
 * One kit rather than a spinner per screen, for two reasons. A spinner tells
 * you nothing is ready; a skeleton tells you what is coming and holds its
 * space, so the page does not jump when the data lands — on a slow connection,
 * which is the normal case for this product, that difference is most of what
 * "feels fast" means.
 *
 * The shapes here mirror the layout primitives in components/patterns.tsx, so
 * a screen's skeleton is a one-line swap for its real content rather than a
 * second layout to keep in step.
 *
 * Every block is `aria-hidden` and sits inside a container marked
 * `aria-busy` — a screen reader should hear "loading", not read out two dozen
 * empty boxes.
 */

export function SkeletonBlock({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <Skeleton className={cn("bg-muted/70", className)} style={style} aria-hidden="true" />;
}

/** Wraps any skeleton so assistive tech announces the wait once. */
export function SkeletonRegion({
  label = "Loading",
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** A row of KPI tiles — the strip most pages open with. */
export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <SkeletonRegion label="Loading summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-border bg-card p-4">
          <SkeletonBlock className="h-9 w-9 rounded-xl" />
          <SkeletonBlock className="mt-4 h-2.5 w-20" />
          <SkeletonBlock className="mt-2.5 h-5 w-24" />
        </div>
      ))}
    </SkeletonRegion>
  );
}

/** A data table: header row, then body rows. */
export function TableSkeleton({
  rows = 6,
  columns = 5,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <SkeletonRegion
      label="Loading table"
      className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)}
    >
      <div className="flex items-center gap-4 border-b border-border px-4 py-3">
        {Array.from({ length: columns }).map((_, index) => (
          <SkeletonBlock
            key={index}
            className={cn("h-2.5", index === 0 ? "w-32" : "w-20", index === columns - 1 && "ml-auto")}
          />
        ))}
      </div>

      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex items-center gap-4 border-b border-border/60 px-4 py-3.5 last:border-0"
          /* Each row fades in a beat after the one above, so the block reads
             as a list arriving rather than one grey slab. */
          style={{ animationDelay: `${rowIndex * 70}ms` }}
        >
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <SkeletonBlock
              key={columnIndex}
              className={cn(
                "h-3.5",
                columnIndex === 0 ? "w-40" : "w-16",
                columnIndex === columns - 1 && "ml-auto w-20"
              )}
            />
          ))}
        </div>
      ))}
    </SkeletonRegion>
  );
}

/** A grid of cards — plans, modules, products. */
export function CardGridSkeleton({
  count = 4,
  columns = "md:grid-cols-2 xl:grid-cols-4",
  height = "h-56",
}: {
  count?: number;
  columns?: string;
  height?: string;
}) {
  return (
    <SkeletonRegion label="Loading" className={cn("grid gap-4", columns)}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={cn("rounded-2xl border border-border bg-card p-5", height)}>
          <SkeletonBlock className="h-4 w-28" />
          <SkeletonBlock className="mt-3 h-2.5 w-full" />
          <SkeletonBlock className="mt-2 h-2.5 w-3/4" />
          <SkeletonBlock className="mt-6 h-7 w-32" />
          <div className="mt-6 space-y-2.5 border-t border-border pt-4">
            <SkeletonBlock className="h-2.5 w-full" />
            <SkeletonBlock className="h-2.5 w-5/6" />
            <SkeletonBlock className="h-2.5 w-4/6" />
          </div>
        </div>
      ))}
    </SkeletonRegion>
  );
}

/** A panel with a heading and a few lines — the generic section placeholder. */
export function SectionSkeleton({
  lines = 4,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <SkeletonRegion
      label="Loading section"
      className={cn("rounded-2xl border border-border bg-card p-5", className)}
    >
      <SkeletonBlock className="h-3.5 w-40" />
      <SkeletonBlock className="mt-2.5 h-2.5 w-64" />

      <div className="mt-6 space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <SkeletonBlock className="h-3 w-1/3" />
            <SkeletonBlock className="h-3 w-16" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

/** A chart: the plot area, then an axis. */
export function ChartSkeleton({ className }: { className?: string }) {
  const bars = [45, 70, 55, 85, 60, 92, 74, 66, 80, 58, 88, 63];

  return (
    <SkeletonRegion
      label="Loading chart"
      className={cn("rounded-2xl border border-border bg-card p-5", className)}
    >
      <SkeletonBlock className="h-3.5 w-36" />

      <div className="mt-6 flex h-48 items-end gap-2" aria-hidden="true">
        {bars.map((height, index) => (
          <SkeletonBlock
            key={index}
            className="flex-1 rounded-t-md"
            /* Uneven heights so the placeholder reads as a chart rather than
               a grey rectangle. */
            style={{ height: `${height}%` }}
          />
        ))}
      </div>

      <div className="mt-4 flex justify-between">
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonBlock key={index} className="h-2 w-10" />
        ))}
      </div>
    </SkeletonRegion>
  );
}

/** A stack of labelled inputs. */
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <SkeletonRegion label="Loading form" className="space-y-5">
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index}>
          <SkeletonBlock className="h-2.5 w-24" />
          <SkeletonBlock className="mt-2 h-11 w-full rounded-xl" />
        </div>
      ))}
      <SkeletonBlock className="h-12 w-full rounded-xl" />
    </SkeletonRegion>
  );
}

/** A list of rows with an avatar or icon — members, notifications, logs. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <SkeletonRegion label="Loading list" className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3.5 py-3.5">
          <SkeletonBlock className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <SkeletonBlock className="h-3 w-40" />
            <SkeletonBlock className="mt-2 h-2.5 w-24" />
          </div>
          <SkeletonBlock className="h-6 w-16 shrink-0 rounded-full" />
        </div>
      ))}
    </SkeletonRegion>
  );
}

/**
 * A whole page: title, KPI strip, and a table. The default for a route that
 * has not resolved yet, and what the app shell shows while the session and
 * the workspace are still being read.
 */
export function PageSkeleton({
  stats = 4,
  withChart = false,
  rows = 6,
}: {
  stats?: number;
  withChart?: boolean;
  rows?: number;
}) {
  return (
    <SkeletonRegion label="Loading page" className="space-y-5">
      <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <SkeletonBlock className="h-5 w-48" />
          <SkeletonBlock className="mt-2.5 h-2.5 w-72" />
        </div>
        <SkeletonBlock className="h-9 w-28 rounded-xl" />
      </div>

      {stats > 0 && <StatGridSkeleton count={stats} />}

      {withChart && (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <ChartSkeleton />
          <SectionSkeleton lines={5} />
        </div>
      )}

      <TableSkeleton rows={rows} />
    </SkeletonRegion>
  );
}

/**
 * The very first paint, before the app shell itself can be drawn: a sidebar
 * rail, a top bar and a page. Used by the route guards, which previously
 * showed a bare centred spinner on a blank field — the least informative
 * moment in the product, and the one every single session begins with.
 */
export function AppShellSkeleton() {
  return (
    <SkeletonRegion
      label="Opening your workspace"
      className="flex min-h-screen bg-background"
    >
      <div className="hidden w-64 shrink-0 border-r border-border bg-card p-4 lg:block">
        <div className="flex items-center gap-3">
          <SkeletonBlock className="h-10 w-10 rounded-xl" />
          <div className="flex-1">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="mt-1.5 h-2 w-16" />
          </div>
        </div>

        <div className="mt-8 space-y-2.5">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 rounded-lg px-2 py-2">
              <SkeletonBlock className="h-4 w-4 shrink-0 rounded" />
              <SkeletonBlock className="h-2.5 flex-1" />
            </div>
          ))}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex h-16 items-center gap-4 border-b border-border bg-card px-4 lg:px-6">
          <SkeletonBlock className="h-8 w-8 rounded-lg lg:hidden" />
          <SkeletonBlock className="h-3 w-40" />
          <div className="ml-auto flex items-center gap-2">
            <SkeletonBlock className="h-8 w-8 rounded-lg" />
            <SkeletonBlock className="h-8 w-8 rounded-lg" />
            <SkeletonBlock className="h-8 w-8 rounded-full" />
          </div>
        </div>

        <div className="p-4 lg:p-6">
          <PageSkeleton />
        </div>
      </div>
    </SkeletonRegion>
  );
}
