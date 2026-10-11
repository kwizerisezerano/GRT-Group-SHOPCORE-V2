import type { ReactNode } from "react";

/**
 * A console page's title row, in the workspace's own `.page-header` style.
 *
 * ## Why the title lives here again
 *
 * This briefly rendered nothing but the actions, on the reasoning that the
 * console topbar already named the page. That topbar has since been folded
 * into the single application header — the console had two stacked headers
 * where the workspace has one — so the page name needs a home, and the
 * workspace puts it exactly here: a title, an optional description, a rule
 * beneath, actions on the right.
 *
 * `.page-header`, `.page-title` and `.page-description` are the workspace's
 * own classes from index.css rather than a lookalike, so the two cannot drift.
 *
 * The eyebrow is dropped. It was a third line of small caps above every title
 * ("TENANT OPERATIONS", "PLATFORM IDENTITY") saying roughly what the title
 * said, and no workspace page has one.
 */
export function PlatformPageHeader({
  title,
  description,
  actions,
}: {
  /** Accepted for the call sites that still pass it; not rendered. */
  eyebrow?: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
}) {
  if (!title && !actions) return null;

  return (
    <div className="page-header">
      <div className="min-w-0">
        {title ? <h1 className="page-title">{title}</h1> : null}
        {description ? <p className="page-description">{description}</p> : null}
      </div>

      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
