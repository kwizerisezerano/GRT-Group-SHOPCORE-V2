import {
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Headphones,
  PauseCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  Tenant360PendingAction,
  Tenant360TabKey,
} from "./Tenant360Types";

type SupportAccessLevel = "readonly" | "support" | "full";

const accessLevels: {
  value: SupportAccessLevel;
  label: string;
  description: string;
}[] = [
  {
    value: "readonly",
    label: "Read-only",
    description: "Review workspace data without operational changes.",
  },
  {
    value: "support",
    label: "Support",
    description: "Troubleshoot workspace issues with controlled access.",
  },
  {
    value: "full",
    label: "Full",
    description: "Use only for approved technical intervention.",
  },
];

const durations = [15, 30, 60, 120];

export function QuickActions({
  busy,
  refetch,
  supportReason,
  setSupportReason,
  supportAccessLevel,
  setSupportAccessLevel,
  supportDurationMinutes,
  setSupportDurationMinutes,
  setConfirmationText,
  setPendingAction,
  setActiveTab,
}: {
  busy: boolean;
  refetch: () => void;
  supportReason: string;
  setSupportReason: (value: string) => void;
  supportAccessLevel: SupportAccessLevel;
  setSupportAccessLevel: (value: SupportAccessLevel) => void;
  supportDurationMinutes: number;
  setSupportDurationMinutes: (value: number) => void;
  setConfirmationText: (value: string) => void;
  setPendingAction: (value: Tenant360PendingAction) => void;
  setActiveTab: (value: Tenant360TabKey) => void;
}) {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
          Quick Actions
        </p>

        <h3 className="mt-1 text-lg font-black text-slate-950">
          Workspace Control
        </h3>
      </div>

      <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-orange-700">
          Support Access Reason
        </p>

        <Input
          value={supportReason}
          onChange={(event) => setSupportReason(event.target.value)}
          className="mt-3 h-11 rounded-xl border-orange-200 bg-white font-bold"
          placeholder="Reason for support access..."
        />

        <div className="mt-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-orange-700">
            Access Level
          </p>

          <div className="mt-3 grid gap-2">
            {accessLevels.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setSupportAccessLevel(item.value)}
                className={[
                  "rounded-xl border p-3 text-left transition",
                  supportAccessLevel === item.value
                    ? "border-orange-300 bg-white shadow-sm"
                    : "border-orange-100 bg-orange-100/50 hover:bg-white",
                ].join(" ")}
              >
                <p className="text-xs font-black uppercase tracking-[0.12em] text-orange-800">
                  {item.label}
                </p>
                <p className="mt-1 text-xs font-semibold leading-5 text-orange-700">
                  {item.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-orange-700">
            Session Duration
          </p>

          <div className="mt-3 grid grid-cols-4 gap-2">
            {durations.map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => setSupportDurationMinutes(minutes)}
                className={[
                  "rounded-xl border px-2 py-2 text-xs font-black transition",
                  supportDurationMinutes === minutes
                    ? "border-orange-300 bg-white text-orange-800 shadow-sm"
                    : "border-orange-100 bg-orange-100/50 text-orange-700 hover:bg-white",
                ].join(" ")}
              >
                {minutes}m
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <Button
          className="rounded-xl bg-blue-700 font-black hover:bg-blue-800"
          disabled={busy}
          onClick={() => {
            setConfirmationText("");
            setPendingAction({
              type: "activate",
              title: "Activate workspace?",
              description:
                "This will mark the workspace as paid and active. The customer may immediately access the workspace.",
              confirmText: "ACTIVATE",
            });
          }}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Activate Workspace
        </Button>

        <Button
          className="rounded-xl bg-emerald-600 font-black hover:bg-emerald-700"
          disabled={busy}
          onClick={() => {
            setConfirmationText("");
            setPendingAction({
              type: "approve",
              title: "Approve 14-day trial?",
              description:
                "This will approve trial access and activate the workspace for the customer.",
              days: 14,
            });
          }}
        >
          <CalendarClock className="mr-2 h-4 w-4" />
          Approve Trial
        </Button>

        <Button
          variant="outline"
          className="rounded-xl border-blue-200 bg-blue-50 font-black text-blue-700 hover:bg-blue-100"
          disabled={busy}
          onClick={() => {
            setConfirmationText("");
            setPendingAction({
              type: "extend",
              title: "Extend trial by 14 days?",
              description:
                "This will extend the current trial period and keep the workspace active under trial status.",
              days: 14,
            });
          }}
        >
          <CalendarClock className="mr-2 h-4 w-4" />
          Extend Trial
        </Button>

        <Button
          variant="outline"
          className="rounded-xl border-orange-200 bg-orange-50 font-black text-orange-700 hover:bg-orange-100"
          disabled={busy}
          onClick={() => {
            setConfirmationText("");
            setPendingAction({
              type: "support_access",
              title: "Start support access?",
              description:
                "This creates a tracked platform support access session for this workspace. Use only for customer support or troubleshooting.",
              confirmText: "SUPPORT",
            });
          }}
        >
          <Headphones className="mr-2 h-4 w-4" />
          Support Access
        </Button>

        <Button
          variant="outline"
          className="rounded-xl border-rose-200 bg-rose-50 font-black text-rose-700 hover:bg-rose-100"
          disabled={busy}
          onClick={() => {
            setConfirmationText("");
            setPendingAction({
              type: "suspend",
              title: "Suspend workspace?",
              description:
                "This will suspend the workspace and may block the customer from accessing tenant operations.",
              confirmText: "SUSPEND",
            });
          }}
        >
          <PauseCircle className="mr-2 h-4 w-4" />
          Suspend Workspace
        </Button>

        <Button
          variant="outline"
          className="rounded-xl border-slate-200 font-black"
          onClick={refetch}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh Data
        </Button>

        <Button
          variant="outline"
          className="rounded-xl border-slate-200 font-black"
          onClick={() => setActiveTab("billing")}
        >
          <CreditCard className="mr-2 h-4 w-4" />
          View Billing
        </Button>
      </div>
    </section>
  );
}