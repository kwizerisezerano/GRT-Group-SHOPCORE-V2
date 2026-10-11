import type { ReactNode } from "react";

import { ContractDocument } from "@/components/contracts/ContractDocument";
import { cn } from "@/lib/utils";

/**
 * The whole agreement on screen — everything the PDF has, in the browser.
 *
 * ## Why this exists
 *
 * The signing screen used to show the clause text alone. Everything that makes
 * a document *a contract* was missing from it: who the two parties are, the
 * amount and term set out as commercial terms, the sentence that says the thing
 * has been executed, and the two signature blocks. All of that appeared for the
 * first time in the PDF, after the customer had already agreed.
 *
 * That is the wrong order. A person is being asked to accept an agreement, so
 * the agreement they read has to be the agreement they get — same parties, same
 * figures, same signatures, in the same places. This component is that document,
 * and it is deliberately laid out to match `contracts.pdf.ts` section for
 * section, so nobody opening the PDF afterwards wonders whether they signed
 * something else.
 *
 * ## Why the signature blocks are always drawn
 *
 * Even empty. An empty ruled block with "draw or upload here" on it is the
 * clearest possible answer to "where does my signature go" — the reader sees
 * the place before they fill it, exactly as they would holding paper. Hiding
 * the block until a mark exists means the one moment the guidance is needed is
 * the one moment nothing is shown.
 *
 * ## Theming
 *
 * The page uses the app's own tokens rather than a hard white sheet, so it is
 * readable in both themes. The two exceptions are the signature and stamp
 * images: those are near-black marks on transparent backgrounds that also print
 * onto white PDF paper, so they keep a white plate behind them — written
 * `bg-[#ffffff]` because index.css force-darkens `bg-white` in dark mode.
 */

export type PaperParty = {
  /** "BETWEEN" or "AND" — the two halves of the naming sentence. */
  caption: string;
  name: string;
  /** TIN, registration, address, email, phone — whichever are known. */
  details: string[];
  /** "the Provider" / "the Customer". */
  role: string;
};

export type PaperSignature = {
  caption: string;
  signature: string | null;
  stamp: string | null;
  name: string;
  subtitle: string;
  date: string | null;
  /** Shown inside the empty plate: "Draw or upload your signature". */
  emptyHint?: string;
  /** Draws attention to the slot the reader is the one expected to fill. */
  awaiting?: boolean;
};

export function ContractPaper({
  reference,
  templateName,
  templateVersion,
  provider,
  customer,
  terms,
  amountInWords,
  body,
  execution,
  signatures,
  footnote,
  className,
}: {
  reference: string;
  templateName: string;
  templateVersion: number;
  provider: PaperParty;
  customer: PaperParty;
  terms: { label: string; value: string }[];
  amountInWords?: string | null;
  body: string;
  execution?: string | null;
  signatures: [PaperSignature, PaperSignature];
  /** Anything the caller wants under the marks — a note, a warning, a button. */
  footnote?: ReactNode;
  className?: string;
}) {
  return (
    <article className={cn("space-y-6", className)}>
      {/* ------------------------------------------------------ letterhead */}
      <header className="space-y-3">
        <span aria-hidden="true" className="block h-1 w-full rounded-full bg-primary" />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold tracking-tight text-foreground">ShopCore</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Retail operating system
            </p>
          </div>

          <div className="text-right">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
              Service agreement
            </p>
            <p className="font-data text-[11px] text-muted-foreground">{reference}</p>
            <p className="text-[11px] text-muted-foreground">
              {templateName} · v{templateVersion}
            </p>
          </div>
        </div>

        <span aria-hidden="true" className="block h-px w-full bg-border" />
      </header>

      {/* --------------------------------------------------- the two parties */}
      <div className="grid gap-5 sm:grid-cols-2">
        <Party party={provider} />
        <Party party={customer} />
      </div>

      {/* ------------------------------------------------ commercial terms */}
      {/*
        Lifted out of the prose deliberately. The plan, the money and the dates
        are what anybody opening this document checks first, and hunting for
        them inside clause 2 is friction a contract does not need. The same four
        appear in the same order on the PDF.
      */}
      <div className="rounded-2xl border border-border bg-muted/40 p-4">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {terms.map((term) => (
            <div key={term.label}>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {term.label}
              </dt>
              <dd className="mt-1 text-sm font-bold text-foreground">{term.value}</dd>
            </div>
          ))}
        </dl>

        {amountInWords ? (
          <p className="mt-3 border-t border-border pt-2 text-[11px] italic text-muted-foreground">
            Amount in words: {amountInWords}.
          </p>
        ) : null}
      </div>

      {/* ---------------------------------------------------- the clauses */}
      <ContractDocument body={body} />

      {/* --------------------------------------------------- the execution */}
      {execution ? (
        <p className="border-t border-border pt-4 text-[13px] leading-relaxed text-foreground">
          {execution}
        </p>
      ) : null}

      {/* -------------------------------------------------- both signatures */}
      <div className="grid gap-6 sm:grid-cols-2">
        {signatures.map((entry) => (
          <SignatureBlock key={entry.caption} entry={entry} />
        ))}
      </div>

      {footnote}
    </article>
  );
}

function Party({ party }: { party: PaperParty }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {party.caption}
      </p>

      <p className="mt-1 text-[15px] font-bold text-foreground">{party.name}</p>

      <div className="mt-1 space-y-0.5">
        {party.details.map((line) => (
          <p key={line} className="text-xs text-muted-foreground">
            {line}
          </p>
        ))}
        <p className="text-xs italic text-muted-foreground">referred to as "{party.role}"</p>
      </div>
    </div>
  );
}

/**
 * One party's place to sign — the mark, the stamp beside it, a ruled line, and
 * the name under the line, the way a paper contract sets it.
 */
function SignatureBlock({ entry }: { entry: PaperSignature }) {
  const empty = !entry.signature;

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {entry.caption}
      </p>

      <div className="mt-2 flex items-end gap-3">
        {entry.signature ? (
          <span className="flex h-20 flex-1 items-center justify-start overflow-hidden rounded-xl bg-[#ffffff] px-3">
            <img
              src={entry.signature}
              alt={`Signature of ${entry.name}`}
              className="max-h-16 max-w-full object-contain"
            />
          </span>
        ) : (
          <span
            className={cn(
              "flex h-20 flex-1 items-center justify-center rounded-xl border border-dashed px-3 text-center text-[11px] leading-tight",
              entry.awaiting
                ? "border-primary/50 bg-primary/5 font-medium text-primary"
                : "border-border text-muted-foreground",
            )}
          >
            {entry.emptyHint ?? "Not signed"}
          </span>
        )}

        {entry.stamp ? (
          <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#ffffff] p-1.5">
            <img src={entry.stamp} alt="Company stamp" className="max-h-full max-w-full object-contain" />
          </span>
        ) : null}
      </div>

      <p
        className={cn(
          "mt-2 border-t pt-1.5 text-sm font-bold text-foreground",
          empty ? "border-dashed border-border" : "border-border",
        )}
      >
        {entry.name}
      </p>

      <p className="text-xs text-muted-foreground">{entry.subtitle}</p>
      {entry.date ? <p className="text-xs text-muted-foreground">{entry.date}</p> : null}
    </div>
  );
}
