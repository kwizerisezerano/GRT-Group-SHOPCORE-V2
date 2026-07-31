import { AppWindow } from "lucide-react";
import { PlatformStatusBadge } from "@/pages/platform-admin/components/PlatformStatusBadge";
import { tenant360Modules } from "../tenant360Utils";
import { Section } from "../components/Tenant360Primitives";

export function ApplicationsTab({ metrics }: { metrics: any }) {
  return (
    <Section
      title="Installed Workspace Applications"
      icon={<AppWindow className="h-5 w-5" />}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tenant360Modules.map((item, index) => (
          <div
            key={item}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black text-slate-950">{item}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  Records monitored:{" "}
                  {(metrics.products + metrics.members + index * 9).toLocaleString()}
                </p>
              </div>

              <PlatformStatusBadge status="enabled" />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <MiniStat label="Health" value="Stable" />
              <MiniStat label="Version" value="1.0" />
              <MiniStat label="Access" value="Licensed" />
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-xs font-black text-slate-700">{value}</p>
    </div>
  );
}