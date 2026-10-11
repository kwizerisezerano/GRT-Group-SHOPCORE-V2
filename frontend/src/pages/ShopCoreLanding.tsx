import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Building2,
  Check,
  CreditCard,
  FileCheck2,
  Gauge,
  Languages,
  Layers3,
  LockKeyhole,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { PublicShell } from "@/components/public/PublicShell";
import { PricingTable } from "@/components/public/PricingTable";
import { Reveal } from "@/components/public/Reveal";
import { CountUp } from "@/components/public/CountUp";
import { DashboardPreview } from "@/components/public/DashboardPreview";
import { ProductTour } from "@/components/public/ProductTour";
import { AcceptedPayments } from "@/components/payments/PaymentBrandMark";

/**
 * The landing page.
 *
 * Built from the same tokens as the workspace behind it, so the product a
 * visitor sees here is recognisably the product they get.
 *
 * ## What this page has to do
 *
 * Show the software. An earlier pass stripped out a fake dashboard because it
 * was carrying shadows and a colour wash and read as decoration — but the
 * result was a page of well-set text that never showed a single screen, which
 * is a hard sell for a system a shop runs its takings through. The preview is
 * back, drawn from the app's own tokens rather than screenshotted, flat, and
 * labelled as an illustration (components/public/DashboardPreview).
 *
 * ## The order
 *
 * Claim, evidence, then price. The hero says what it is beside a picture of
 * it; the tour lets someone look at the screen they care about; the modules,
 * branch and security sections answer "does it do my thing"; how-it-works
 * answers "how long will this take me"; then pricing, then the questions that
 * otherwise arrive by email, then one ask.
 *
 * Pricing is read live from the plan catalogue (components/public/
 * PricingTable), so the ceilings advertised here are the ones the server
 * enforces after signup.
 */

const MODULES = [
  {
    icon: ShoppingCart,
    name: "Point of sale",
    description: "A till that keeps selling when the internet does not, and syncs when it returns.",
  },
  {
    icon: Boxes,
    name: "Inventory",
    description: "Stock by branch and warehouse, counts, adjustments and transfers between sites.",
  },
  {
    icon: Truck,
    name: "Purchasing",
    description: "Purchase orders, goods received, supplier balances and landed cost.",
  },
  {
    icon: Users,
    name: "Customers",
    description: "Accounts, credit limits, loyalty points and the history behind every balance.",
  },
  {
    icon: Receipt,
    name: "Expenses",
    description: "What the shop spends, against what it earns, categorised for the accountant.",
  },
  {
    icon: BarChart3,
    name: "Reports",
    description: "Margin by product, sales by hour, dead stock and the numbers behind each.",
  },
  {
    icon: Building2,
    name: "Multi-branch",
    description: "One workspace, many shops — each with its own stock, staff and takings.",
  },
  {
    icon: FileCheck2,
    name: "EBM & RRA",
    description: "Invoices in the format the revenue authority expects, filed as you sell.",
  },
];

const PROOF = [
  { value: 8, label: "core modules", detail: "Till to books, one workspace" },
  { value: 4, label: "languages", detail: "English, Kinyarwanda, French, Swahili" },
  { value: 4, label: "languages supported", detail: "English, French, Kinyarwanda, Swahili" },
  { value: 3, label: "ways to pay", detail: "MTN, Airtel and card" },
];

const STEPS = [
  {
    title: "Create the workspace",
    body: "Your name, your shop, and a code to your email. Nothing is installed and nobody has to visit you.",
    detail: "About two minutes",
  },
  {
    title: "Pick a plan and pay",
    body: "Choose the size that fits, then pay with MTN, Airtel or a card. Most plans start with a free trial, so you can look first.",
    detail: "Settles in seconds",
  },
  {
    title: "Load stock and start selling",
    body: "Import a product list or add as you go, add your staff with the right permissions, and open the till.",
    detail: "Same morning",
  },
];

const PAYMENT_RAILS = [
  { icon: Smartphone, name: "MTN Mobile Money", detail: "Approve on your phone with a PIN" },
  { icon: Smartphone, name: "Airtel Money", detail: "Same flow, same seconds" },
  { icon: CreditCard, name: "Visa & Mastercard", detail: "On a secure gateway page" },
];

