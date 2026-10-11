import PDFDocument from "pdfkit";

import { amountInWords } from "../../lib/amountWords";

/**
 * The signed contract as a PDF.
 *
 * pdfkit rather than a headless browser, for the same reason the invoice uses
 * it: rendering a few pages of text should not mean shipping Chromium. The
 * palette is the app's light theme written as hex, so a customer recognises the
 * document as coming from ShopCore.
 *
 * ## Why it is laid out rather than dumped
 *
 * The first version printed the whole agreement as one undifferentiated block
 * of 10pt text. Everything was in there and none of it was findable — no
 * heading stood out, clauses ran together, and the signature landed wherever
 * the text happened to stop. A contract is a document somebody has to be able
 * to navigate months later, under stress, looking for one clause.
 *
 * So the body is parsed into headings and paragraphs (see `parseBody`),
 * numbered clauses are set in bold, the parties are named in a block of their
 * own, and every page carries a footer identifying the document and its place
 * in the whole. The signature block is drawn on ruled lines, the way a paper
 * contract is, and is kept intact rather than split across a page break.
 */

const BRAND = "#132DAE";
const INK = "#171B2E";
const MUTED = "#6B7280";
const RULE = "#E5E7EB";
const WASH = "#F7F8FC";

const longDate = (value: Date) =>
  value.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

const money = (value: unknown, currency: string) =>
  `${currency} ${Math.round(Number(value ?? 0)).toLocaleString("en-US")}`;

const CYCLE_LABEL: Record<string, string> = {
  monthly: "Monthly",
  six_months: "Every 6 months",
  annual: "Annual",
};

export type ContractForRender = {
  templateName: string;
  templateVersion: number;
  body: string;
  signerName: string;
  signatureImage: string;
  stampImage: string | null;
  /** The provider's side, copied onto the contract when it was signed. */
  providerSignatureImage?: string | null;
  providerStampImage?: string | null;
  providerSignerName?: string | null;
  providerSignerTitle?: string | null;

  /*
   * Both parties as the law knows them. A contract that identifies one side by
   * its registered name, TIN and address and the other by a brand is not a
   * document either side would want to rely on, so the header names both the
   * same way.
   */
  providerLegalName?: string | null;
  providerTin?: string | null;
  providerRegistrationNo?: string | null;
  providerAddress?: string | null;
  providerEmail?: string | null;
  providerPhone?: string | null;
  governingLaw?: string | null;
  customerLegalName?: string | null;
  customerTin?: string | null;
  customerAddress?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;

  planName: string;
  billingCycle: string;
  amount: unknown;
  currency: string;
  signedAt: Date;
  /** Named on the document so a signed copy can be matched to a workspace. */
  companyName?: string | null;
  reference?: string | null;
};

/**
 * Is this a structurally complete PNG or JPEG?
 *
 * ## Why this is checked here rather than left to pdfkit
 *
 * Handing pdfkit an image it cannot parse does not produce an error you can
 * catch and move on from. png-js throws "Incomplete or corrupt PNG file" from
 * inside `doc.image()`, and from that moment **the process is poisoned**: the
 * next image parse — even in a brand new document — hangs instead of throwing.
 * The request never answers, and every render queued behind it stalls too.
 * That is how this was found: one truncated PNG took the whole payment step
 * down, silently, with no error anywhere.
 *
 * A `try`/`catch` around `doc.image()` does not save you, because the damage is
 * done before the throw. The only reliable defence is never to hand pdfkit a
 * malformed image, so the container is walked here first.
 *
 * This is not a theoretical case: browsers render truncated PNGs happily, so an
 * image a customer sees perfectly well in the upload preview really can be one
 * pdfkit refuses.
 */
export function isCompleteImage(bytes: Buffer): boolean {
  const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  if (PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    /*
     * Walk the chunks: [length:4][type:4][data][crc:4]. A truncated file runs
     * off the end mid-chunk, which is exactly what png-js chokes on, and a
     * complete one lands on IEND with nothing after it.
     */
    let offset = 8;

    while (offset + 8 <= bytes.length) {
      const length = bytes.readUInt32BE(offset);
      const type = bytes.toString("ascii", offset + 4, offset + 8);
      const next = offset + 12 + length;

      if (next > bytes.length) return false;
      if (type === "IEND") return true;

      offset = next;
    }

    return false;
  }

  // JPEG: starts with SOI and ends with EOI.
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  }

  return false;
}

/**
 * Decodes a `data:image/png;base64,…` URL into bytes pdfkit will actually take.
 *
 * Returns null rather than throwing on anything malformed. A contract that
 * cannot be downloaded because one image is unreadable is worse than one that
 * downloads with the signature line blank and says so — and far better than one
 * that hangs, which is what happens if a broken image reaches pdfkit at all.
 */
