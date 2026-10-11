import { Check, ChevronDown, Globe2 } from "lucide-react";
import { useState } from "react";
import {
  SUPPORTED_LANGUAGES,
  type AppLanguage,
} from "@/i18n/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

type LanguageSelectorProps = {
  compact?: boolean;
  className?: string;
};

export function LanguageSelector({
  compact = false,
  className = "",
}: LanguageSelectorProps) {
  const {
    language,
    setLanguage,
    t,
  } = useLanguage();
  const [open, setOpen] = useState(false);
  const currentLanguage =
    SUPPORTED_LANGUAGES.find(
      (option) => option.code === language,
    ) || SUPPORTED_LANGUAGES[0];

  return (
    <div 
      className={cn("flex items-center gap-2 relative", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {!compact ? (
        <span className="text-sm font-semibold text-foreground">
          {t("language.label")}
        </span>
      ) : null}

      <button
        type="button"
        aria-label={t("language.label")}
        className="group inline-flex h-10 min-w-[140px] items-center gap-2 rounded-xl bg-card px-3 text-sm font-bold text-foreground outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
      >
        <img
          src={currentLanguage.flag}
          alt={currentLanguage.englishName}
          className="h-5 w-7 rounded object-cover"
        />
        <span className="min-w-0 flex-1 truncate text-left">
          {currentLanguage.nativeName}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-0.5 w-56 rounded-2xl border border-border bg-popover p-2 shadow-xl">
          {SUPPORTED_LANGUAGES.map((option) => {
            const active = option.code === language;

            return (
              <button
                key={option.code}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setLanguage(option.code as AppLanguage);
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 border-0 transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-popover-foreground hover:bg-muted",
                )}
              >
                <img
                  src={option.flag}
                  alt={option.englishName}
                  className="h-6 w-9 rounded object-cover"
                />
                <span className="flex-1 font-bold">
                  {option.nativeName}
                </span>
                {active ? <Check className="h-4 w-4" /> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
