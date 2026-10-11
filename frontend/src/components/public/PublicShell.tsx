import { useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { ArrowRight, Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LanguageSelector } from "@/components/settings/LanguageSelector";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
import { PoweredBy } from "@/components/AppFooter";
import { cn } from "@/lib/utils";

/**
 * The frame every signed-out marketing page sits in.
 *
 * Built from the same tokens as the app and the sign-in screen — `background`,
 * `card`, `border`, `primary`, the same weights and the same radii — so a
 * person moving from the landing page into signup and then into the workspace
 * stays inside one product. Before this, the public pages each drew their own
 * navigation with literal `blue-600` buttons and their own footer, which meant
 * three different products depending on which URL you arrived at, and none of
 * them followed the theme toggle.
 */

const NAV_LINKS = [
  { to: "/#modules", label: "Modules" },
  { to: "/pricing", label: "Pricing" },
  { to: "/ebm", label: "EBM" },
  { to: "/security", label: "Security" },
];

const FOOTER_GROUPS = [
  {
    title: "Product",
    links: [
      { to: "/#modules", label: "Modules" },
      { to: "/pricing", label: "Pricing" },
      { to: "/ebm", label: "EBM & RRA" },
      { to: "/security", label: "Security" },
    ],
  },
  {
    title: "Company",
    links: [
      { to: "/support-center", label: "Support" },
      { to: "/terms", label: "Terms" },
      { to: "/privacy", label: "Privacy" },
      { to: "/trust/compliance", label: "Compliance" },
    ],
  },
];

export function PublicNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        {/*
          The brand has to give ground on a narrow screen. At 390px the full
          lockup — 40px mark, wordmark, and "RETAIL OPERATING SYSTEM" set with
          0.18em of tracking — plus the actions on the right came to 435px, and
          the header pushed the whole page into a horizontal scroll. The
          strapline is the part nobody reads on a phone, so it goes first.
        */}
        <Link to="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <img
            src="/shopcore-icon.png"
            alt=""
            aria-hidden="true"
            className="h-8 w-8 shrink-0 object-contain sm:h-10 sm:w-10"
          />
          <span className="min-w-0">
            <span className="block truncate text-base font-black leading-tight text-foreground">
              ShopCore
            </span>
            <span className="hidden text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground sm:block">
              Retail Operating System
            </span>
          </span>
        </Link>

        <nav className="ml-6 hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) =>
            /*
              A hash link is a jump within the current page, not a route. Given
              to NavLink it resolves to the path before the "#", so "/#modules"
              matched "/" and drew Modules as the selected item on every visit
              to the home page.
            */
            link.to.includes("#") ? (
              <a
                key={link.to}
                href={link.to}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
              >
                {link.label}
              </a>
            ) : (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-lg px-3 py-2 text-sm font-semibold transition",
                    isActive
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )
                }
              >
                {link.label}
              </NavLink>
            ),
          )}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            <LanguageSelector compact />
            <ThemeToggle />
          </div>

          <Link
            to="/auth"
            className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground sm:block"
          >
            Sign in
          </Link>

          <Button asChild size="sm" className="group rounded-lg px-4 font-semibold">
            <Link to="/signup">
              Start free
              <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </Button>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-card px-4 py-3 lg:hidden">
          <nav className="grid gap-1">
            {NAV_LINKS.map((link) =>
              link.to.includes("#") ? (
                <a
                  key={link.to}
                  href={link.to}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  {link.label}
                </Link>
              ),
            )}

            <Link
              to="/auth"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted"
            >
              Sign in
            </Link>
          </nav>

          <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 sm:hidden">
            <LanguageSelector compact />
            <ThemeToggle />
          </div>
        </div>
      )}
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/*
          The brand block keeps the width it needs for its sentence; the link
          groups sit beside it rather than being pushed to the far edge, which
          is what left a wide empty channel across the middle of the footer.
        */}
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link to="/" className="flex items-center gap-3">
              <img src="/shopcore-icon.png" alt="" aria-hidden="true" className="h-10 w-10 object-contain" />
              <span className="text-base font-bold text-foreground">ShopCore</span>
            </Link>

            <p className="mt-4 max-w-xs text-sm font-medium leading-6 text-muted-foreground">
              The till, the stock room and the books, in one place — built for Rwandan retail.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-16 gap-y-8 sm:gap-x-24">
            {FOOTER_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {group.title}
                </p>

                <ul className="mt-4 space-y-2.5">
                  {group.links.map((link) => (
                    <li key={link.to}>
                      <Link
                        to={link.to}
                        className="text-sm font-semibold text-muted-foreground transition hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} ShopCore. All rights reserved.
          </p>
          <PoweredBy />
        </div>
      </div>
    </footer>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="shopcore-theme-scope min-h-screen bg-background text-foreground">
      <PublicNav />
      <main>{children}</main>
      <PublicFooter />
    </div>
  );
}
