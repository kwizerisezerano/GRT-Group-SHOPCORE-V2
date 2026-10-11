import { useMemo } from "react";

import { cn } from "@/lib/utils";

/**
 * The agreement, set as a document rather than dumped as text.
 *
 * ## Why this exists
 *
 * Both places that show a contract used `<pre>{body}</pre>`. Everything was on
 * screen and none of it was findable: no heading stood out, clauses ran into
 * one another at one weight and one size, and the reader had to parse the
 * structure themselves. A contract is something a person has to navigate —
 * often months later, looking for one clause.
 *
 * The body is plain text on purpose: the console's template editor should not
 * require an author to learn markup to change a payment term. The structure is
 * still there in the conventions people already use, so this reads them —
 * exactly the same rules as the PDF renderer (`contracts.pdf.ts`), so the
 * screen and the printed document agree about what is a heading:
 *
 *   "3. SERVICE"          a numbered clause heading
 *   "SERVICE AGREEMENT"   a short all-caps line — the first is the title
 *   "   indented text"    belongs to the clause above
 *
 * Anything unrecognised is a paragraph, so an author cannot write something
 * this refuses to render.
 */

type Block =
  | { kind: "title"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string };

function parse(body: string): Block[] {
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
      return;
    }

    if (/^\d+\.\s+[A-Z][A-Z'’(),./&\s-]*$/.test(line)) {
      flush();
      blocks.push({ kind: "heading", text: line });
      return;
    }

    // Length-capped so a sentence shouted in capitals is not read as a heading.
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

export function ContractDocument({ body, className }: { body: string; className?: string }) {
  const blocks = useMemo(() => parse(body), [body]);

  return (
    <article className={cn("space-y-1", className)}>
      {blocks.map((block, index) => {
        if (block.kind === "title") {
          return (
            <header key={index} className="pb-1">
              <h2 className="text-base font-bold tracking-tight text-foreground">{block.text}</h2>
              <span aria-hidden="true" className="mt-1.5 block h-0.5 w-12 rounded-full bg-primary" />
            </header>
          );
        }

        if (block.kind === "heading") {
          return (
            <h3
              key={index}
              className="pt-3 text-[13px] font-bold uppercase tracking-wide text-primary"
            >
              {block.text}
            </h3>
          );
        }

        return (
          <p key={index} className="pl-3 text-[13px] leading-relaxed text-foreground">
            {block.text}
          </p>
        );
      })}
    </article>
  );
}
