import type { ReactNode } from "react";

export function Notice({
  tone,
  text,
}: {
  tone: "blue" | "rose";
  text: string;
}) {
  const styles =
    tone === "rose"
      ? "border-rose-500/25 bg-rose-500/10 text-rose-700"
      : "border-blue-500/25 bg-blue-500/10 text-blue-700";

  return (
    <div className={`rounded-2xl border p-5 text-sm font-bold ${styles}`}>
      {text}
    </div>
  );
}

export function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[1.5rem] border border-border bg-muted/40 p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-700">
          {icon}
        </div>
        <h3 className="text-lg font-black text-foreground">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export function RowCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4">
      {children}
    </div>
  );
}

export function DataList({
  items,
  empty,
  render,
}: {
  items: any[];
  empty: string;
  render: (item: any) => ReactNode;
}) {
  if (!items.length) return <EmptyText text={empty} />;
  return <div className="space-y-3">{items.map(render)}</div>;
}

export function EmptyText({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-sm font-bold text-muted-foreground">
      {text}
    </div>
  );
}

export function InfoItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-700">
        {icon}
      </div>
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        <div className="mt-1 text-sm font-black text-foreground">{value}</div>
      </div>
    </div>
  );
}

export function Detail({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm font-black text-foreground">{value}</p>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  tone,
  trend,
}: {
  label: string;
  value: ReactNode;
  tone: "blue" | "emerald" | "orange" | "rose" | "violet" | "cyan";
  trend: string;
}) {
  const tones: Record<string, string> = {
    blue: "border-blue-500/25 bg-blue-500/10 text-blue-700",
    emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700",
    orange: "border-orange-500/25 bg-orange-500/10 text-orange-700",
    rose: "border-rose-500/25 bg-rose-500/10 text-rose-700",
    violet: "border-violet-500/25 bg-violet-500/10 text-violet-700",
    cyan: "border-cyan-500/25 bg-cyan-500/10 text-cyan-700",
  };

  return (
    <div className="rounded-[1.25rem] border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <div className={`h-2 w-10 rounded-full border ${tones[tone]}`} />
      </div>
      <p className="mt-3 text-2xl font-black text-foreground">{value}</p>
      <p className="mt-2 text-xs font-bold text-muted-foreground">{trend}</p>
    </div>
  );
}

export function ScoreCard({
  title,
  score,
  tone,
  items,
}: {
  title: string;
  score: number;
  tone: "blue" | "emerald";
  items: string[];
}) {
  const color =
    tone === "emerald"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700"
      : "border-blue-500/25 bg-blue-500/10 text-blue-700";

  return (
    <section className="rounded-[1.5rem] border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
            {title}
          </p>
          <p className="mt-2 text-4xl font-black text-foreground">{score}%</p>
        </div>

        <div className={`rounded-2xl border px-3 py-2 text-xs font-black ${color}`}>
          {score >= 90 ? "Excellent" : score >= 75 ? "Stable" : "Review"}
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {items.map((item) => (
          <div
            key={item}
            className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2"
          >
            <span className="text-xs font-bold text-muted-foreground">{item}</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
        ))}
      </div>
    </section>
  );
}