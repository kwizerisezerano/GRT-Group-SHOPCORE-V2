import { LogOut, User } from "lucide-react";
import { Link, Outlet, useNavigate } from "react-router-dom";

import { AppFooter } from "@/components/AppFooter";
import { LanguageSelector } from "@/components/settings/LanguageSelector";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import PlatformCommandPalette from "@/pages/platform-admin/components/PlatformCommandPalette";
import PlatformSidebar from "@/pages/platform-admin/components/PlatformSidebar";

/**
 * The console's frame — one header, like the workspace.
 *
 * ## What changed
 *
 * The console had two stacked headers: the application bar, and beneath it a
 * `PlatformTopbar` carrying the page name, a command trigger, a bell, a help
 * button, an "Operational" badge, the signed-in address and a Sign out button.
 * The workspace has one bar, and puts sign-out inside the avatar menu where
 * people look for it. Two headers is 140px of chrome before any content and
 * two different answers to "where do I sign out".
 *
 * So: one bar, identical in structure to the workspace's — brand left, theme,
 * language and the avatar menu right. The page name moved down into
 * `PlatformPageHeader`, which is where the workspace shows it.
 *
 * Dropped with the second bar: the bell and help buttons (neither did
 * anything), and the "Operational" badge, which was a hardcoded string rather
 * than a health check. The command palette is kept — it is genuinely useful —
 * and still opens on its keyboard shortcut.
 */
export default function PlatformAdminLayout() {
  const { language } = useLanguage();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const labels = {
    en: { brand: "ShopCore Cloud", strapline: "Platform Administration", owner: "Platform owner" },
    fr: {
      brand: "ShopCore Cloud",
      strapline: "Administration de la plateforme",
      owner: "Propriétaire de la plateforme",
    },
    rw: { brand: "ShopCore Cloud", strapline: "Ubuyobozi bwa platform", owner: "Nyir’urubuga" },
  }[language];

  const email = user?.email ?? "";
  const initials = (user?.display_name ?? email ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      <header className="z-40 flex h-16 w-full shrink-0 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground shadow-md transition-colors duration-200 sm:px-6">
        <Link to="/platform-admin" className="flex min-w-0 items-center gap-2">
          <img
            src="/shopcore-icon.png"
            alt=""
            aria-hidden="true"
            className="h-10 w-10 shrink-0 object-contain drop-shadow-md"
          />

          <span className="hidden min-w-0 flex-col leading-tight sm:flex">
            <span className="truncate text-xl font-extrabold tracking-tight text-white">
              {labels.brand}
            </span>
            <span className="truncate text-[9px] font-semibold uppercase tracking-[0.16em] text-white/70">
              {labels.strapline}
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2 text-white">
          <ThemeToggle />
          <LanguageSelector compact />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="ml-2 flex h-auto items-center gap-2 rounded-full border border-white/20 px-2 py-1 hover:bg-background/10"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-background/20 text-xs font-medium text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-60" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{labels.owner}</p>
                  <p className="text-xs leading-none text-muted-foreground">{email}</p>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                <User className="mr-2 h-4 w-4" />
                <span>Go to my workspace</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={() => void signOut()}>
                <LogOut className="mr-2 h-4 w-4 text-red-500" />
                <span className="text-red-500">Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="hidden h-full shrink-0 lg:block">
          <PlatformSidebar />
        </div>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
          <PlatformCommandPalette />

          <div className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">
            <Outlet />
          </div>

          <AppFooter insideApp className="shrink-0" />
        </section>
      </div>
    </div>
  );
}
