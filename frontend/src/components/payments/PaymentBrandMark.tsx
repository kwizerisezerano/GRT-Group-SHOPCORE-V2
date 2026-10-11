import { Building2, CreditCard, Smartphone } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The logos on the payment-method chooser.
 *
 * ## Why these are drawn rather than fetched
 *
 * The obvious thing is an `<img>` pointing at a CDN. It is the wrong thing
 * here: this product's central promise is that it keeps working when the
 * connection does not, and a till that shows three broken-image icons on the
 * payment screen is exactly the moment that promise gets tested. Remote logos
 * also change without warning, block on someone else's uptime, and leak which
 * page a customer is on to a third party.
 *
 * So each mark is inline SVG — no request, no layout shift, correct in both
 * themes, and crisp at any size. They are recognisable brand marks in the
 * providers' own colours, which is what a customer is actually scanning for.
 *
 * `currentColor` is deliberately avoided inside the marks: MTN's yellow and
 * Visa's blue *are* the recognition, and recolouring them to match a theme
 * would defeat the point. The surrounding chip handles light/dark instead.
 */

export type PaymentBrand =
  | "mtn"
  | "airtel"
  | "visa"
  | "mastercard"
  | "card"
  | "bank"
  | "generic";

/** Maps a payment_methods row onto a mark, from its provider then its code. */
export function brandFor(input: { provider?: string | null; code?: string | null }): PaymentBrand {
  const provider = (input.provider ?? "").trim().toLowerCase();
  const code = (input.code ?? "").trim().toLowerCase();

  if (provider === "mtn" || code.includes("mtn")) return "mtn";
  if (provider === "airtel" || code.includes("airtel")) return "airtel";
  if (provider === "manual" || code.includes("bank")) return "bank";
  if (provider === "pesapal" || code.includes("card") || code.includes("visa")) return "card";

  return "generic";
}

function MtnMark() {
  return (
    <svg viewBox="0 0 64 40" role="img" aria-label="MTN Mobile Money" className="h-full w-full">
      <rect width="64" height="40" rx="7" fill="#FFCC00" />
      <text
        x="32"
        y="20"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="17"
        fontWeight="800"
        fill="#00285F"
        letterSpacing="0.5"
      >
        MTN
      </text>
      <text
        x="32"
        y="32"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="6.5"
        fontWeight="700"
        fill="#00285F"
        letterSpacing="1.2"
      >
        MoMo
      </text>
    </svg>
  );
}

function AirtelMark() {
  return (
    <svg viewBox="0 0 64 40" role="img" aria-label="Airtel Money" className="h-full w-full">
      <rect width="64" height="40" rx="7" fill="#E40000" />
      {/* The swoosh, simplified to two strokes so it stays legible at 32px. */}
      <path
        d="M18 27c0-7.2 5.4-13 12.4-13 5 0 8.6 2.9 8.6 6.9 0 3.4-2.6 5.9-6 5.9-2.6 0-4.4-1.5-4.4-3.6 0-1.9 1.4-3.3 3.3-3.3"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="3.1"
        strokeLinecap="round"
      />
      <text
        x="32"
        y="34"
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="6"
        fontWeight="700"
        fill="#FFFFFF"
        letterSpacing="1"
      >
        AIRTEL MONEY
      </text>
    </svg>
  );
}

function CardMark() {
  return (
    <svg viewBox="0 0 64 40" role="img" aria-label="Visa and Mastercard" className="h-full w-full">
      <rect width="64" height="40" rx="7" fill="#1A1F71" />

      {/* Mastercard's interlocking discs, left. */}
      <circle cx="20" cy="20" r="8.5" fill="#EB001B" />
      <circle cx="30" cy="20" r="8.5" fill="#F79E1B" fillOpacity="0.9" />
      <path
        d="M25 13.6a8.5 8.5 0 0 0 0 12.8 8.5 8.5 0 0 0 0-12.8Z"
        fill="#FF5F00"
      />

      {/* The Visa wordmark, right. */}
      <text
        x="48"
        y="21"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="12"
        fontWeight="800"
        fontStyle="italic"
        fill="#FFFFFF"
        letterSpacing="-0.3"
      >
        VISA
      </text>
    </svg>
  );
}

function BankMark() {
  return (
    <svg viewBox="0 0 64 40" role="img" aria-label="Bank transfer" className="h-full w-full">
      <rect width="64" height="40" rx="7" fill="#0F766E" />
      <path d="M32 10 18 17h28L32 10Z" fill="#FFFFFF" />
      <rect x="20" y="19.5" width="3.4" height="9" rx="1" fill="#FFFFFF" />
      <rect x="27" y="19.5" width="3.4" height="9" rx="1" fill="#FFFFFF" />
      <rect x="34" y="19.5" width="3.4" height="9" rx="1" fill="#FFFFFF" />
      <rect x="41" y="19.5" width="3.4" height="9" rx="1" fill="#FFFFFF" />
      <rect x="17" y="30" width="30" height="3" rx="1.2" fill="#FFFFFF" />
    </svg>
  );
}

function GenericMark() {
  return (
    <svg viewBox="0 0 64 40" role="img" aria-label="Payment method" className="h-full w-full">
      <rect width="64" height="40" rx="7" className="fill-muted" />
      <rect x="12" y="14" width="40" height="4" rx="2" className="fill-muted-foreground/40" />
      <rect x="12" y="23" width="22" height="4" rx="2" className="fill-muted-foreground/40" />
    </svg>
  );
}

const MARKS: Record<PaymentBrand, () => JSX.Element> = {
  mtn: MtnMark,
  airtel: AirtelMark,
  visa: CardMark,
  mastercard: CardMark,
  card: CardMark,
  bank: BankMark,
  generic: GenericMark,
};

/** Fallback glyph for anywhere too small for a logo. */
export function paymentIconFor(brand: PaymentBrand) {
  if (brand === "bank") return Building2;
  if (brand === "card" || brand === "visa" || brand === "mastercard") return CreditCard;
  return Smartphone;
}

export function PaymentBrandMark({
  brand,
  className,
}: {
  brand: PaymentBrand;
  className?: string;
}) {
  const Mark = MARKS[brand] ?? GenericMark;

  return (
    <span
      className={cn(
        "inline-flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg shadow-sm ring-1 ring-black/5 dark:ring-white/10",
        className
      )}
    >
      <Mark />
    </span>
  );
}

/** The row of accepted marks, for a footer or a reassurance strip. */
export function AcceptedPayments({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {(["mtn", "airtel", "card", "bank"] as PaymentBrand[]).map((brand) => (
        <PaymentBrandMark key={brand} brand={brand} className="h-7 w-11" />
      ))}
    </div>
  );
}
