export function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function money(value?: number | null, currency = "RWF") {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
}

export function formatDate(value?: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString();
}

export function formatDateTime(value?: string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleString();
}

export function calculateTenant360Metrics(data: any) {
  const invoices = data?.invoices ?? [];
  const paidInvoices = invoices.filter((item: any) => item.status === "paid");
  const openInvoices = invoices.filter(
    (item: any) => item.status !== "paid" && item.status !== "void",
  );

  const revenue = paidInvoices.reduce(
    (sum: number, item: any) => sum + Number(item.total || 0),
    0,
  );

  const outstanding = openInvoices.reduce(
    (sum: number, item: any) => sum + Number(item.total || 0),
    0,
  );

  const salesRevenue = (data?.sales ?? []).reduce(
    (sum: number, sale: any) => sum + Number(sale.total || sale.amount || 0),
    0,
  );

  const stockValue = (data?.products ?? []).reduce((sum: number, product: any) => {
    const qty = Number(product.stock ?? product.quantity ?? 0);
    const price = Number(product.selling_price ?? product.price ?? 0);
    return sum + qty * price;
  }, 0);

  const activeSupportSessions = (data?.impersonationSessions ?? []).filter(
    (session: any) => session.status === "active",
  ).length;

  const liveSupportSessions = (data?.impersonationSessions ?? []).filter(
    (session: any) =>
      session.status === "active" &&
      (!session.expires_at ||
        new Date(session.expires_at).getTime() > Date.now()),
  ).length;

  const members = (data?.members ?? []).length;
  const branches = (data?.branches ?? []).length;
  const warehouses = (data?.warehouses ?? []).length;
  const products = (data?.products ?? []).length;

  const tickets = (data?.support ?? []).filter(
    (ticket: any) => ticket.status !== "closed",
  ).length;

  const failedPayments = (data?.payments ?? []).filter(
    (payment: any) => payment.status === "failed",
  ).length;

  const fallbackHealthScore = Math.max(
    55,
    100 -
      (outstanding > 0 ? 8 : 0) -
      (tickets > 0 ? 6 : 0) -
      (failedPayments > 0 ? 7 : 0) -
      (activeSupportSessions > 0 ? 3 : 0),
  );

  const healthScore = Number(data?.health?.health_score ?? fallbackHealthScore);

  const securityScore = Math.max(
    60,
    96 -
      (activeSupportSessions > 0 ? 5 : 0) -
      (members === 0 ? 12 : 0) -
      ((data?.impersonationSessions ?? []).length > 3 ? 4 : 0),
  );

  return {
    members,
    branches,
    warehouses,
    products,
    invoices: invoices.length,
    revenue,
    outstanding,
    salesRevenue,
    stockValue,
    tickets,
    activeSupportSessions,
    liveSupportSessions,
    failedPayments,
    healthScore,
    healthStatus: data?.health?.health_status || "healthy",
    securityScore,
    apiRequests: products * 18 + members * 40 + invoices.length * 25,
    storageGb: Math.max(
      0.4,
      products * 0.002 + invoices.length * 0.01 + members * 0.015,
    ),
  };
}

export const tenant360Modules = [
  "POS",
  "Inventory",
  "Warehouse",
  "Procurement",
  "CRM",
  "Accounting",
  "Reports",
  "EBM",
  "Staff",
  "Payroll",
  "Workspace",
  "Support",
];