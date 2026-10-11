import { useMemo, useState } from "react";
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";
import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  Boxes,
  CalendarDays,
  Clock,
  Download,
  FileText,
  Printer,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { PageShell } from "@/components/PageShell";
import { PageContainer, SectionCard } from "@/components/patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatGridSkeleton, TableSkeleton } from "@/components/skeletons";
import { useExpenses, useProducts, useSales } from "@/hooks/useSupabaseData";
import { exportToCSV, exportToPDF, printRows } from "@/lib/exportUtils";
import {
  getDisplaySaleStatus,
  getProductBrand,
  getProductCategory,
  getProductCost,
  getProductStock,
  getSaleCostTotal,
  getSaleDate,
  getSaleItemCount,
  getSaleItemsArray,
  getSaleTotal,
  isDeletedRecord,
  isRecordInside,
  safeNumber,
} from "@/lib/reportMetrics";
import { cn } from "@/lib/utils";

/**
 * Reports.
 *
 * ## What this is for
 *
 * One question, asked four ways: what did we sell, over what period, and how
 * much of it has actually been paid for. The previous version answered that
 * across seven tabs and three thousand lines, and the number most people
 * opened it for — "what is still owed" — was not on any of them.
 *
 * So: pick a period from one dropdown, see the totals as cards, then the rows
 * behind them as either sales or products, with paid, unpaid and grand total
 * called out. Export what is on screen.
 *
 * The arithmetic is not here. It lives in lib/reportMetrics.ts, unchanged from
 * the version that has been in production — refunds, part-refunds, offline
 * records and the six different date fields a row might carry are all subtle
 * enough that redoing the layout must not touch them.
 */

type PeriodKey = "today" | "yesterday" | "this_week" | "last_7" | "this_month" | "last_month" | "custom";

const PERIODS: { value: PeriodKey; label: string; group: string }[] = [
  { value: "today", label: "Today", group: "Daily" },
  { value: "yesterday", label: "Yesterday", group: "Daily" },
  { value: "this_week", label: "This week", group: "Weekly" },
  { value: "last_7", label: "Last 7 days", group: "Weekly" },
  { value: "this_month", label: "This month", group: "Monthly" },
  { value: "last_month", label: "Last month", group: "Monthly" },
  { value: "custom", label: "Custom range", group: "Custom" },
];

/** Resolves a period key into the actual interval it means, right now. */
function resolveRange(period: PeriodKey, customFrom: string, customTo: string) {
  const now = new Date();

  switch (period) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "yesterday": {
      const yesterday = subDays(now, 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    }
    case "this_week":
      // Monday-first: a Rwandan retail week is not a US calendar week.
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case "last_7":
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case "this_month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "last_month": {
      const previous = subMonths(now, 1);
      return { start: startOfMonth(previous), end: endOfMonth(previous) };
    }
    case "custom": {
      const start = customFrom ? startOfDay(new Date(customFrom)) : startOfMonth(now);
      const end = customTo ? endOfDay(new Date(customTo)) : endOfDay(now);
      return { start, end };
    }
  }
}

const money = (value: number) => `RWF ${Math.round(value).toLocaleString()}`;

/**
 * Whether a sale has been settled.
 *
 * A till sale is paid the moment it is rung up; an invoice on account is not.
 * The row carries this in any of several shapes depending on how it was
 * created, so all of them are checked before falling back to "paid" — which
 * is what the overwhelming majority of point-of-sale rows are.
 */
function getPaidAmount(sale: any): number {
  const total = getSaleTotal(sale);

  const explicit = [sale?.amount_paid, sale?.paid_amount, sale?.total_paid];
  for (const candidate of explicit) {
    const value = Number(candidate);
    if (Number.isFinite(value) && candidate !== null && candidate !== undefined) {
      return Math.min(value, total);
    }
  }

  const status = String(
    sale?.payment_status ?? sale?.paymentStatus ?? sale?.status ?? "",
  ).toLowerCase();

  if (["unpaid", "pending", "credit", "on_account", "partial", "due"].includes(status)) {
    // A partial with no figure on it tells us nothing beyond "not all of it".
    return status === "partial" ? total / 2 : 0;
  }

  const balance = Number(sale?.balance ?? sale?.amount_due ?? sale?.outstanding);
  if (Number.isFinite(balance)) return Math.max(0, total - balance);

  return total;
}

