import type { ReactNode } from "react";

export function PlatformPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="rounded-[2rem] border border-border bg-card p-6 text-card-foreground shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">
        {eyebrow}
      </p>

      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-muted-foreground">
            {description}
          </p>
        </div>

        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </div>
  );
}
