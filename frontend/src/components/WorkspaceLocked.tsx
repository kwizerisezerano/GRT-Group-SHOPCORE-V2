import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarClock,
  CreditCard,
  Landmark,
  Lock,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

import { AcceptedPayments } from "@/components/payments/PaymentBrandMark";
import { Button } from "@/components/ui/button";
import { useAuth, type WorkspaceAccessStatus } from "@/contexts/AuthContext";
import { subscriptionApi } from "@/lib/subscriptionApi";
import { PeriodMeter } from "@/components/SubscriptionUsage";

/**
 * What somebody sees when they sign in and the workspace is not open.
 *
 * ## Why this is not a redirect
 *
 * It used to be: any blocked workspace was bounced to /activation, a
 * full-screen page with no navigation. That is a dead end — the person could
 * not reach billing, could not reach support, could not see their own
 * settings, and had no idea which of those was supposed to fix it.
 *
 * Now the app shell stays: the header, the menu and the footer render as
 * normal, the menu is trimmed to what actually works while the workspace is
 * shut, and this panel fills the page area explaining why and what to do. The
 * one thing they need — the subscription screen — is a click away in the menu
 * and the button below.
 *
 * The four states read very differently to the person in them, so each gets
 * its own wording rather than a generic "access denied".
 */

const money = (value: unknown, currency = "RWF") =>
  value === null || value === undefined
    ? null
    : `${currency} ${Math.round(Number(value)).toLocaleString()}`;

const longDate = (value: unknown) =>
  typeof value === "string"
    ? new Date(value).toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

type Copy = {
  icon: typeof Lock;
  tone: string;
  eyebrow: string;
  title: string;
  body: string;
  action: string;
};

const COPY: Record<string, Copy> = {
  pending_payment: {
    icon: CreditCard,
    tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    eyebrow: "Waiting on payment",
    title: "Your workspace is ready — it just needs paying for",
    body: "Nothing has been charged yet. Once the payment goes through, everything here opens immediately and your data is exactly as you left it.",
    action: "Pay now",
  },
  expired: {
    icon: CalendarClock,
    tone: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    eyebrow: "Subscription ended",
    title: "Your subscription has run out",
    body: "Your products, sales and customers are all still here and nothing has been deleted. Renew and you are back in, on the same workspace.",
    action: "Renew subscription",
  },
  trial_expired: {
    icon: CalendarClock,
    tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    eyebrow: "Trial finished",
    title: "Your free trial has ended",
    body: "Everything you set up during the trial is still here. Choose a plan to carry on where you stopped.",
    action: "Choose a plan",
  },
  blocked: {
    icon: ShieldAlert,
    tone: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    eyebrow: "Workspace suspended",
    title: "This workspace has been suspended",
    body: "An administrator has put this workspace on hold. Our support team can tell you why and what is needed to lift it.",
    action: "Contact support",
  },
};

export function WorkspaceLocked({ status }: { status: WorkspaceAccessStatus }) {
  const { tenantName, tenantId } = useAuth();
  const location = useLocation();

  const copy = COPY[status] ?? COPY.pending_payment;
  const Icon = copy.icon;
  const suspended = status === "blocked";

  /*
   * What they owe, so the panel can name the amount rather than send them to
   * another screen to find out. Best-effort: the panel is useful without it.
   */
  const summary = useQuery({
    queryKey: ["subscription", "current", tenantId],
    queryFn: () => subscriptionApi.current(),
    enabled: Boolean(tenantId) && !suspended,
    retry: false,
  });

  const subscription = summary.data?.subscription ?? null;
  const plan = summary.data?.plan ?? null;

  const amount = money(subscription?.amount, String(subscription?.currency ?? "RWF"));
  const endedOn = longDate(subscription?.current_period_end);

  return (
    <div className="mx-auto max-w-2xl py-8">
      <div className="rounded-2xl border border-border bg-card p-8 sm:p-10">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${copy.tone}`}>
          <Icon className="h-6 w-6" />
        </div>

        <p className="mt-6 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {copy.eyebrow}
        </p>

        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">{copy.title}</h1>

        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{copy.body}</p>

        {(plan || amount || endedOn) && (
          <dl className="mt-6 grid gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:grid-cols-3">
            {plan && (
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Plan
                </dt>
                <dd className="mt-1 truncate text-sm font-semibold text-foreground">{plan.name}</dd>
              </div>
            )}

            {amount && (
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Amount
                </dt>
                <dd className="mt-1 text-sm font-semibold text-foreground">{amount}</dd>
              </div>
            )}

            {endedOn && (
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {status === "expired" ? "Ended" : "Renews"}
                </dt>
                <dd className="mt-1 text-sm font-semibold text-foreground">{endedOn}</dd>
              </div>
            )}
          </dl>
        )}

        {summary.data?.period ? (
          <PeriodMeter
            period={summary.data.period}
            planName={plan?.name ?? null}
            className="mt-6"
          />
        ) : null}

        <div className="mt-7 flex flex-wrap items-center gap-2.5">
          <Button asChild className="h-11 rounded-xl px-5 font-semibold">
            <Link to={suspended ? "/support" : "/billing"}>
              {copy.action}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>

          <Button
            variant="outline"
            className="h-11 rounded-xl px-4 font-semibold"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            I have paid — check again
          </Button>
        </div>

        {!suspended && (
          <div className="mt-8 border-t border-border pt-6">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Ways to pay
            </p>
            <AcceptedPayments className="mt-3" />
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Landmark className="h-3 w-3" />
              Bank transfer is confirmed by our team, usually the same working day.
            </p>
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-[13px] text-muted-foreground">
        Signed in to <span className="font-medium text-foreground">{tenantName ?? "your workspace"}</span>
        {location.pathname !== "/dashboard" && " · this page needs an open subscription"}
      </p>
    </div>
  );
}
