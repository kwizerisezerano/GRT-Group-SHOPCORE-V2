import { useEffect, useRef, useState } from "react";
import { BarChart3, Boxes, Check, LayoutDashboard, ShoppingCart } from "lucide-react";

import { DashboardPreview, type PreviewScreen } from "@/components/public/DashboardPreview";
import { cn } from "@/lib/utils";

/**
 * Four screens of the product, switched by tabs.
 *
 * ## Why tabs and not a carousel
 *
 * A carousel decides for the reader how long they get with each screen, and
 * takes the one they wanted away mid-sentence. Tabs let somebody who cares
 * about stock go straight to stock. The screens do advance on their own until
 * the first interaction, because a static tab strip on a landing page mostly
 * goes unnoticed — but the moment anyone picks a tab, the rotation stops for
 * good and does not fight them for control.
 *
 * Auto-advance also stops when the tour is off screen, so a reader who left it
 * behind does not come back to a tab they never chose, and the timer is not
 * running for a component nobody is looking at.
 *
 * Follows the ARIA tabs pattern: roving focus, arrow keys, and `tabpanel`
 * wired to its tab, so this is operable from the keyboard rather than being a
 * set of divs that happen to look like tabs.
 */

const TABS: Array<{
  screen: PreviewScreen;
  label: string;
  icon: typeof LayoutDashboard;
  headline: string;
  body: string;
  points: string[];
}> = [
  {
    screen: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    headline: "The morning check, in one screen",
    body: "Yesterday's takings, today's margin, and a list of everything waiting on a decision — what is out of stock, what is below its reorder point, who owes you money.",
    points: [
      "Takings, margin and transaction count for the day",
      "Sales by hour, so you staff the busy part",
      "One list of what needs doing, worst first",
    ],
  },
  {
    screen: "pos",
    label: "Point of sale",
    icon: ShoppingCart,
    headline: "Ring it up, take the money",
    body: "Scan or search, take cash, MTN, Airtel or card, and issue the EBM receipt as part of the sale. It works the same with the connection down.",
    points: [
      "Barcode scan, or search by name",
      "Cash, MTN, Airtel, card — or on account",
      "EBM receipt issued with the sale, not after it",
    ],
  },
  {
    screen: "inventory",
    label: "Inventory",
    icon: Boxes,
    headline: "Stock you can trust, per branch",
    body: "Every sale moves stock at the branch that sold it. Counts, adjustments and transfers all leave a trail, so the number on screen is the number on the shelf.",
    points: [
      "Quantity on hand per branch and warehouse",
      "Reorder points that flag before you run out",
      "Every count, adjustment and transfer is logged",
    ],
  },
  {
    screen: "reports",
    label: "Reports",
    icon: BarChart3,
    headline: "Daily, weekly, monthly — and exportable",
    body: "Pick a period or a date range, split by product or by sale, and read paid against unpaid with the grand total underneath. Export when the accountant asks.",
    points: [
      "Daily, weekly or monthly, or any date range",
      "By product or by sale, paid against unpaid",
      "Export the sheet your accountant asks for",
    ],
  },
];

const ROTATE_MS = 6000;

export function ProductTour() {
  const [active, setActive] = useState(0);
  const [locked, setLocked] = useState(false);
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setInView(entry.isIntersecting);
      },
      { threshold: 0.25 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (locked || !inView) return;

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % TABS.length);
    }, ROTATE_MS);

    return () => window.clearInterval(timer);
  }, [locked, inView]);

  function choose(index: number) {
    setLocked(true);
    setActive(index);
  }

  /** Left/right move between tabs; Home/End jump to the ends. */
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key)) return;

    event.preventDefault();
    const next =
      event.key === "ArrowRight"
        ? (active + 1) % TABS.length
        : event.key === "ArrowLeft"
          ? (active - 1 + TABS.length) % TABS.length
          : event.key === "Home"
            ? 0
            : TABS.length - 1;

    choose(next);
    tabRefs.current[next]?.focus();
  }

  const current = TABS[active];

  return (
    <div ref={containerRef}>
      <div
        role="tablist"
        aria-label="Product screens"
        onKeyDown={onKeyDown}
        className="flex flex-wrap justify-center gap-1.5"
      >
        {TABS.map((tab, index) => {
          const isActive = index === active;
          return (
            <button
              key={tab.screen}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`tour-tab-${tab.screen}`}
              aria-selected={isActive}
              aria-controls={`tour-panel-${tab.screen}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => choose(index)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] font-semibold transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`tour-panel-${current.screen}`}
        aria-labelledby={`tour-tab-${current.screen}`}
        className="mt-8 grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]"
      >
        {/*
          Keyed on the screen so React swaps the subtree rather than patching
          it, which is what lets the entrance animation run again on each
          change — a patched subtree keeps the finished animation state and
          the change reads as an instant jump.
        */}
        <div key={`copy-${current.screen}`} className="animate-rise">
          <h3 className="text-2xl font-semibold tracking-tight text-foreground">
            {current.headline}
          </h3>
          <p className="mt-4 text-[15px] leading-7 text-muted-foreground">{current.body}</p>

          {/*
            What this screen does, not a second copy of the tab strip. The
            first draft listed the four tab names again here, which read as
            navigation and duplicated the row directly above it.
          */}
          <ul className="mt-6 space-y-3 border-t border-border pt-6">
            {current.points.map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-[13px]">
                <Check
                  className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  strokeWidth={3}
                />
                <span className="font-medium text-foreground">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <div key={`screen-${current.screen}`} className="animate-rise">
          <DashboardPreview screen={current.screen} />
        </div>
      </div>
    </div>
  );
}
