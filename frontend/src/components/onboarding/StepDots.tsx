import { cn } from "@/lib/utils";

/**
 * Where you are in signing up.
 *
 * A row of dots rather than a labelled rail: the four steps have short,
 * obvious names that the heading beside them already says, so spelling them
 * out again is furniture. The current step widens instead of changing colour
 * alone, which stays readable for anyone who cannot separate the two greys.
 */
export function StepDots({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {Array.from({ length: total }).map((_, index) => {
          const position = index + 1;

          return (
            <span
              key={position}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                position === current
                  ? "w-7 bg-primary"
                  : position < current
                    ? "w-4 bg-primary/40"
                    : "w-4 bg-border",
              )}
            />
          );
        })}
      </div>

      <span className="ml-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label ?? `Step ${current} of ${total}`}
      </span>
    </div>
  );
}
