import { PageShell } from "@/components/PageShell";
import type { LucideIcon } from "lucide-react";

interface StubPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
  actionLabel?: string;
  stats?: { label: string; value: string }[];
}

export function StubPage({ title, description, icon: Icon, actionLabel, stats }: StubPageProps) {
  return (
    <PageShell title={title} description={description} actionLabel={actionLabel}>
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {stats.map((stat) => (
            <div key={stat.label} className="kpi-card">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{stat.label}</p>
              <p className="text-2xl font-semibold font-data mt-1">{stat.value}</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-lg bg-muted/30">
        <Icon className="w-12 h-12 text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-md text-center">{description}</p>
      </div>
    </PageShell>
  );
}
