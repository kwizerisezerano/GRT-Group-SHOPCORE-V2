import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The workspace footer.
 *
 * The signed-in shell had none at all: every screen ran to the bottom of the
 * viewport and stopped, so there was nowhere for the build attribution, the
 * year, or the two links people look for at the end of a page. Kept to one
 * quiet line so it reads as a footer rather than as another panel competing
 * with the content above it.
 *
 * ## Why the legal links behave differently inside the app
 *
 * Privacy and Terms are public marketing pages, rendered by a different shell.
 * Followed from inside a workspace they replaced the whole application — no
 * sidebar, no header, no way back except the browser's own button — which is a
 * trapdoor, not a link. They are reference documents somebody glances at and
 * returns from, so inside the app they open in a tab of their own and leave the
 * workspace where it was. Support is a workspace page and stays in place.
 *
 * On the public shells, where every link already lives in the same site, they
 * behave as ordinary links; `insideApp` is what tells the two apart rather than
 * this component trying to guess from the URL.
 */
export function AppFooter({
  className,
  insideApp = false,
}: {
  className?: string;
  /** Set by the signed-in shells, where leaving the page loses the workspace. */
  insideApp?: boolean;
}) {
  const year = new Date().getFullYear();

  const legal = [
    { to: "/privacy", label: "Privacy" },
    { to: "/terms", label: "Terms" },
  ];

  return (
    <footer
      className={cn("shrink-0 border-t border-border px-4 sm:px-6", className)}
    >
      <div className="mx-auto flex max-w-[1480px] flex-col gap-3 px-4 py-5 text-xs sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
          <img
            src="/shopcore-icon.png"
            alt=""
            aria-hidden="true"
            className="h-5 w-5 shrink-0 object-contain"
          />
          <span className="font-semibold text-foreground">ShopCore</span>
          <span aria-hidden="true">·</span>
          <span>&copy; {year}</span>
          <span aria-hidden="true">·</span>
          <span>
            Powered by{" "}
            <span className="font-semibold text-foreground">GlobalTech Rwanda</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4 font-medium text-muted-foreground">
          <Link to="/support" className="transition hover:text-foreground">
            Support
          </Link>

          {legal.map((item) =>
            insideApp ? (
              <a
                key={item.to}
                href={item.to}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 transition hover:text-foreground"
              >
                {item.label}
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            ) : (
              <Link key={item.to} to={item.to} className="transition hover:text-foreground">
                {item.label}
              </Link>
            ),
          )}
        </div>
      </div>
    </footer>
  );
}

/**
 * The same attribution as a single line, for shells that already have a
 * footer of their own (the public marketing pages, the platform console).
 */
export function PoweredBy({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Powered by{" "}
      <span className="font-semibold text-foreground">GlobalTech Rwanda</span>
    </p>
  );
}
