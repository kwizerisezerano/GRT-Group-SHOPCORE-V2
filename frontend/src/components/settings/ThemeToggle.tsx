import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
  showLabel?: boolean;
};

export function ThemeToggle({
  className,
  showLabel = false,
}: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const dark = resolvedTheme === "dark";
  const targetLabel = dark ? t("theme.light") : t("theme.dark");

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={targetLabel}
      title={targetLabel}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-card px-3 text-card-foreground shadow-sm outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        showLabel ? "min-w-[116px]" : "w-10 px-0",
        className,
      )}
    >
      {dark ? (
        <Sun className="h-4 w-4 text-amber-400" />
      ) : (
        <Moon className="h-4 w-4 text-blue-700 dark:text-blue-300" />
      )}
      {showLabel ? (
        <span className="text-sm font-bold">{targetLabel}</span>
      ) : null}
    </button>
  );
}
