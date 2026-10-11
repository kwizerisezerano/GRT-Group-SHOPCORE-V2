import {
  Banknote,
  Barcode,
  CheckCircle2,
  CreditCard,
  ReceiptText,
  ScanLine,
  ShoppingCart,
  Wifi,
} from "lucide-react";
import { useLandingExperience } from "@/contexts/LandingExperienceContext";
import { demoBusiness } from "@/data/landingDemoData";
import WindowFrame from "./WindowFrame";
import StatCard from "./StatCard";
import AnimatedCounter from "./live/AnimatedCounter";

const getText = (source: unknown, keys: string[], fallback: string) => {
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record?.[key];

    if (typeof value === "string" && value.trim()) return value;
  }

  return fallback;
};

const getNumber = (source: unknown, keys: string[], fallback: number) => {
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record?.[key];

    if (typeof value === "number" && Number.isFinite(value)) return value;

    if (typeof value === "string") {
      const parsed = Number(value.replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return fallback;
};

const getArray = (source: unknown, keys: string[]) => {
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record?.[key];

    if (Array.isArray(value)) return value;
  }

  return [];
};

const formatRwf = (value: number) => `RWF ${value.toLocaleString()}`;

export default function POSWindow() {
  const { selectedModule, activeBranch, demoMode, metrics } =
    useLandingExperience();

  const products = getArray(demoBusiness, ["products"]);
  const branches = getArray(demoBusiness, ["branches"]);

  const branch =
    branches.find((item) => getText(item, ["id", "key"], "") === activeBranch) ??
    branches[0];

  const branchName = getText(branch, ["name", "label", "title"], "Main Branch");

  const cartItems =
    products.length > 0
      ? products.slice(0, 4).map((product, index) => {
          const name = getText(
            product,
            ["name", "label", "title"],
            `Item ${index + 1}`,
          );
          const qty = index === 0 ? 2 : index === 1 ? 4 : 1;
          const price = getNumber(
            product,
            ["price", "sellingPrice", "amount"],
            [34000, 23000, 18500, -5300][index] ?? 12000,
          );

          return {
            name: index === 3 ? "Customer discount" : name,
            qty,
            price: index === 3 ? -5300 : price * qty,
          };
        })
      : [
          { name: "Rice 25kg", qty: 2, price: 68000 },
          { name: "Cooking Oil 5L", qty: 4, price: 92000 },
          { name: "Sugar 10kg", qty: 1, price: 18500 },
          { name: "Customer discount", qty: 1, price: -5300 },
        ];

  const subtotal = cartItems.reduce((sum, item) => sum + item.price, 0);
  const tax = Math.round(subtotal * 0.18);
  const total = subtotal + tax;

  const cashValue = Math.round(total * 0.69);
  const cardValue = Math.round(total * 0.28);
  const mobileValue = total - cashValue - cardValue;

  const paymentRows = [
    { label: "Cash", value: cashValue, icon: Banknote },
    { label: "Card", value: cardValue, icon: CreditCard },
    { label: "Mobile", value: mobileValue, icon: Wifi },
  ];

  return (
    <WindowFrame
      title="Point of Sale Workspace"
      eyebrow={`${branchName} · Checkout operations`}
      icon={ShoppingCart}
      status={demoMode ? "Live counter" : "Counter online"}
      bodyClassName="bg-muted/70 p-4"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Checkout time"
          value={11}
          valueSuffix="s"
          icon={ScanLine}
          trend="-32%"
          trendDirection="up"
          caption="Median transaction"
        />

        <StatCard
          label="Today receipts"
          value={metrics.receipts}
          icon={ReceiptText}
          trend={selectedModule === "ebm" ? "Fiscal view" : "EBM ready"}
          trendDirection="neutral"
          caption="Fiscal workflow supported"
        />

        <StatCard
          label="Orders"
          value={metrics.orders}
          icon={Barcode}
          trend="+2.1%"
          trendDirection="up"
          caption="Checkout activity"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Active cart
              </p>
              <h4 className="mt-1 text-sm font-black text-slate-900 dark:!text-blue-100">
                Fast checkout with stock deduction
              </h4>
            </div>

            <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-bold text-foreground">
              SC-1048
            </span>
          </div>

          <div className="space-y-2.5">
            {cartItems.map((item) => (
              <div
                key={item.name}
                className="grid grid-cols-[1fr_auto] gap-3 rounded-xl border border-border bg-muted/80 px-3 py-3"
              >
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:!text-blue-100">{item.name}</p>
                  <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                    Quantity: {item.qty}
                  </p>
                </div>

                <p className="self-center text-sm font-black text-slate-900 dark:!text-blue-100">
                  {item.price < 0
                    ? `-${formatRwf(Math.abs(item.price))}`
                    : formatRwf(item.price)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-card p-4 text-foreground">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-muted-foreground">Subtotal</span>
              <span className="font-bold">
                <AnimatedCounter value={subtotal} prefix="RWF " />
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="font-semibold text-muted-foreground">VAT / Tax</span>
              <span className="font-bold">
                <AnimatedCounter value={tax} prefix="RWF " />
              </span>
            </div>

            <div className="mt-3 border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">
                  Total payable
                </span>
                <span className="text-2xl font-black text-slate-900 dark:!text-blue-100">
                  <AnimatedCounter value={total} prefix="RWF " />
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Payment split
              </p>
              <h4 className="mt-1 text-sm font-black text-slate-900 dark:!text-blue-100">
                Multiple payment methods
              </h4>
            </div>

            <div className="space-y-2.5">
              {paymentRows.map((row) => {
                const Icon = row.icon;

                return (
                  <div
                    key={row.label}
                    className="flex items-center justify-between rounded-xl border border-border bg-muted/80 px-3 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center text-foreground">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-bold text-slate-900 dark:!text-blue-100">
                        {row.label}
                      </span>
                    </div>

                    <span className="text-sm font-black text-slate-900 dark:!text-blue-100">
                      <AnimatedCounter value={row.value} prefix="RWF " />
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-muted p-4">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 items-center justify-center text-foreground">
                <CheckCircle2 className="h-4 w-4" />
              </div>

              <div>
                <p className="text-sm font-black text-blue-950">
                  Sale completed safely
                </p>
                <p className="mt-1 text-xs font-medium leading-relaxed text-blue-700">
                  Receipt saved, stock deducted, movement posted, and fiscal
                  submission prepared when credentials are configured.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-muted p-4">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 items-center justify-center text-foreground">
                <Wifi className="h-4 w-4" />
              </div>

              <div>
                <p className="text-sm font-black text-blue-950">
                  Offline checkout supported
                </p>
                <p className="mt-1 text-xs font-medium leading-relaxed text-blue-700">
                  Current offline queue:{" "}
                  <span className="font-black">
                    <AnimatedCounter value={metrics.offlineQueue} />
                  </span>{" "}
                  pending record{metrics.offlineQueue === 1 ? "" : "s"}.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </WindowFrame>
  );
}