export default function Reports() {
  const [period, setPeriod] = useState<PeriodKey>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [view, setView] = useState<"sales" | "products">("sales");

  const salesQuery = useSales();
  const productsQuery = useProducts();
  const expensesQuery = useExpenses();

  const loading =
    salesQuery.isLoading || productsQuery.isLoading || expensesQuery.isLoading;

  const range = useMemo(
    () => resolveRange(period, customFrom, customTo),
    [period, customFrom, customTo],
  );

  const rangeLabel = `${format(range.start, "d MMM yyyy")} – ${format(range.end, "d MMM yyyy")}`;

  /* ------------------------------------------------------------ sales --- */

  const sales = useMemo(() => {
    const rows = (salesQuery.data ?? []) as any[];

    return rows
      .filter((sale) => !isDeletedRecord(sale))
      .filter((sale) => isRecordInside(getSaleDate(sale), range))
      .sort(
        (a, b) => new Date(getSaleDate(b)).getTime() - new Date(getSaleDate(a)).getTime(),
      );
  }, [salesQuery.data, range]);

  const totals = useMemo(() => {
    let grand = 0;
    let paid = 0;
    let cost = 0;
    let items = 0;

    for (const sale of sales) {
      const total = getSaleTotal(sale);
      grand += total;
      paid += getPaidAmount(sale);
      cost += getSaleCostTotal(sale);
      items += getSaleItemCount(sale).net;
    }

    const expenses = ((expensesQuery.data ?? []) as any[])
      .filter((expense) => isRecordInside(expense.date ?? expense.created_at, range))
      .reduce((sum, expense) => sum + safeNumber(expense.amount), 0);

    return {
      grand,
      paid,
      unpaid: Math.max(0, grand - paid),
      profit: grand - cost,
      expenses,
      items,
      count: sales.length,
      average: sales.length > 0 ? grand / sales.length : 0,
    };
  }, [sales, expensesQuery.data, range]);

  /* --------------------------------------------------------- products --- */

  /**
   * What each product did over the period, assembled from the sale lines
   * rather than from the product row — the product row knows its stock, not
   * how much of it moved this month.
   */
  const productRows = useMemo(() => {
    const byName = new Map<
      string,
      { name: string; category: string; brand: string; quantity: number; revenue: number; cost: number; stock: number }
    >();

    const catalogue = (productsQuery.data ?? []) as any[];
    const stockByName = new Map(
      catalogue.map((product) => [
        String(product.name ?? "").toLowerCase(),
        getProductStock(product),
      ]),
    );

    for (const sale of sales) {
      for (const line of getSaleItemsArray(sale)) {
        const name = String(
          line.product_name ?? line.name ?? line.product?.name ?? "Unknown product",
        );
        const key = name.toLowerCase();

        const quantity = safeNumber(line.quantity ?? line.qty ?? 0);
        const unitPrice = safeNumber(line.unit_price ?? line.price ?? 0);
        const unitCost = safeNumber(line.unit_cost ?? line.cost ?? line.cost_price ?? 0);

        const existing = byName.get(key);
        const source = catalogue.find(
          (product) => String(product.name ?? "").toLowerCase() === key,
        );

        if (existing) {
          existing.quantity += quantity;
          existing.revenue += quantity * unitPrice;
          existing.cost += quantity * unitCost;
        } else {
          byName.set(key, {
            name,
            category: source ? getProductCategory(source) : "—",
            brand: source ? getProductBrand(source) : "—",
            quantity,
            revenue: quantity * unitPrice,
            cost: quantity * (unitCost || (source ? getProductCost(source) : 0)),
            stock: stockByName.get(key) ?? 0,
          });
        }
      }
    }

    return [...byName.values()].sort((a, b) => b.revenue - a.revenue);
  }, [sales, productsQuery.data]);

  /* ----------------------------------------------------------- export --- */

  const exportRows: Record<string, any>[] = useMemo(() => {
    if (view === "products") {
      return productRows.map((row) => ({
        Product: row.name,
        Category: row.category,
        Brand: row.brand,
        "Qty sold": row.quantity,
        Revenue: Math.round(row.revenue),
        Cost: Math.round(row.cost),
        Profit: Math.round(row.revenue - row.cost),
        "In stock": row.stock,
      }));
    }

    return sales.map((sale) => {
      const total = getSaleTotal(sale);
      const paid = getPaidAmount(sale);

      return {
        Date: format(new Date(getSaleDate(sale)), "yyyy-MM-dd HH:mm"),
        Invoice: sale.invoice_no ?? sale.invoice_number ?? sale.id ?? "—",
        Customer: sale.customer_name ?? sale.customer?.name ?? "Walk-in",
        Items: getSaleItemCount(sale).net,
        Total: Math.round(total),
        Paid: Math.round(paid),
        Unpaid: Math.round(Math.max(0, total - paid)),
        Status: getDisplaySaleStatus(sale),
      };
    });
  }, [view, sales, productRows]);

  const exportName = `shopcore-${view}-report-${format(range.start, "yyyyMMdd")}-${format(range.end, "yyyyMMdd")}`;
  const exportTitle = `${view === "products" ? "Product" : "Sales"} report · ${rangeLabel}`;

  const runExport = (kind: "csv" | "pdf" | "print") => {
    if (exportRows.length === 0) {
      toast.error("There is nothing in this period to export.");
      return;
    }

    try {
      if (kind === "csv") exportToCSV(exportRows, exportName);
      else if (kind === "pdf") exportToPDF(exportRows, exportName, exportTitle);
      else printRows(exportRows, exportTitle);

      toast.success(`${exportRows.length} rows exported.`);
    } catch (error: any) {
      toast.error(error?.message ?? "The export failed.");
    }
  };

  /* ------------------------------------------------------------ cards --- */

  const cards = [
    {
      label: "Grand total",
      value: money(totals.grand),
      helper: `${totals.count} sales · ${totals.items} items`,
      icon: Receipt,
      tone: "text-foreground",
    },
    {
      label: "Paid",
      value: money(totals.paid),
      helper:
        totals.grand > 0 ? `${Math.round((totals.paid / totals.grand) * 100)}% collected` : "—",
      icon: BadgeCheck,
      tone: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Unpaid",
      value: money(totals.unpaid),
      helper: totals.unpaid > 0 ? "Still owed by customers" : "Everything collected",
      icon: Clock,
      tone: totals.unpaid > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
    },
    {
      label: "Gross profit",
      value: money(totals.profit),
      helper: `Expenses ${money(totals.expenses)}`,
      icon: totals.profit >= 0 ? TrendingUp : TrendingDown,
      tone:
        totals.profit >= 0
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-rose-600 dark:text-rose-400",
    },
  ];

  return (
    <PageShell
      title="Reports"
      description="What sold, over which period, and how much of it has actually been paid for."
    >
      <PageContainer>
        {/* One control row: the period, the range if custom, and the export. */}
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="min-w-[180px]">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Report period
            </Label>
            <Select value={period} onValueChange={(value) => setPeriod(value as PeriodKey)}>
              <SelectTrigger className="mt-1.5 h-10 rounded-xl font-medium">
                <CalendarDays className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Daily", "Weekly", "Monthly", "Custom"].map((group) => (
                  <div key={group}>
                    <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group}
                    </p>
                    {PERIODS.filter((entry) => entry.group === group).map((entry) => (
                      <SelectItem key={entry.value} value={entry.value}>
                        {entry.label}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {period === "custom" && (
            <>
              <div>
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  From
                </Label>
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  className="mt-1.5 h-10 rounded-xl font-medium"
                />
              </div>

              <div>
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  To
                </Label>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                  className="mt-1.5 h-10 rounded-xl font-medium"
                />
              </div>
            </>
          )}

          <div className="ml-auto flex items-end gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Showing
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">{rangeLabel}</p>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="h-10 rounded-xl font-semibold">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => runExport("csv")}>
                  <FileText className="mr-2 h-4 w-4" />
                  CSV spreadsheet
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => runExport("pdf")}>
                  <Download className="mr-2 h-4 w-4" />
                  PDF document
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => runExport("print")}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {loading ? (
          <StatGridSkeleton count={4} />
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {cards.map((card) => (
              <div key={card.label} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <card.icon className="h-4 w-4" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">
                    {card.label}
                  </span>
                </div>

                <p className={cn("mt-2.5 text-xl font-bold tracking-tight", card.tone)}>
                  {card.value}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{card.helper}</p>
              </div>
            ))}
          </div>
        )}

        <SectionCard
          title={view === "sales" ? "Sales in this period" : "Products sold in this period"}
          description={
            view === "sales"
              ? "Every sale, newest first, with what is still owed on it."
              : "Ranked by revenue, assembled from the lines on those sales."
          }
          actions={
            <div className="flex rounded-xl border border-border p-1">
              {(["sales", "products"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setView(value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition",
                    view === value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {value === "sales" ? (
                    <BarChart3 className="h-3.5 w-3.5" />
                  ) : (
                    <Boxes className="h-3.5 w-3.5" />
                  )}
                  {value === "sales" ? "Sales" : "Products"}
                </button>
              ))}
            </div>
          }
        >
          {loading ? (
            <TableSkeleton rows={8} columns={view === "sales" ? 7 : 6} />
          ) : view === "sales" ? (
            <SalesTable sales={sales} totals={totals} />
          ) : (
            <ProductsTable rows={productRows} />
          )}
        </SectionCard>
      </PageContainer>
    </PageShell>
  );
}

function SalesTable({
  sales,
  totals,
}: {
  sales: any[];
  totals: { grand: number; paid: number; unpaid: number };
}) {
  if (sales.length === 0) return <EmptyPeriod what="sales" />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px]">
        <thead>
          <tr className="border-b border-border text-left">
            {["Date", "Invoice", "Customer", "Items", "Total", "Paid", "Unpaid", "Status"].map(
              (heading) => (
                <th
                  key={heading}
                  className={cn(
                    "px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                    ["Items", "Total", "Paid", "Unpaid"].includes(heading) && "text-right",
                  )}
                >
                  {heading}
                </th>
              ),
            )}
          </tr>
        </thead>

        <tbody>
          {sales.slice(0, 200).map((sale, index) => {
            const total = getSaleTotal(sale);
            const paid = getPaidAmount(sale);
            const unpaid = Math.max(0, total - paid);

            return (
              <tr
                key={sale.id ?? index}
                className="border-b border-border/60 transition last:border-0 hover:bg-muted/40"
              >
                <td className="px-3 py-3 text-[13px] text-muted-foreground">
                  {format(new Date(getSaleDate(sale)), "d MMM, HH:mm")}
                </td>
                <td className="px-3 py-3 font-mono text-xs font-medium text-foreground">
                  {sale.invoice_no ?? sale.invoice_number ?? "—"}
                </td>
                <td className="px-3 py-3 text-[13px] font-medium text-foreground">
                  {sale.customer_name ?? sale.customer?.name ?? "Walk-in"}
                </td>
                <td className="px-3 py-3 text-right text-[13px] text-muted-foreground">
                  {getSaleItemCount(sale).net}
                </td>
                <td className="px-3 py-3 text-right text-[13px] font-semibold text-foreground">
                  {money(total)}
                </td>
                <td className="px-3 py-3 text-right text-[13px] font-medium text-emerald-600 dark:text-emerald-400">
                  {money(paid)}
                </td>
                <td
                  className={cn(
                    "px-3 py-3 text-right text-[13px] font-medium",
                    unpaid > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
                  )}
                >
                  {unpaid > 0 ? money(unpaid) : "—"}
                </td>
                <td className="px-3 py-3">
                  <span className="text-xs capitalize text-muted-foreground">
                    {getDisplaySaleStatus(sale)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>

        {/* The three numbers the report exists to produce, under the rows. */}
        <tfoot>
          <tr className="border-t-2 border-border bg-muted/40">
            <td colSpan={4} className="px-3 py-3 text-[13px] font-semibold text-foreground">
              Grand total
            </td>
            <td className="px-3 py-3 text-right text-sm font-bold text-foreground">
              {money(totals.grand)}
            </td>
            <td className="px-3 py-3 text-right text-sm font-bold text-emerald-600 dark:text-emerald-400">
              {money(totals.paid)}
            </td>
            <td className="px-3 py-3 text-right text-sm font-bold text-amber-600 dark:text-amber-400">
              {money(totals.unpaid)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>

      {sales.length > 200 && (
        <p className="border-t border-border px-3 py-3 text-xs text-muted-foreground">
          Showing the 200 most recent of {sales.length} sales. Export to see them all — the totals
          above cover every sale in the period.
        </p>
      )}
    </div>
  );
}

function ProductsTable({
  rows,
}: {
  rows: {
    name: string;
    category: string;
    brand: string;
    quantity: number;
    revenue: number;
    cost: number;
    stock: number;
  }[];
}) {
  if (rows.length === 0) return <EmptyPeriod what="products" />;

  const totals = rows.reduce(
    (acc, row) => ({
      quantity: acc.quantity + row.quantity,
      revenue: acc.revenue + row.revenue,
      cost: acc.cost + row.cost,
    }),
    { quantity: 0, revenue: 0, cost: 0 },
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px]">
        <thead>
          <tr className="border-b border-border text-left">
            {["Product", "Category", "Qty sold", "Revenue", "Profit", "In stock"].map((heading) => (
              <th
                key={heading}
                className={cn(
                  "px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                  ["Qty sold", "Revenue", "Profit", "In stock"].includes(heading) && "text-right",
                )}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.slice(0, 200).map((row) => {
            const profit = row.revenue - row.cost;

            return (
              <tr
                key={row.name}
                className="border-b border-border/60 transition last:border-0 hover:bg-muted/40"
              >
                <td className="px-3 py-3 text-[13px] font-medium text-foreground">{row.name}</td>
                <td className="px-3 py-3 text-[13px] text-muted-foreground">{row.category}</td>
                <td className="px-3 py-3 text-right text-[13px] text-foreground">{row.quantity}</td>
                <td className="px-3 py-3 text-right text-[13px] font-semibold text-foreground">
                  {money(row.revenue)}
                </td>
                <td
                  className={cn(
                    "px-3 py-3 text-right text-[13px] font-medium",
                    profit >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400",
                  )}
                >
                  {money(profit)}
                </td>
                <td
                  className={cn(
                    "px-3 py-3 text-right text-[13px]",
                    row.stock <= 0
                      ? "font-semibold text-rose-600 dark:text-rose-400"
                      : "text-muted-foreground",
                  )}
                >
                  {row.stock <= 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Out
                    </span>
                  ) : (
                    row.stock
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>

        <tfoot>
          <tr className="border-t-2 border-border bg-muted/40">
            <td colSpan={2} className="px-3 py-3 text-[13px] font-semibold text-foreground">
              Grand total
            </td>
            <td className="px-3 py-3 text-right text-sm font-bold text-foreground">
              {totals.quantity}
            </td>
            <td className="px-3 py-3 text-right text-sm font-bold text-foreground">
              {money(totals.revenue)}
            </td>
            <td className="px-3 py-3 text-right text-sm font-bold text-emerald-600 dark:text-emerald-400">
              {money(totals.revenue - totals.cost)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function EmptyPeriod({ what }: { what: string }) {
  return (
    <div className="py-14 text-center">
      <Wallet className="mx-auto h-7 w-7 text-muted-foreground" />
      <p className="mt-3 font-semibold text-foreground">No {what} in this period</p>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Try a wider date range, or check that the period is the one you meant.
      </p>
    </div>
  );
}