const FAQS = [
  {
    q: "Is my data mine, and can I get it out?",
    a: "Yes to both. Personal details are encrypted before they are stored and every workspace is scoped separately at the query layer, not by convention. You can export your catalogue, customers and sales at any time, and nothing is sold or shared with anyone else.",
  },
  {
    q: "What does a plan actually limit?",
    a: "Capacity — how many team members, branches, warehouses, products, customers, suppliers and monthly transactions the workspace covers. The numbers on the pricing table are the ones the server enforces, and every screen that creates something shows what is left before you run out.",
  },
  {
    q: "What happens if I go over a limit?",
    a: "The workspace tells you before you get there, and blocks the action at the ceiling rather than billing you for it quietly. Moving up a plan takes effect immediately, and paying early extends your term instead of restarting it, so you never lose days you have already bought.",
  },
  {
    q: "How do I pay, and can I stop?",
    a: "MTN Mobile Money, Airtel Money, or Visa and Mastercard through a secure gateway page. Bank transfer is confirmed by a person the same working day. There is no contract — if you stop paying, the workspace closes at the end of the period you paid for and your data is still there when you come back.",
  },
  {
    q: "Does it handle EBM and the RRA?",
    a: "Yes. Invoices are produced in the format the revenue authority expects and filed as you sell, rather than rebuilt from a spreadsheet at month end.",
  },
  {
    q: "Can I run more than one shop?",
    a: "Yes, on the plans that include more than one branch. Each shop keeps its own stock, staff and takings, and the reports consolidate across them — or split by branch when you need to compare.",
  },
];

export default function ShopCoreLanding() {
  return (
    <PublicShell>
      <Hero />
      <ProofBar />
      <Tour />
      <Modules />
      <HowItWorks />
      <BranchesAndCompliance />
      <PlanControl />
      <Pricing />
      <Faq />
      <FinalCta />
    </PublicShell>
  );
}

