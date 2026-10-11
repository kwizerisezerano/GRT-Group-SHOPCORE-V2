export const DEFAULT_CURRENCY = "RWF";

export const formatCurrency = (
  amount: number | string | null | undefined,
  currency: string = DEFAULT_CURRENCY
) => {
  const value = Number(amount ?? 0);

  return new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(value);
};