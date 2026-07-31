import type { ReactNode } from "react";

type Tone = "blue" | "emerald" | "orange" | "rose" | "violet" | "cyan";

const tones: Record<Tone, string> = {
  blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/35 dark:text-blue-300",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-300",
  orange: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/35 dark:text-orange-300",
  rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/35 dark:text-rose-300",
  violet: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/35 dark:text-violet-300",
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/35 dark:text-cyan-300",
};

export function PlatformKpiCard({
  icon,
  label,
  value,
  tone,
  helper,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper?: string;
  tone: Tone;
}) {
  return (
    <div className={`rounded-[1.5rem] border p-4 shadow-sm transition-shadow hover:shadow-md w-full flex flex-col ${tones[tone]}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card/80 shadow-sm shrink-0">
        {icon}
      </div>
      <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] break-words leading-tight line-clamp-2" title={label}>{label}</p>
      <p className="mt-1.5 text-xl font-black break-words leading-tight line-clamp-2" title={value}>{value}</p>
      {helper ? <p className="mt-1.5 text-xs font-bold opacity-80 break-words leading-tight line-clamp-2" title={helper}>{helper}</p> : null}
    </div>
  );
}
