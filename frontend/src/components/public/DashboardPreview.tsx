import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  Download,
  LayoutDashboard,
  Receipt,
  Search,
  ShoppingCart,
  Truck,
  Users,
  Wifi,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A picture of the workspace, drawn rather than screenshotted.
 *
 * ## Why not a screenshot
 *
 * A PNG of the real dashboard is a large asset that has to be re-taken every
 * time the product changes, always shows one theme while the page follows the
 * reader's, and goes soft on a retina display unless it is captured at 2x and
 * costs more again. This is built from the same tokens as the workspace, so it
 * stays correct when the palette moves, follows dark mode for free, and adds
 * no image weight to the first paint.
 *
 * ## The numbers are illustrative, and that is kept honest
 *
 * A landing page cannot show a real shop's takings. These figures are
 * plausible rather than real, and nothing here is dressed up as a customer's
 * data: no logos, no names, no claimed results. The frame is labelled as a
 * preview, and the whole figure carries one `aria-label` saying so — a screen
 * reader gets that sentence instead of a wall of invented numbers.
 *
 * An earlier pass deleted a fake dashboard from this page for being heavy:
 * shadows, a colour wash, invented data presented as fact. The fix for that
 * was never "show nothing" — a retail system that will not show its own screen
 * asks a lot of trust. This one is flat, uses the app's hairline borders, and
 * shows the layout a customer actually gets.
 */

export type PreviewScreen = "dashboard" | "pos" | "inventory" | "reports";

const NAV = [
  { icon: LayoutDashboard, label: "Dashboard", screen: "dashboard" as const },
  { icon: ShoppingCart, label: "Point of sale", screen: "pos" as const },
  { icon: Boxes, label: "Inventory", screen: "inventory" as const },
  { icon: Truck, label: "Purchasing", screen: null },
  { icon: Users, label: "Customers", screen: null },
  { icon: BarChart3, label: "Reports", screen: "reports" as const },
  { icon: Receipt, label: "Expenses", screen: null },
  { icon: Building2, label: "Branches", screen: null },
];

const SCREEN_LABEL: Record<PreviewScreen, string> = {
  dashboard: "the ShopCore dashboard, showing takings, margin and what needs attention",
  pos: "the ShopCore till, with a sale in progress and mobile money ready to charge",
  inventory: "the ShopCore stock list, showing quantity on hand at each branch",
  reports: "a ShopCore sales report, showing paid, unpaid and the grand total",
};

/** Sales by hour. The shape of a shop day: quiet open, lunch peak, evening run. */
const HOURS = [
  { hour: "08", value: 18 },
  { hour: "09", value: 34 },
  { hour: "10", value: 46 },
  { hour: "11", value: 58 },
  { hour: "12", value: 87 },
  { hour: "13", value: 96 },
  { hour: "14", value: 62 },
  { hour: "15", value: 54 },
  { hour: "16", value: 71 },
  { hour: "17", value: 88 },
  { hour: "18", value: 64 },
];

