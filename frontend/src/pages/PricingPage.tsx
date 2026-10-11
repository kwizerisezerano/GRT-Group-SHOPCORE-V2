import { Link } from "react-router-dom";
import { ArrowRight, Gauge, MessagesSquare, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PublicShell } from "@/components/public/PublicShell";
import { PricingTable } from "@/components/public/PricingTable";

/**
 * The pricing page.
 *
 * Same shell and the same live catalogue as the landing page's pricing
 * section — one table component, one source of truth. It used to render a
 * separate hand-maintained pricing workspace with its own navigation, its own
 * colours and its own numbers, which drifted from what the API would actually
 * charge.
 */

const FAQS = [
  {
    question: "What happens when I reach a limit?",
    answer:
      "The system stops you at the number and tells you which limit you have hit — you will not be quietly billed for going over. Upgrading from the billing screen takes effect immediately.",
  },
  {
    question: "Can I change plan later?",
    answer:
      "Any time, in either direction. Paying early extends your current term rather than restarting it, so you never lose days you have already paid for.",
  },
  {
    question: "How do I pay?",
    answer:
      "MTN Mobile Money and Airtel Money settle in seconds — you approve a prompt on your phone. Card payments go through a secure gateway page. Bank transfer is confirmed by our team, usually the same working day.",
  },
  {
    question: "Is there a contract?",
    answer:
      "No. Monthly plans renew monthly and stop when you stop paying. Six-month and annual terms are discounted because they are paid up front.",
  },
  {
    question: "What if my internet goes down?",
    answer:
      "The till keeps working. Sales are written to the device and sync in order when the connection returns — this is not an add-on, it is how the point of sale is built.",
  },
];

export default function PricingPage() {
  return (
    <PublicShell>
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Pricing</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Priced by the size of your business
            </h1>
            <p className="mt-5 text-lg font-medium leading-8 text-muted-foreground">
              Every plan includes the till, stock control and sales. What changes is how many people,
              shops and products it covers — and those numbers are enforced, so the bill never
              surprises you.
            </p>
          </div>

          <div className="mt-14">
            <PricingTable />
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <div className="grid gap-4 lg:grid-cols-3">
            {[
              {
                icon: Gauge,
                title: "You always see what is left",
                body: "Every screen that creates a user, a branch or a product shows the count against your plan first.",
              },
              {
                icon: ShieldCheck,
                title: "Nothing hidden",
                body: "No setup fee, no per-transaction cut, no charge for going over — you are stopped at the limit instead.",
              },
              {
                icon: MessagesSquare,
                title: "Need something else?",
                body: "Bigger teams and unusual requirements are handled directly. Tell us what you need and we will price it.",
              },
            ].map((item) => (
              <article key={item.title} className="rounded-2xl border border-border bg-background p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm font-medium leading-7 text-muted-foreground">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
          <h2 className="text-center text-3xl font-bold tracking-tight text-foreground">
            Questions people actually ask
          </h2>

          <dl className="mt-10 space-y-3">
            {FAQS.map((faq) => (
              <div key={faq.question} className="rounded-2xl border border-border bg-card p-6">
                <dt className="text-sm font-semibold text-foreground">{faq.question}</dt>
                <dd className="mt-2.5 text-sm font-medium leading-7 text-muted-foreground">
                  {faq.answer}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-12 rounded-3xl border border-border bg-card p-8 text-center">
            <h3 className="text-xl font-bold text-foreground">Still deciding?</h3>
            <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-7 text-muted-foreground">
              Start on a plan with a free trial and see the whole thing with your own products in it.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button asChild className="h-12 rounded-xl px-6 font-semibold">
                <Link to="/signup">
                  Start your workspace
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                className="h-12 rounded-xl border-border px-6 font-semibold"
              >
                <Link to="/support-center">Talk to support</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
