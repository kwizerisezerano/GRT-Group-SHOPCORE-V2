import { Outlet } from "react-router-dom";
import PlatformTopbar from "@/pages/platform-admin/components/PlatformTopbar";
import PlatformCommandPalette from "@/pages/platform-admin/components/PlatformCommandPalette";
import PlatformSidebar from "@/pages/platform-admin/components/PlatformSidebar";
import { LanguageSelector } from "@/components/settings/LanguageSelector";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
import { useLanguage } from "@/contexts/LanguageContext";

export default function PlatformAdminLayout() {
  const { language } = useLanguage();

  const labels = {
    en: {
      workspace: "Platform administration workspace",
      footer: "ShopCore Cloud Platform · v1.0.0 Enterprise",
    },
    fr: {
      workspace: "Espace d’administration de la plateforme",
      footer: "Plateforme Cloud ShopCore · v1.0.0 Entreprise",
    },
    rw: {
      workspace: "Ahakorerwa ubuyobozi bwa platform",
      footer: "ShopCore Cloud Platform · v1.0.0 Enterprise",
    },
  }[language];

  return (
    <main className="h-screen bg-background text-foreground">
      <div className="flex h-full min-h-0">
        <div className="hidden h-full shrink-0 lg:block">
          <PlatformSidebar />
        </div>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="relative z-[70] shrink-0">
            <PlatformTopbar />
            <PlatformCommandPalette />
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-2 text-card-foreground lg:px-8">
            <p className="hidden text-xs font-bold text-muted-foreground md:block">
              {labels.workspace}
            </p>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <LanguageSelector compact />
              <ThemeToggle />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-background">
            <div className="px-4 py-6 lg:px-8">
              <Outlet />
            </div>

            <footer className="border-t border-border bg-card px-6 py-4 text-card-foreground">
              <p className="text-xs font-bold text-muted-foreground">
                {labels.footer}
              </p>
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}