export function DashboardPreview({
  screen = "dashboard",
  className,
}: {
  screen?: PreviewScreen;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={`Preview of ${SCREEN_LABEL[screen]}. The figures shown are an illustration.`}
      className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)}
    >
      <WindowBar />

      <div className="flex" aria-hidden="true">
        <Sidebar active={screen} />

        <div className="min-w-0 flex-1">
          <TopBar screen={screen} />

          <div className="p-3 sm:p-4">
            {screen === "dashboard" && <DashboardBody />}
            {screen === "pos" && <PosBody />}
            {screen === "inventory" && <InventoryBody />}
            {screen === "reports" && <ReportsBody />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- chrome --- */

function WindowBar() {
  return (
    <div
      className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2.5"
      aria-hidden="true"
    >
      <span className="flex gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
      </span>

      <span className="ml-2 hidden truncate rounded-md border border-border bg-card px-2.5 py-1 text-[10px] font-medium text-muted-foreground sm:block">
        app.shopcore.rw / kigali-main
      </span>

      <span className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-emerald-600/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
        <Wifi className="h-3 w-3" />
        Synced
      </span>
    </div>
  );
}

function Sidebar({ active }: { active: PreviewScreen }) {
  return (
    <aside className="hidden w-[168px] shrink-0 border-r border-border bg-muted/25 p-2.5 sm:block">
      <div className="flex items-center gap-2 px-1.5 pb-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">
          S
        </span>
        <span className="text-[11px] font-bold tracking-tight text-foreground">ShopCore</span>
      </div>

      <nav className="space-y-0.5">
        {NAV.map((item) => {
          const isActive = item.screen === active;
          return (
            <span
              key={item.label}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors",
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={isActive ? 2.4 : 2} />
              <span className="truncate">{item.label}</span>
            </span>
          );
        })}
      </nav>

      <div className="mt-3 rounded-lg border border-border bg-card p-2.5">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          Professional
        </p>
        <p className="mt-1 font-data text-[11px] font-semibold text-foreground">6 of 10 seats</p>
        <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-muted">
          <span className="block h-full w-3/5 rounded-full bg-primary" />
        </span>
      </div>
    </aside>
  );
}

function TopBar({ screen }: { screen: PreviewScreen }) {
  const title =
    screen === "pos"
      ? "Point of sale"
      : screen === "inventory"
        ? "Inventory"
        : screen === "reports"
          ? "Reports"
          : "Dashboard";

  return (
    <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
      <div>
        <p className="text-[12px] font-semibold leading-tight text-foreground">{title}</p>
        <p className="text-[9px] font-medium text-muted-foreground">Kigali Main · today</p>
      </div>

      <span className="ml-auto hidden items-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-[10px] text-muted-foreground md:flex">
        <Search className="h-3 w-3" />
        Search
      </span>

      <span className="relative flex h-6 w-6 items-center justify-center rounded-lg border border-border text-muted-foreground">
        <Bell className="h-3 w-3" />
        <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
      </span>

      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
        UM
      </span>
    </div>
  );
}

/* ------------------------------------------------------------ dashboard --- */

function DashboardBody() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat label="Sales today" value="1,284,500" unit="RWF" delta="+12.4%" />
        <Stat label="Transactions" value="96" delta="+8" />
        <Stat label="Gross margin" value="31.4" unit="%" delta="+1.2 pts" />
        <Stat label="Unpaid credit" value="410,000" unit="RWF" tone="warn" />
      </div>

      <div className="grid gap-2 lg:grid-cols-5">
        <div className="rounded-xl border border-border p-3 lg:col-span-3">
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] font-semibold text-foreground">Sales by hour</p>
            <p className="text-[9px] font-medium text-muted-foreground">Peak 13:00</p>
          </div>
          <HourChart />
        </div>

        <div className="rounded-xl border border-border p-3 lg:col-span-2">
          <p className="text-[11px] font-semibold text-foreground">Needs attention</p>
          <ul className="mt-2 space-y-1.5">
            <Attention tone="rose" title="Out of stock" detail="4 products" />
            <Attention tone="amber" title="Below reorder point" detail="12 products" />
            <Attention tone="sky" title="Waiting to sync" detail="3 records" />
            <Attention tone="violet" title="Credit overdue" detail="2 customers" />
          </ul>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  delta,
  tone = "plain",
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  tone?: "plain" | "warn";
}) {
  return (
    <div className="rounded-xl border border-border p-2.5">
      {/*
        Not truncated. These labels are the only thing identifying the number
        under them, and at this size "Transactions" clipped to "Transactio…"
        costs more than the extra line it saves — the tiles are grid children,
        so a wrap stretches all four together rather than knocking one out of
        line.
      */}
      <p className="text-[9px] font-semibold uppercase leading-tight tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 flex items-baseline gap-1">
        <span
          className={cn(
            "font-data text-[15px] font-semibold leading-none",
            tone === "warn" ? "text-amber-600 dark:text-amber-400" : "text-foreground",
          )}
        >
          {value}
        </span>
        {unit ? <span className="text-[9px] font-semibold text-muted-foreground">{unit}</span> : null}
      </p>
      {delta ? (
        <p className="mt-1 inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
          <ArrowUpRight className="h-2.5 w-2.5" strokeWidth={3} />
          {delta}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The bars grow from the baseline once, when the chart reaches the viewport.
 *
 * Height rather than `scaleY`, because a scaled bar also scales its rounded
 * cap into an ellipse on the way up. Eleven bars at 40ms apart is under half a
 * second end to end — long enough to read as a sweep, short enough that the
 * chart has settled before anyone finishes the heading beside it.
 */
function HourChart() {
  const [grown, setGrown] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced || typeof IntersectionObserver === "undefined") {
      setGrown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setGrown(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const peak = Math.max(...HOURS.map((entry) => entry.value));

  return (
    <div ref={ref} className="mt-3 flex h-[92px] items-end gap-[3px]">
      {HOURS.map((entry, index) => (
        <span key={entry.hour} className="flex flex-1 flex-col items-center gap-1">
          <span className="flex h-[76px] w-full items-end">
            <span
              className={cn(
                "w-full rounded-sm transition-[height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                entry.value === peak ? "bg-primary" : "bg-primary/25",
              )}
              style={{
                height: grown ? `${(entry.value / peak) * 100}%` : "0%",
                transitionDelay: grown ? `${index * 40}ms` : undefined,
              }}
            />
          </span>
          <span className="text-[8px] font-medium text-muted-foreground">{entry.hour}</span>
        </span>
      ))}
    </div>
  );
}

const ATTENTION_TONES = {
  rose: "bg-rose-500",
  amber: "bg-amber-500",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
} as const;

function Attention({
  tone,
  title,
  detail,
}: {
  tone: keyof typeof ATTENTION_TONES;
  title: string;
  detail: string;
}) {
  /*
   * Title over detail rather than side by side. On one line in a column this
   * narrow the title lost the fight for space and came out as "Out o…", which
   * is worse than useless — the row exists to name the problem.
   */
  return (
    <li className="flex items-start gap-2 rounded-lg border border-border px-2 py-1.5">
      <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", ATTENTION_TONES[tone])} />
      <span className="min-w-0">
        <span className="block text-[10px] font-medium leading-tight text-foreground">{title}</span>
        <span className="mt-0.5 block font-data text-[9px] text-muted-foreground">{detail}</span>
      </span>
    </li>
  );
}

/* ------------------------------------------------------------------ pos --- */

const CART = [
  { name: "Inyange milk 1L", qty: 2, total: "2,400" },
  { name: "Sugar 1kg", qty: 1, total: "1,850" },
  { name: "Cooking oil 2L", qty: 1, total: "6,200" },
  { name: "Bread loaf", qty: 3, total: "2,700" },
];

function PosBody() {
  return (
    <div className="grid gap-2 lg:grid-cols-5">
      <div className="rounded-xl border border-border lg:col-span-3">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-[11px] font-semibold text-foreground">Sale #1042</p>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
            4 items
          </span>
        </div>

        <ul className="divide-y divide-border">
          {CART.map((line) => (
            <li key={line.name} className="flex items-center gap-2 px-3 py-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted font-data text-[10px] font-semibold text-foreground">
                {line.qty}
              </span>
              <span className="truncate text-[10px] font-medium text-foreground">{line.name}</span>
              <span className="ml-auto shrink-0 font-data text-[10px] font-semibold text-foreground">
                {line.total}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2 lg:col-span-2">
        <div className="rounded-xl border border-border p-3">
          <Row label="Subtotal" value="13,150" />
          <Row label="VAT 18%" value="2,367" />
          <div className="mt-2 flex items-baseline justify-between border-t border-border pt-2">
            <span className="text-[10px] font-semibold text-foreground">Total</span>
            <span className="font-data text-[15px] font-semibold text-foreground">RWF 15,517</span>
          </div>
        </div>

        <div className="rounded-xl border border-border p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Take payment
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {["Cash", "MTN MoMo", "Airtel", "Card"].map((method, index) => (
              <span
                key={method}
                className={cn(
                  "rounded-lg border px-2 py-1.5 text-center text-[10px] font-semibold",
                  index === 1
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground",
                )}
              >
                {method}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[9px] font-medium text-muted-foreground">
            Customer approves on their phone · EBM receipt issued
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-0.5">
      <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
      <span className="font-data text-[10px] font-semibold text-foreground">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------ inventory --- */

const STOCK = [
  { sku: "BEV-0142", name: "Inyange milk 1L", branch: "Kigali Main", qty: 148, state: "ok" },
  { sku: "GRO-0031", name: "Sugar 1kg", branch: "Kigali Main", qty: 22, state: "low" },
  { sku: "GRO-0088", name: "Cooking oil 2L", branch: "Remera", qty: 0, state: "out" },
  { sku: "BAK-0007", name: "Bread loaf", branch: "Kigali Main", qty: 64, state: "ok" },
  { sku: "HOU-0219", name: "Washing powder 900g", branch: "Nyabugogo", qty: 9, state: "low" },
] as const;

const STATE_STYLES = {
  ok: "border-emerald-600/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  low: "border-amber-600/25 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  out: "border-rose-600/25 bg-rose-500/10 text-rose-700 dark:text-rose-400",
} as const;

const STATE_LABEL = { ok: "In stock", low: "Low", out: "Out" } as const;

function InventoryBody() {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="grid grid-cols-[1.6fr_1fr_auto_auto] gap-2 border-b border-border bg-muted/40 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>Product</span>
        <span className="hidden sm:block">Branch</span>
        <span className="text-right">On hand</span>
        <span className="text-right">Status</span>
      </div>

      <ul className="divide-y divide-border">
        {STOCK.map((item) => (
          <li
            key={item.sku}
            className="grid grid-cols-[1.6fr_1fr_auto_auto] items-center gap-2 px-3 py-2"
          >
            <span className="min-w-0">
              <span className="block truncate text-[10px] font-medium text-foreground">
                {item.name}
              </span>
              <span className="block font-data text-[9px] text-muted-foreground">{item.sku}</span>
            </span>
            <span className="hidden truncate text-[10px] text-muted-foreground sm:block">
              {item.branch}
            </span>
            <span className="text-right font-data text-[11px] font-semibold text-foreground">
              {item.qty}
            </span>
            <span
              className={cn(
                "justify-self-end rounded-md border px-1.5 py-0.5 text-[9px] font-semibold",
                STATE_STYLES[item.state],
              )}
            >
              {STATE_LABEL[item.state]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------- reports --- */

const REPORT_ROWS = [
  { day: "Mon", sales: "842,000", paid: "842,000", unpaid: "0" },
  { day: "Tue", sales: "1,106,500", paid: "961,500", unpaid: "145,000" },
  { day: "Wed", sales: "978,000", paid: "978,000", unpaid: "0" },
  { day: "Thu", sales: "1,284,500", paid: "1,019,500", unpaid: "265,000" },
];

function ReportsBody() {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {["Daily", "Weekly", "Monthly"].map((period, index) => (
          <span
            key={period}
            className={cn(
              "rounded-lg border px-2 py-1 text-[10px] font-semibold",
              index === 1
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground",
            )}
          >
            {period}
          </span>
        ))}
        <span className="ml-auto inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground">
          <Download className="h-3 w-3" />
          Export
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Paid" value="3,801,000" unit="RWF" />
        <Stat label="Unpaid" value="410,000" unit="RWF" tone="warn" />
        <Stat label="Grand total" value="4,211,000" unit="RWF" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-4 gap-2 border-b border-border bg-muted/40 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Day</span>
          <span className="text-right">Sales</span>
          <span className="text-right">Paid</span>
          <span className="text-right">Unpaid</span>
        </div>

        <ul className="divide-y divide-border">
          {REPORT_ROWS.map((row) => (
            <li key={row.day} className="grid grid-cols-4 gap-2 px-3 py-1.5">
              <span className="text-[10px] font-medium text-foreground">{row.day}</span>
              <span className="text-right font-data text-[10px] text-foreground">{row.sales}</span>
              <span className="text-right font-data text-[10px] text-emerald-600 dark:text-emerald-400">
                {row.paid}
              </span>
              <span className="text-right font-data text-[10px] text-muted-foreground">
                {row.unpaid}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