function decodeDataUrl(dataUrl: string | null): Buffer | null {
  if (!dataUrl) return null;

  const match = /^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl.trim());
  if (!match) return null;

  let bytes: Buffer;
  try {
    bytes = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  } catch {
    return null;
  }

  return isCompleteImage(bytes) ? bytes : null;
}

type Block =
  | { kind: "title"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "gap" };

/**
 * Turns the plain-text agreement into blocks worth setting differently.
 *
 * The template is written as plain text — that is the right format for the
 * console's editor, where an author should not have to learn markup to change
 * a payment term. The structure is still there in the conventions people
 * naturally use: a numbered clause opens with "3. SERVICE", a document title
 * is a line in capitals, and indented lines belong to the clause above.
 *
 * Reading those conventions costs nothing and is what makes the difference
 * between a wall of text and a document. Anything unrecognised is a paragraph,
 * so an author cannot produce something this refuses to render.
 */
function parseBody(body: string): Block[] {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];

  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length === 0) return;
    blocks.push({ kind: "paragraph", text: paragraph.join(" ").replace(/\s+/g, " ").trim() });
    paragraph = [];
  };

  lines.forEach((raw, index) => {
    const line = raw.trim();

    if (line === "") {
      flush();
      blocks.push({ kind: "gap" });
      return;
    }

    /* "3. SERVICE" or "3. THE CUSTOMER'S DATA" — a numbered clause heading. */
    if (/^\d+\.\s+[A-Z][A-Z'’(),./&\s-]*$/.test(line)) {
      flush();
      blocks.push({ kind: "heading", text: line });
      return;
    }

    /*
     * A short all-caps line. The first one is the document's own title; later
     * ones are unnumbered section headings. Length-capped so a sentence
     * shouted in capitals is not mistaken for a heading.
     */
    if (line.length <= 60 && line === line.toUpperCase() && /[A-Z]/.test(line)) {
      flush();
      blocks.push({ kind: index < 3 ? "title" : "heading", text: line });
      return;
    }

    paragraph.push(line);
  });

  flush();
  return blocks;
}

