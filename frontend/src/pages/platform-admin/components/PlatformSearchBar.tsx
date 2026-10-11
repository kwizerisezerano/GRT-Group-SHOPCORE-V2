import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/hooks/useTranslation";

export function PlatformSearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder || t("actions.search");

  return (
    <div className="flex min-h-12 items-center gap-3 rounded-2xl border border-border bg-muted/40 px-4">
      <Search className="h-5 w-5 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={resolvedPlaceholder}
        aria-label={resolvedPlaceholder}
        className="border-0 bg-transparent text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
      />
    </div>
  );
}
