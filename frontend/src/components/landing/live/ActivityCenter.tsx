import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BellRing,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Database,
  PackageSearch,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  ShoppingCart,
  Truck,
  X,
} from "lucide-react";
import { useLandingExperience } from "@/contexts/LandingExperienceContext";

type Tone = "blue" | "emerald" | "orange" | "rose" | "violet" | "cyan";

const iconMap = {
  pos: ShoppingCart,
  inventory: PackageSearch,
  warehouse: Truck,
  crm: CreditCard,
  procurement: Truck,
  finance: CreditCard,
  analytics: Database,
  offline: RefreshCcw,
  ebm: ReceiptText,
  security: ShieldCheck,
};

const toneMap: Record<Tone, string> = {
  blue: "border-border bg-muted text-foreground",
  emerald: "border-border bg-muted text-foreground",
  orange: "border-border bg-muted text-foreground",
  rose: "border-border bg-muted text-foreground",
  violet: "border-border bg-muted text-foreground",
  cyan: "border-border bg-muted text-foreground",
};

const dotMap: Record<Tone, string> = {
  blue: "bg-blue-500",
  emerald: "bg-blue-500",
  orange: "bg-blue-500",
  rose: "bg-blue-500",
  violet: "bg-blue-500",
  cyan: "bg-blue-500",
};

export default function ActivityCenter() {
  const {
    activityFeed,
    selectedModule,
    activeBranch,
    branchHealth,
    demoMode,
  } = useLandingExperience();

  const panelRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [lastEventId, setLastEventId] = useState<string | null>(null);
  const [pulse, setPulse] = useState(false);
  const [hasNewActivity, setHasNewActivity] = useState(false);

  const branch =
    branchHealth.find((item) => item.id === activeBranch) ?? branchHealth[0];

  const branchName = branch?.name ?? "Active branch";

  const events = useMemo(
    () => activityFeed.slice(0, 4),
    [activityFeed],
  );

  useEffect(() => {
    const newestId = events[0]?.id;

    if (!newestId) return;

    if (lastEventId === null) {
      setLastEventId(newestId);
      return;
    }

    if (newestId === lastEventId) return;

    setLastEventId(newestId);
    setPulse(true);

    if (!open) {
      setHasNewActivity(true);
    }

    const timer = window.setTimeout(() => {
      setPulse(false);
    }, 700);

    return () => {
      window.clearTimeout(timer);
    };
  }, [events, lastEventId, open]);

  useEffect(() => {
    if (!open) return;

    setHasNewActivity(false);

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;

      setOpen(false);
      setMinimized(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      setOpen(false);
      setMinimized(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleOpen = () => {
    setOpen(true);
    setMinimized(false);
    setHasNewActivity(false);
  };

  const handleClose = () => {
    setOpen(false);
    setMinimized(false);

    window.requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  };

  if (!open) {
    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        aria-label="Open live operations"
        aria-expanded="false"
        aria-controls="shopcore-activity-center"
        className={[
          "fixed bottom-4 right-4 z-[70] flex items-center gap-2 rounded-full bg-card px-4 py-3 text-xs font-black text-foreground transition hover:-translate-y-0.5",
        ].join(" ")}
      >
        <span className="relative flex h-8 w-8 items-center justify-center text-foreground">
          <BellRing className="h-4 w-4" />

          {demoMode ? (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-400" />
          ) : null}
        </span>

        <span>Live operations</span>

        {hasNewActivity ? (
          <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1.5 text-[10px] font-black text-white">
            New
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <aside
      ref={panelRef}
      id="shopcore-activity-center"
      aria-label="Live operations"
      className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-[390px] lg:inset-x-auto lg:bottom-5 lg:right-5 lg:mx-0"
    >
      <div
        className={[
          "overflow-hidden rounded-[1.65rem] border bg-card/95 shadow-[0_30px_95px_-55px_rgba(15,23,42,0.9)] backdrop-blur-xl transition-all duration-300",
          pulse
            ? "border-cyan-300 ring-4 ring-cyan-100"
            : "border-slate-200",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted px-4 py-3 text-foreground">
          <button
            type="button"
            onClick={() => setMinimized((value) => !value)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            aria-expanded={!minimized}
            aria-controls="shopcore-activity-feed"
          >
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center text-foreground">
              <BellRing className="h-4 w-4" />

              {demoMode ? (
                <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-slate-950 bg-blue-400" />
              ) : null}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-black">
                Live Operations
              </p>

              <p className="truncate text-[11px] font-semibold text-slate-400">
                {branchName} · {selectedModule.toUpperCase()}
              </p>
            </div>
          </button>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setMinimized((value) => !value)}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label={
                minimized
                  ? "Expand activity center"
                  : "Minimize activity center"
              }
            >
              {minimized ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Close activity center"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!minimized ? (
          <div
            id="shopcore-activity-feed"
            className="max-h-[330px] overflow-y-auto bg-card p-3"
          >
            <div className="space-y-2">
              {events.map((event, index) => {
                const Icon = iconMap[event.module] ?? BellRing;
                const active = index === 0;

                return (
                  <div
                    key={`${event.id}-${index}`}
                    className={[
                      "rounded-2xl border p-3 transition",
                      active
                        ? "border-border bg-muted"
                        : "border-border bg-muted/80",
                    ].join(" ")}
                  >
                    <div className="flex gap-3">
                      <div
                        className={[
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                          toneMap[event.tone],
                        ].join(" ")}
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-950">
                              {event.title}
                            </p>

                            <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-5 text-slate-500">
                              {event.detail}
                            </p>
                          </div>

                          <span className="shrink-0 text-[10px] font-black uppercase tracking-wide text-slate-400">
                            {active ? "now" : `${index + 1}m`}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center gap-2">
                          <span
                            className={[
                              "h-2 w-2 rounded-full",
                              dotMap[event.tone],
                            ].join(" ")}
                          />

                          <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                            {event.module}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {events.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted p-5 text-center">
                  <BellRing className="mx-auto h-5 w-5 text-muted-foreground" />
                  <p className="mt-2 text-sm font-black text-foreground">
                    No recent activity
                  </p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    New operating events will appear here.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}