export async function renderContractPdf(contract: ContractForRender): Promise<Buffer> {
  /*
   * `bufferPages` holds the pages open so the footer can say "Page 2 of 5".
   * Without it each page is flushed as it is finished and the total is not
   * knowable until it is too late to write it down.
   */
  const doc = new PDFDocument({ size: "A4", margin: 54, bufferPages: true });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;
  const bottom = doc.page.height - doc.page.margins.bottom;

  /** Room left before the footer, which owns the last 40pt. */
  const floor = bottom - 40;

  const reference =
    contract.reference ??
    `SC-${contract.signedAt.getFullYear()}-${String(contract.signedAt.getMonth() + 1).padStart(2, "0")}${String(contract.signedAt.getDate()).padStart(2, "0")}`;

  /** Starts a page and returns the y to begin writing at. */
  const newPage = () => {
    doc.addPage();
    return doc.page.margins.top;
  };

  // ------------------------------------------------------------- letterhead
  doc.rect(left, 40, width, 3.5).fill(BRAND);

  doc.fillColor(INK).font("Helvetica-Bold").fontSize(19).text("ShopCore", left, 62);
  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(7.5)
    .text("RETAIL OPERATING SYSTEM", left, 85, { characterSpacing: 1.5 });

  doc
    .fillColor(BRAND)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text("SERVICE AGREEMENT", left, 62, { width, align: "right", characterSpacing: 1.2 });
  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(8.5)
    .text(reference, left, 76, { width, align: "right" });
  doc.text(`${contract.templateName} · v${contract.templateVersion}`, left, 88, {
    width,
    align: "right",
  });

  doc.moveTo(left, 108).lineTo(right, 108).lineWidth(0.75).stroke(RULE);

  // ----------------------------------------------------------- the parties
  /*
   * Both sides, identified the same way.
   *
   * The earlier version printed "ShopCore" against the customer's full
   * registered name — one party described by a brand and the other by its
   * legal identity. A contract is between two identified persons, so each
   * column now carries a name, a tax and registration reference, an address
   * and a way to serve notice, and the columns are the same shape so neither
   * side reads as an afterthought.
   */
  let y = 122;

  const columnHalf = width / 2 - 12;

  /** One party's column, returning the y it finished at. */
  const party = (x: number, caption: string, name: string, lines: string[]) => {
    doc
      .fillColor(MUTED)
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .text(caption, x, y, { characterSpacing: 1, width: columnHalf });

    doc
      .fillColor(INK)
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(name, x, y + 12, { width: columnHalf });

    let lineY = doc.y + 2;

    doc.fillColor(MUTED).font("Helvetica").fontSize(8);

    for (const line of lines) {
      doc.text(line, x, lineY, { width: columnHalf });
      lineY = doc.y + 1;
    }

    return lineY;
  };

  /** Skips the details nobody filled in, rather than printing empty labels. */
  const detail = (label: string, value: string | null | undefined) =>
    value && value.trim() ? `${label}: ${value.trim()}` : null;

  const providerLines = [
    detail("TIN", contract.providerTin),
    detail("Reg. No", contract.providerRegistrationNo),
    contract.providerAddress?.trim() || null,
    detail("Email", contract.providerEmail),
    detail("Tel", contract.providerPhone),
    "referred to as \"the Provider\"",
  ].filter((line): line is string => Boolean(line));

  const customerLines = [
    detail("TIN", contract.customerTin),
    contract.customerAddress?.trim() || null,
    detail("Email", contract.customerEmail),
    detail("Tel", contract.customerPhone),
    "referred to as \"the Customer\"",
  ].filter((line): line is string => Boolean(line));

  const providerBottom = party(
    left,
    "BETWEEN",
    contract.providerLegalName?.trim() || "ShopCore",
    providerLines,
  );

  const customerBottom = party(
    left + width / 2 + 12,
    "AND",
    contract.customerLegalName?.trim() || contract.companyName || contract.signerName,
    customerLines,
  );

  y = Math.max(providerBottom, customerBottom) + 10;

  // -------------------------------------------------------- what was agreed
  const facts: [string, string][] = [
    ["PLAN", contract.planName],
    ["BILLING", CYCLE_LABEL[contract.billingCycle] ?? contract.billingCycle],
    ["AMOUNT", money(contract.amount, contract.currency)],
    ["SIGNED", longDate(contract.signedAt)],
  ];

  /*
   * The commercial terms, lifted out of the prose into a band at the top.
   * These four are what anybody opening this document is checking, and hunting
   * for them inside clause 1 is exactly the friction a contract does not need.
   */
  doc.roundedRect(left, y, width, 46, 6).fill(WASH);

  const column = width / facts.length;
  facts.forEach(([label, value], index) => {
    const x = left + index * column + 12;
    doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(7).text(label, x, y + 11, {
      characterSpacing: 0.8,
    });
    doc
      .fillColor(INK)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(value, x, y + 24, { width: column - 20, lineBreak: false, ellipsis: true });
  });

  y += 52;

  /*
   * The amount spelled out under the band.
   *
   * A figure alone can be altered by one keystroke and still look right;
   * writing it in words beside the numeral is the oldest and cheapest defence
   * a paper contract has, and there is no reason to give it up here.
   */
  doc
    .fillColor(MUTED)
    .font("Helvetica-Oblique")
    .fontSize(8)
    .text(
      `Amount in words: ${amountInWords(Number(contract.amount ?? 0))} ${contract.currency}.`,
      left,
      y,
      { width },
    );

  /* Measured, not assumed: a very large amount spells out onto a second line. */
  y = doc.y + 14;

  // ------------------------------------------------------------ the clauses
  for (const block of parseBody(contract.body)) {
    if (block.kind === "gap") {
      y += 6;
      continue;
    }

    const font =
      block.kind === "paragraph" ? "Helvetica" : block.kind === "title" ? "Helvetica-Bold" : "Helvetica-Bold";
    const size = block.kind === "title" ? 12 : block.kind === "heading" ? 9.5 : 9.5;
    const indent = block.kind === "paragraph" ? 14 : 0;
    const textWidth = width - indent;

    doc.font(font).fontSize(size);
    const height = doc.heightOfString(block.text, { width: textWidth, lineGap: 2.5 });

    /*
     * A heading is moved to the next page with at least a line of its clause,
     * rather than being left stranded at the foot of one.
     */
    const needed = block.kind === "heading" ? height + 26 : height;
    if (y + needed > floor) y = newPage();

    if (block.kind === "title") {
      doc.fillColor(INK).text(block.text, left, y, { width: textWidth, characterSpacing: 0.5 });
      y += height + 4;
      doc.moveTo(left, y).lineTo(left + 56, y).lineWidth(2).stroke(BRAND);
      y += 12;
      continue;
    }

    doc
      .fillColor(block.kind === "heading" ? BRAND : INK)
      .text(block.text, left + indent, y, { width: textWidth, lineGap: 2.5, align: "left" });

    y += height + (block.kind === "heading" ? 5 : 3);
  }

  // -------------------------------------------------------- signature block
  /*
   * Both parties, side by side, kept whole.
   *
   * An agreement signed by one side reads as a form somebody filled in. The
   * provider's signature and stamp come from the template — they are the same
   * on every contract issued, so an operator uploads them once in the console
   * rather than per customer — and are snapshotted onto the signature so a
   * change of director next year does not rewrite what an existing contract
   * shows.
   *
   * Splitting this panel across a page break would put a name on one page and
   * the mark on the next, which is precisely the thing a signature exists to
   * make unambiguous, so it moves whole.
   */
  const SIGNATURE_HEIGHT = 210;
  if (y + SIGNATURE_HEIGHT > floor) y = newPage();
  else y += 26;

  /*
   * The execution statement, above the marks.
   *
   * Signatures sitting under the last clause with nothing between them say
   * where two people wrote their names; they do not say what the writing did.
   * One sentence naming the parties, the date and the governing law turns a
   * pair of images into an executed agreement, and it is the line a reader
   * looks for when they want to know whether a document is in force.
   */
  const execution =
    `IN WITNESS WHEREOF the parties have executed this agreement on ${longDate(contract.signedAt)}` +
    (contract.governingLaw?.trim()
      ? `, and agree that it is governed by the laws of ${contract.governingLaw.trim()}.`
      : ".");

  doc.fillColor(INK).font("Helvetica").fontSize(9);
  doc.text(execution, left, y, { width, lineGap: 2.5 });

  y = doc.y + 16;

  doc.moveTo(left, y).lineTo(right, y).lineWidth(0.75).stroke(RULE);
  y += 18;

  const columnWidth = width / 2 - 14;

  /** One party's block: caption, mark, stamp, ruled line, name and date. */
  const signatory = (
    x: number,
    caption: string,
    mark: string | null | undefined,
    stampImage: string | null | undefined,
    name: string,
    subtitle: string,
  ) => {
    doc
      .fillColor(MUTED)
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .text(caption, x, y, { characterSpacing: 1, width: columnWidth });

    const signatureImage = decodeDataUrl(mark ?? null);
    if (signatureImage) {
      try {
        /*
         * `fit` keeps a photographed signature in proportion. Stretching
         * somebody's mark to fill a box is the one thing you cannot do to a
         * signature.
         */
        doc.image(signatureImage, x, y + 16, { fit: [columnWidth - 90, 52] });
      } catch {
        // An unreadable image leaves the line blank rather than failing the
        // download; the typed name below still identifies the signer.
      }
    }

    const stampBuffer = decodeDataUrl(stampImage ?? null);
    if (stampBuffer) {
      try {
        // To the right of the mark, the way a stamp lands beside a signature
        // on paper rather than on top of it.
        doc.image(stampBuffer, x + columnWidth - 76, y + 12, { fit: [72, 62] });
      } catch {
        // Same reasoning as the signature above.
      }
    }

    const lineY = y + 80;
    doc.moveTo(x, lineY).lineTo(x + columnWidth, lineY).lineWidth(0.75).stroke(RULE);

    doc
      .fillColor(INK)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(name, x, lineY + 7, { width: columnWidth, lineBreak: false, ellipsis: true });

    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(8.5)
      .text(subtitle, x, lineY + 21, { width: columnWidth, lineBreak: false, ellipsis: true });

    doc.text(longDate(contract.signedAt), x, lineY + 34, { width: columnWidth });
  };

  signatory(
    left,
    "FOR THE PROVIDER",
    contract.providerSignatureImage,
    contract.providerStampImage,
    contract.providerSignerName || "ShopCore",
    contract.providerSignerTitle || "Authorised signatory",
  );

  signatory(
    left + width / 2 + 14,
    "FOR THE CUSTOMER",
    contract.signatureImage,
    contract.stampImage,
    contract.signerName,
    contract.companyName ? `for ${contract.companyName}` : "Authorised signatory",
  );

  // ------------------------------------------------------------ every page
  const range = doc.bufferedPageRange();

  /*
   * Indexed from `range.start`, not from zero. The buffer holds only the pages
   * still open, so on a document that had already been flushed those are not
   * the same number and `switchToPage(0)` throws.
   */
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);

    const footY = doc.page.height - doc.page.margins.bottom + 12;

    /*
     * The bottom margin is dropped while the footer is written.
     *
     * The footer sits *below* the margin by design, and pdfkit reads any text
     * that crosses the bottom margin as an overflow and helpfully starts a new
     * page — which then gets a footer of its own, and so on. A two-page
     * agreement came out as six blank-tailed pages. Zeroing the margin for the
     * duration says "this is deliberate", and it is restored immediately so
     * nothing else inherits it.
     */
    const keptMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    doc.moveTo(left, footY - 8).lineTo(right, footY - 8).lineWidth(0.5).stroke(RULE);

    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(7.5)
      .text(`${reference} · ${contract.companyName ?? contract.signerName}`, left, footY, {
        width: width / 2,
        lineBreak: false,
        ellipsis: true,
      });

    doc.text(`Page ${i - range.start + 1} of ${range.count}`, left + width / 2, footY, {
      width: width / 2,
      align: "right",
      lineBreak: false,
    });

    doc.page.margins.bottom = keptMargin;
  }

  doc.end();
  return done;
}
