import {
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

type ThemeSelectorProps = {
  compact?: boolean;
  className?: string;
};

export function ThemeSelector({
  compact = false,
  className = "",
}: ThemeSelectorProps) {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={[
        "flex h-9 w-9 items-center justify-center rounded-xl bg-card text-foreground transition hover:bg-muted",
        className,
      ].join(" ")}
    >
      {resolvedTheme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}
