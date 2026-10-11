import {
  Activity,
  Building2,
  CheckCircle2,
  CloudCog,
  Database,
  Fingerprint,
  LockKeyhole,
  Network,
  ServerCog,
  ShieldCheck,
} from "lucide-react";

type TrustCommandDashboardProps = {
  center?: "trust" | "legal" | "success";
};

const centerStyles = {
  trust: {
    accent: "text-blue-600 dark:text-blue-300",
    iconBg: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-300/20 dark:bg-blue-300/10 dark:text-blue-200",
    bar: "bg-blue-600 dark:bg-blue-300",
    chip: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-300/20 dark:bg-blue-300/10 dark:text-blue-100",
    panel: "from-blue-50 to-slate-100 dark:from-[#111827] dark:via-[#0B1220] dark:to-[#050816]",
  },
  legal: {
    accent: "text-blue-600 dark:text-blue-300",
    iconBg: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-300/20 dark:bg-blue-300/10 dark:text-blue-200",
    bar: "bg-blue-600 dark:bg-blue-300",
    chip: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-300/20 dark:bg-blue-300/10 dark:text-blue-100",
    panel: "from-blue-50 to-slate-100 dark:from-[#111827] dark:via-[#0B1220] dark:to-[#050816]",
  },
  success: {
    accent: "text-blue-600 dark:text-blue-300",
    iconBg: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-300/20 dark:bg-blue-300/10 dark:text-blue-200",
    bar: "bg-blue-600 dark:bg-blue-300",
    chip: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-300/20 dark:bg-blue-300/10 dark:text-blue-100",
    panel: "from-blue-50 to-slate-100 dark:from-[#111827] dark:via-[#0B1220] dark:to-[#050816]",
  },
};

const operatingLayers = [
  { label: "Identity", value: 98, icon: Fingerprint },
  { label: "Tenant Boundary", value: 100, icon: Building2 },
  { label: "Role Control", value: 96, icon: LockKeyhole },
  { label: "Audit Visibility", value: 99, icon: Activity },
  { label: "Offline Sync", value: 94, icon: CloudCog },
];

const trustNodes = [
  { label: "User", icon: Fingerprint },
  { label: "Workspace", icon: Building2 },
  { label: "Permissions", icon: LockKeyhole },
  { label: "Business Engine", icon: Network },
  { label: "Storage", icon: Database },
  { label: "Monitoring", icon: ServerCog },
];

export default function TrustCommandDashboard({
  center = "trust",
}: TrustCommandDashboardProps) {
  const style = centerStyles[center];

  return (
    <div className="relative overflow-hidden rounded-[24px] border border-border bg-card p-4 shadow-sm dark:bg-slate-900">
      <div
        className={[
          "relative overflow-hidden rounded-[20px] bg-gradient-to-br p-5 text-slate-950 dark:text-white",
          style.panel,
        ].join(" ")}
      >
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl dark:bg-white/10" />
        <div className="absolute -bottom-24 left-8 h-56 w-56 rounded-full bg-blue-300/10 blur-3xl dark:bg-blue-300/10" />

        <div className="relative flex items-start justify-between gap-4 border-b border-slate-200/10 pb-5 dark:border-white/10">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-white/45">
              ShopCore Control Plane
            </p>
            <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950 dark:text-white">
              Enterprise Operating Command
            </h2>
            <p className="mt-2 max-w-sm text-xs font-medium leading-5 text-slate-600 dark:text-white/60">
              Identity, tenant governance, permissions, synchronization, and
              audit visibility working as one controlled operating layer.
            </p>
          </div>

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/15 bg-slate-100/10 dark:border-white/15 dark:bg-white/10">
            <ShieldCheck className={["h-5 w-5", style.accent].join(" ")} />
          </div>
        </div>

        <div className="relative mt-5 grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
          <div className="rounded-2xl border border-slate-200/10 bg-card p-4 dark:border-white/10 dark:bg-slate-800">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-slate-950 dark:text-white">Operating posture</p>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-blue-700 dark:border-blue-300/20 dark:bg-blue-300/10 dark:text-blue-100">
                Active
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {operatingLayers.map((layer) => {
                const Icon = layer.icon;

                return (
                  <div key={layer.label}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Icon className={["h-4 w-4", style.accent].join(" ")} />
                        <span className="text-xs font-bold text-slate-700 dark:text-white/70">
                          {layer.label}
                        </span>
                      </div>

                      <span className="text-xs font-black text-slate-950 dark:text-white">
                        {layer.value}%
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-slate-200/15 dark:bg-white/15">
                      <div
                        className={["h-full rounded-full", style.bar].join(" ")}
                        style={{ width: `${layer.value}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/10 bg-card p-4 text-slate-950 dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-slate-950 dark:text-white">
                Request trust path
              </p>
              <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-300" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {trustNodes.map((node, index) => {
                const Icon = node.icon;

                return (
                  <div
                    key={node.label}
                    className={[
                      "rounded-2xl border p-3",
                      index === 0 || index === trustNodes.length - 1
                        ? "border-blue-200 bg-blue-50 text-blue-950 dark:border-slate-300 dark:bg-slate-950 dark:text-white"
                        : "border-border bg-card text-slate-700 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={[
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border",
                          index === 0 || index === trustNodes.length - 1
                            ? style.iconBg
                            : "border-border bg-card text-slate-600 dark:border-white/10 dark:bg-slate-800 dark:text-blue-200",
                        ].join(" ")}
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-xs font-black text-slate-950 dark:text-white">
                          {node.label}
                        </p>
                        <p
                          className={[
                            "mt-0.5 text-[9px] font-black uppercase tracking-[0.14em]",
                            index === 0 || index === trustNodes.length - 1
                              ? "text-blue-600/60 dark:text-white/45"
                              : "text-slate-400 dark:text-slate-400",
                          ].join(" ")}
                        >
                          Layer {index + 1}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-muted p-4 dark:border-white/10 dark:bg-slate-800">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-400">
                  System posture
                </p>
                <span className="text-xs font-black text-blue-700 dark:text-blue-200">
                  Governed
                </span>
              </div>

              <p className="mt-2 text-xs font-medium leading-5 text-slate-600 dark:text-slate-300">
                Identity, tenant boundary, permissions, synchronization,
                monitoring, and audit visibility operate as one control plane.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}