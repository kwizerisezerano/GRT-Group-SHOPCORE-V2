import { beforeEach, describe, expect, it, vi } from "vitest";
import { printRows } from "./exportUtils";

/**
 * The printed report document.
 *
 * This is the artefact people hand to an accountant or file against a bank
 * statement, and it is the one output nobody sees until it is already on
 * paper — a broken layout or a missing figure is discovered at the worst
 * possible moment. So the document is rendered here and asserted on directly.
 *
 * The escaping tests are the ones that matter most: every cell carries user
 * input — product names, customer names, free-text notes — straight into a
 * new window's document.
 */

let written = "";

const printWindow = {
  document: {
    write: (html: string) => {
      written = html;
    },
    close: vi.fn(),
  },
  focus: vi.fn(),
  print: vi.fn(),
  onload: null as null | (() => void),
};

beforeEach(() => {
  written = "";
  printWindow.onload = null;
  vi.stubGlobal(
    "open",
    vi.fn(() => printWindow),
  );
  vi.stubGlobal("alert", vi.fn());
});

const ROWS = [
  {
    category: "Bar",
    date: "31-Jul-2026",
    product: "GNUTS",
    price: "1,000",
    qty: 1,
    total: "1,000",
    paid: "1,000",
    unpaid: "0",
    seller: "MEERA1",
    status: "Paid",
  },
  {
    category: "Bar",
    date: "31-Jul-2026",
    product: "INYA. JUICE 500ML",
    price: "1,200",
    qty: 2,
    total: "2,400",
    paid: "0",
    unpaid: "2,400",
    seller: "MEERA1",
    status: "Credit",
  },
];

const META = {
  subtitle: "July 2026",
  summary: [
    { label: "Sales", value: "5,712,600" },
    { label: "Paid", value: "4,924,501" },
    { label: "Unpaid", value: "719,999" },
  ],
  brand: {
    name: "Maisha",
    contact: ["version2.maisha.rw", "support@maisha.rw", "Reports Department"],
  },
};

function render(rows = ROWS, meta: Parameters<typeof printRows>[3] = META) {
  printRows(rows, "Monthly Sales Report", undefined, meta);
  return written;
}

describe("printed report document", () => {
  it("heads the page with the workspace, the report and a contact block", () => {
    const html = render();
    expect(html).toContain("MAISHA");
    expect(html).toContain("Monthly Sales Report");
    expect(html).toContain("Contact Us");
    expect(html).toContain("support@maisha.rw");
  });

  it("states the report, the period and when it was produced", () => {
    const html = render();
    expect(html).toContain("Report:");
    expect(html).toContain("Period:");
    expect(html).toContain("Generated:");
    expect(html).toContain("July 2026");
  });

  it("prints the summary figures above the table", () => {
    const html = render();
    for (const value of ["5,712,600", "4,924,501", "719,999"]) {
      expect(html).toContain(value);
    }
  });

  it("prints one numbered row per product", () => {
    const html = render();
    expect(html).toContain("GNUTS");
    expect(html).toContain("INYA. JUICE 500ML");
    expect(html).toContain('<td class="num idx">1</td>');
    expect(html).toContain('<td class="num idx">2</td>');
  });

  /*
   * Money columns are coloured so a statement reads at a glance. Keyed off
   * the column name, not the value — a zero in the unpaid column is still
   * unambiguously the unpaid column.
   */
  it("colours what was received apart from what is still owed", () => {
    const html = render();
    expect(html).toContain('class="num pos"');
    expect(html).toContain('class="num neg"');
  });

  it("right-aligns figures and leaves text alone", () => {
    const html = render();
    // qty/price/total parse as numbers; product and seller do not.
    expect(html).toMatch(/<th class="num">\s*price\s*<\/th>/i);
    expect(html).toMatch(/<th>\s*product\s*<\/th>/i);
  });

  it("repeats the table header across printed pages", () => {
    expect(render()).toContain("table-header-group");
  });

  /* ---- the parts that must not go wrong ------------------------------- */

  it("escapes markup in a product name", () => {
    const html = render([
      { ...ROWS[0], product: '<script>alert("x")</script>' },
    ] as typeof ROWS);

    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes markup in the workspace name", () => {
    const html = render(ROWS, {
      ...META,
      brand: { name: '<img src=x onerror="alert(1)">', contact: [] },
    });

    expect(html).not.toContain("<img src=x");
    // The masthead uppercases the name for display, so the entity is too.
    expect(html).toContain("&lt;IMG");
  });

  it("refuses an empty report rather than printing an empty page", () => {
    const alerted = vi.fn();
    vi.stubGlobal("alert", alerted);
    printRows([], "Empty Report");
    expect(alerted).toHaveBeenCalled();
    expect(written).toBe("");
  });

  it("says so when the browser blocks the print window", () => {
    const alerted = vi.fn();
    vi.stubGlobal("alert", alerted);
    vi.stubGlobal(
      "open",
      vi.fn(() => null),
    );

    printRows(ROWS, "Blocked Report");
    expect(alerted).toHaveBeenCalledWith(expect.stringContaining("pop-ups"));
  });

  it("works without branding or a summary", () => {
    // Called directly: render()'s default parameter would supply META.
    printRows(ROWS, "Monthly Sales Report");
    const html = written;
    expect(html).toContain("Monthly Sales Report");
    expect(html).toContain("GNUTS");
    // Falls back to the product name rather than printing an empty masthead.
    expect(html).toContain("SHOPCORE");
  });
});
