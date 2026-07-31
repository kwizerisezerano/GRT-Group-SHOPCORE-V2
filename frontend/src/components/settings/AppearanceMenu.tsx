import {
  Languages,
  Moon,
  Settings2,
} from "lucide-react";
import { LanguageSelector } from "./LanguageSelector";
import { ThemeSelector } from "./ThemeSelector";
import { useLanguage } from "@/contexts/LanguageContext";

type AppearanceMenuProps = {
  className?: string;
};

export function AppearanceMenu({
  className = "",
}: AppearanceMenuProps) {
  const { t } = useLanguage();

  return (
    <section
      className={[
        "rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm",
        className,
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Settings2 className="h-5 w-5" />
        </div>

        <div>
          <h2 className="text-base font-black">
            {t("theme.label")} &{" "}
            {t("language.label")}
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            ShopCore saves these preferences on this
            device and restores them automatically.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold">
            <Languages className="h-4 w-4 text-primary" />
            {t("language.label")}
          </div>

          <LanguageSelector />
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold">
            <Moon className="h-4 w-4 text-primary" />
            {t("theme.label")}
          </div>

          <ThemeSelector />
        </div>
      </div>
    </section>
  );
}
