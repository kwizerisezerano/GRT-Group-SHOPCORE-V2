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
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-blue-200 bg-blue-50 text-blue-700";

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
    <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          {icon}
        </div>
        <h3 className="text-lg font-black text-slate-950">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export function RowCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4">
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-500">
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
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
        {icon}
      </div>
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          {label}
        </p>
        <div className="mt-1 text-sm font-black text-slate-950">{value}</div>
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-black text-slate-950">{value}</p>
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
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-700",
  };

  return (
    <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
          {label}
        </p>
        <div className={`h-2 w-10 rounded-full border ${tones[tone]}`} />
      </div>
      <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-2 text-xs font-bold text-slate-500">{trend}</p>
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
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-blue-200 bg-blue-50 text-blue-700";

  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            {title}
          </p>
          <p className="mt-2 text-4xl font-black text-slate-950">{score}%</p>
        </div>

        <div className={`rounded-2xl border px-3 py-2 text-xs font-black ${color}`}>
          {score >= 90 ? "Excellent" : score >= 75 ? "Stable" : "Review"}
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {items.map((item) => (
          <div
            key={item}
            className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
          >
            <span className="text-xs font-bold text-slate-600">{item}</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
        ))}
      </div>
    </section>
  );
}