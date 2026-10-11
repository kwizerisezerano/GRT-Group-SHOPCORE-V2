/**
 * An amount written out the way a cheque or a contract writes it.
 *
 * ## Why a contract bothers
 *
 * A figure alone can be altered by one keystroke — "50,000" becomes "500,000"
 * and the page still looks right. Spelling the amount beside the numeral is how
 * paper contracts have always closed that hole, and it costs nothing here.
 *
 * Whole units only: RWF has no subunit in practice, and every amount on these
 * documents is rounded for display anyway.
 *
 * Kept in `lib` rather than beside the renderer so the PDF layer can use it
 * without importing the module that opens a database connection — the PDF
 * renderer is tested on its own, and a Prisma client instantiated to spell a
 * number would be a strange reason for that test to need a database.
 */

const ONES = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];

const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

const SCALES: [number, string][] = [
  [1_000_000_000, "billion"],
  [1_000_000, "million"],
  [1_000, "thousand"],
];

function chunk(value: number): string {
  if (value < 20) return ONES[value];

  if (value < 100) {
    const rest = value % 10;
    return TENS[Math.floor(value / 10)] + (rest ? `-${ONES[rest]}` : "");
  }

  const rest = value % 100;
  return `${ONES[Math.floor(value / 100)]} hundred${rest ? ` and ${chunk(rest)}` : ""}`;
}

export function amountInWords(value: number): string {
  const amount = Math.max(0, Math.round(Number(value) || 0));
  if (amount === 0) return ONES[0];

  let remaining = amount;
  const parts: string[] = [];

  for (const [size, name] of SCALES) {
    if (remaining >= size) {
      parts.push(`${chunk(Math.floor(remaining / size))} ${name}`);
      remaining %= size;
    }
  }

  if (remaining > 0) parts.push(chunk(remaining));

  return parts.join(" ");
}