function Hero() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-14">
          <div>
            <span className="inline-flex animate-rise items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              Built for Rwandan retail
            </span>

            <h1
              className="mt-6 animate-rise text-4xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-5xl"
              style={{ animationDelay: "80ms" }}
            >
              Run the whole shop <span className="text-primary">from one screen.</span>
            </h1>

            <p
              className="mt-6 animate-rise text-lg leading-relaxed text-muted-foreground"
              style={{ animationDelay: "160ms" }}
            >
              The till, the stock room and the books in one workspace. It keeps selling when the
              connection drops, files what the RRA expects, and tells you which products actually
              make money.
            </p>

            <div
              className="mt-9 flex animate-rise flex-wrap items-center gap-2.5"
              style={{ animationDelay: "240ms" }}
            >
              <Button
                asChild
                size="lg"
                className="group h-12 rounded-xl px-6 text-[15px] font-semibold shadow-sm transition-shadow hover:shadow-md"
              >
                <Link to="/signup">
                  Start your workspace
                  <ArrowRight className="ml-1.5 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-xl border-border px-6 text-[15px] font-semibold"
              >
                <Link to="/pricing">See pricing</Link>
              </Button>
            </div>

            <ul
              className="mt-8 flex animate-rise flex-wrap gap-x-6 gap-y-2"
              style={{ animationDelay: "320ms" }}
            >
              {["Free trial on most plans", "Pay by MoMo or card", "Cancel any time"].map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-1.5 text-[13px] text-muted-foreground"
                >
                  <Check
                    className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
                    strokeWidth={3}
                  />
                  {item}
                </li>
              ))}
            </ul>

            <div
              className="mt-10 flex animate-rise flex-wrap items-center gap-3 border-t border-border pt-8"
              style={{ animationDelay: "400ms" }}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Accepted here
              </span>
              <AcceptedPayments />
            </div>
          </div>

          <div className="animate-rise" style={{ animationDelay: "300ms" }}>
            <DashboardPreview screen="dashboard" />

            <p className="mt-3 text-center text-[11px] font-medium text-muted-foreground">
              A preview of the workspace. Figures shown are an illustration.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProofBar() {
  return (
    <section className="border-b border-border bg-card">
      {/*
        The hairline dividers are a `gap-px` over a border-coloured surface.
        That surface has to be the grid itself and nothing wider — with the
        section padding on the same element, the padding painted border grey
        too and read as two empty columns bracketing the row.
      */}
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
          {PROOF.map((item, index) => (
            <Reveal key={item.label} delay={index * 70} className="bg-card p-6 lg:p-8">
              <p className="font-data text-3xl font-semibold text-foreground">
                <CountUp value={item.value} />
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-primary">
                {item.label}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.detail}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Tour() {
  return (
    <section id="tour" className="scroll-mt-24 border-b border-border">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <SectionHeading
          eyebrow="See it working"
          title="Every screen your day runs through"
          description="The same workspace, from the morning check to the evening report. Pick the one you would use most."
        />

        <div className="mt-12">
          <ProductTour />
        </div>
      </div>
    </section>
  );
}

function Modules() {
  return (
    <section id="modules" className="scroll-mt-24 border-b border-border bg-card">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <SectionHeading
          eyebrow="What is inside"
          title="Eight modules, one workspace"
          description="Nothing to integrate and nothing to reconcile at month end — a sale in the till is already a stock movement, a customer balance and a line in the report."
        />

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((module, index) => (
            <Reveal
              key={module.name}
              as="article"
              delay={(index % 4) * 60}
              className="group rounded-2xl border border-border bg-background p-5 transition-colors hover:border-primary/40"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <module.icon className="h-5 w-5" />
              </span>

              <h3 className="mt-4 text-sm font-semibold text-foreground">{module.name}</h3>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">{module.description}</p>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-6 flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-border bg-background px-6 py-5 text-center">
          <Languages className="h-4 w-4 shrink-0 text-primary" />
          <p className="text-[13px] font-medium text-muted-foreground">
            The whole workspace speaks{" "}
            <span className="font-semibold text-foreground">
              English, Kinyarwanda, French and Swahili
            </span>{" "}
            — each person picks their own, on the same shop.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/**
 * The three steps between reading this page and taking money.
 *
 * The objection this answers is time, not features: a shop owner assumes a
 * system like this means a week of setup and somebody's consultant. Saying how
 * long each step takes is the whole point of the section, so the timing sits
 * in its own column rather than buried in the sentence.
 */
function HowItWorks() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <SectionHeading
          eyebrow="Getting started"
          title="Selling by the end of the morning"
          description="No installation, no server to buy, no waiting for an engineer to come to the shop."
        />

        <ol className="mt-12 grid gap-4 lg:grid-cols-3">
          {STEPS.map((step, index) => (
            <Reveal
              key={step.title}
              as="li"
              delay={index * 90}
              className="relative rounded-2xl border border-border bg-card p-6"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary font-data text-sm font-semibold text-primary-foreground">
                  {index + 1}
                </span>
                <span className="rounded-md border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {step.detail}
                </span>
              </div>

              <h3 className="mt-5 text-base font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{step.body}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

function BranchesAndCompliance() {
  return (
    <section className="border-b border-border bg-card">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <FeaturePanel
            icon={Building2}
            eyebrow="More than one shop"
            title="Every branch on one workspace"
            description="Stock, prices and staff belong to the workspace, not to a till. Open a second branch and it inherits the catalogue you already keep, while sales, transfers and counts stay attributable to the place they happened."
            points={[
              "One catalogue, priced per branch where you need it",
              "Transfers between branches, with both sides recorded",
              "Staff permissions follow the person, not the device",
            ]}
          />

          <FeaturePanel
            icon={LockKeyhole}
            eyebrow="Your data"
            title="Encrypted, and separated by workspace"
            description="Every email, phone number and address is encrypted before it is stored, with a keyed index so it stays searchable without being readable. Each workspace's data is scoped at the query layer, not by convention."
            points={[
              "AES-256-GCM on personal data at rest",
              "Per-workspace scoping on every query",
              "Every role and permission change is logged",
            ]}
          />
        </div>
      </div>
    </section>
  );
}

/**
 * The section that explains what a subscription actually buys.
 *
 * Worth its own block because it is the part customers get wrong: plans here
 * are capacity, not just feature flags, and the numbers are enforced. Saying
 * so before the pricing table means the ceilings on those cards read as a
 * specification rather than fine print.
 */
function PlanControl() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <SectionHeading
          eyebrow="How plans work"
          title="You pay for capacity, and we hold you to it honestly"
          description="Every plan sets how many people, shops, warehouses and products it covers. Your workspace shows what is left before you run out, and nothing is quietly billed on top."
        />

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          <InfoCard
            icon={Gauge}
            title="You always see what is left"
            body="Every screen that creates something shows the count first — “2 of 5 team members used”. Nobody fills in a form only to be told the plan is full."
          />
          <InfoCard
            icon={Layers3}
            title="Change plan whenever"
            body="Move up when you open a second shop, and back down when the season ends. Paying early extends the term rather than restarting it, so you never lose days you have bought."
          />
          <InfoCard
            icon={Wallet}
            title="Pay the way you already pay"
            body="Mobile money settles in seconds. Card goes through a secure gateway page. Bank transfer is confirmed by a person the same working day."
          />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {PAYMENT_RAILS.map((rail, index) => (
            <Reveal
              key={rail.name}
              delay={index * 70}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <rail.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-foreground">{rail.name}</p>
                <p className="mt-0.5 truncate text-[11px] font-semibold text-muted-foreground">
                  {rail.detail}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-24 border-b border-border bg-card">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <SectionHeading
          eyebrow="Pricing"
          title="Pick the size of your business"
          description="Every plan includes the till, stock and sales. What changes is how many people and shops it covers."
        />

        <div className="mt-12">
          <PricingTable />
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="scroll-mt-24 border-b border-border">
      <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
        <SectionHeading
          eyebrow="Questions"
          title="The things people ask before they sign up"
          description="If yours is not here, support answers on the same working day."
        />

        <Reveal className="mt-12">
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((item, index) => (
              <AccordionItem key={item.q} value={`faq-${index}`} className="border-border">
                <AccordionTrigger className="text-left text-[15px] font-semibold text-foreground hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-7 text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="rounded-2xl border border-border bg-card px-8 py-14 text-center sm:px-12">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            Open your workspace today
          </h2>

          <p className="mx-auto mt-3.5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Set it up in a few minutes, pay with mobile money, and start selling. No installation, no
            contract, no waiting for someone to visit your shop.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
            <Button asChild size="lg" className="h-11 rounded-xl px-6 text-[15px] font-semibold">
              <Link to="/signup">
                Get started
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <AcceptedPayments className="mt-8 justify-center" />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- pieces --- */

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
      {/*
        `text-balance` evens the line lengths instead of filling each line and
        dropping whatever is left onto the last one — which is how "before they
        sign up" ended with "up" alone on a line of its own. `text-pretty` on
        the paragraph does the narrower job of preventing a single-word last
        line, since balancing a four-line paragraph is not worth the layout
        cost.
      */}
      <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-pretty text-base leading-7 text-muted-foreground">{description}</p>
    </Reveal>
  );
}

function FeaturePanel({
  icon: Icon,
  eyebrow,
  title,
  description,
  points,
}: {
  icon: typeof Building2;
  eyebrow: string;
  title: string;
  description: string;
  points: string[];
}) {
  return (
    <Reveal as="article" className="rounded-3xl border border-border bg-background p-8">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
      </span>

      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
        {eyebrow}
      </p>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="mt-4 text-sm font-medium leading-7 text-muted-foreground">{description}</p>

      <ul className="mt-6 space-y-2.5 border-t border-border pt-6">
        {points.map((point) => (
          <li key={point} className="flex items-start gap-2.5 text-sm">
            <Check
              className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
              strokeWidth={3}
            />
            <span className="font-semibold text-foreground">{point}</span>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}

function InfoCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Gauge;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-6">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm font-medium leading-7 text-muted-foreground">{body}</p>
    </article>
  );
}
