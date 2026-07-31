import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeSelector } from "@/components/settings/ThemeSelector";
import SecurityCenter from "@/components/landing/SecurityCenter";

function SecurityPageContent() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1500px] items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <img
              src="/shopcore-icon.png"
              alt="ShopCore"
              className="h-11 w-11 object-contain"
            />

            <div>
              <p className="text-lg font-black leading-tight text-foreground">
                ShopCore
              </p>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Enterprise Business OS
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 text-sm font-bold md:flex">
            <ThemeSelector compact className="border-0" />

            <Link
              to="/workspace"
              className="rounded-full border px-4 py-2 border-border bg-muted text-muted-foreground hover:bg-muted/80 transition"
            >
              Workspace
            </Link>

            <Link
              to="/pricing"
              className="rounded-full border px-4 py-2 border-border bg-muted text-muted-foreground hover:bg-muted/80 transition"
            >
              Pricing
            </Link>

            <Link
              to="/modules"
              className="rounded-full border px-4 py-2 border-border bg-muted text-muted-foreground hover:bg-muted/80 transition"
            >
              Modules
            </Link>

            <Link
              to="/offline"
              className="rounded-full border px-4 py-2 border-border bg-muted text-muted-foreground hover:bg-muted/80 transition"
            >
              Offline
            </Link>

            <Link
              to="/ebm"
              className="rounded-full border px-4 py-2 border-border bg-muted text-muted-foreground hover:bg-muted/80 transition"
            >
              EBM
            </Link>

            <Link
              to="/security"
              className="rounded-full border px-4 py-2 border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200 transition"
            >
              Security
            </Link>

            <Link
              to="/auth"
              className="rounded-full px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 transition"
            >
              Sign in
            </Link>
          </nav>

          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground transition hover:bg-muted/80 hover:text-foreground md:hidden"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Home
          </Link>
        </div>
      </header>

      <section id="security">
        <SecurityCenter />
      </section>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/shopcore-icon.png"
              alt="ShopCore"
              className="h-10 w-10 object-contain"
            />

            <div>
              <p className="font-black text-foreground">ShopCore</p>
              <p className="text-xs font-semibold text-muted-foreground">
                Enterprise Business Operating System
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm font-bold text-muted-foreground">
            <Link to="/workspace" className="hover:text-foreground">
              Workspace
            </Link>
            <Link to="/pricing" className="hover:text-foreground">
              Pricing
            </Link>
            <Link to="/modules" className="hover:text-foreground">
              Modules
            </Link>
            <Link to="/offline" className="hover:text-foreground">
              Offline
            </Link>
            <Link to="/ebm" className="hover:text-foreground">
              EBM
            </Link>
            <Link to="/security" className="hover:text-foreground">
              Security
            </Link>
            <Link to="/auth" className="hover:text-foreground">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

export default function SecurityPage() {
  return <SecurityPageContent />;
}
