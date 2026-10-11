/**
 * Sample values for previewing a contract template.
 *
 * ## Why the console previews with real-looking data
 *
 * A template is written with `{{placeholders}}`, and an author staring at
 * `{{amount}}` cannot see the thing a customer will read. Worse, they cannot
 * see whether it reads well — whether the sentence still scans once the token
 * becomes "RWF 45,000", whether a clause that mentions the term twice now says
 * it awkwardly, whether a placeholder was misspelled and will print literally.
 *
 * So the editor fills the body with a plausible Rwandan retailer and shows the
 * finished document. The values are obviously specimen values and are labelled
 * as such on screen, so nobody mistakes the preview for a real agreement.
 *
 * The substitution rules are the same ones the server uses
 * (`contracts.render.ts`): a straight token-for-token replacement, and anything
 * left over is a placeholder nothing can fill.
 */

export type SampleProvider = {
  legalName: string;
  tin: string | null;
  registrationNo: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  governingLaw: string;
  signerName: string | null;
  signerTitle: string | null;
};

/** The specimen customer. A real-shaped Rwandan retailer, plainly fictional. */
export const SAMPLE_CUSTOMER = {
  companyName: "Kigali Fresh Market Ltd",
  tin: "102938475",
  ownerName: "Aline Mukamana",
  ownerEmail: "aline@kigalifresh.rw",
  phone: "+250 788 123 456",
  address: "KN 4 Ave, Nyarugenge, Kigali",
} as const;

export const SAMPLE_DEAL = {
  planName: "Growth",
  billingCycle: "every six months",
  cycleLabel: "Every 6 months",
  amount: 180_000,
  currency: "RWF",
  termMonths: 6,
} as const;

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
  "nineteen",
];

const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/**
 * The amount spelled out, matching the server's wording.
 *
 * Duplicated rather than imported because the server's copy lives in the API
 * package. It is worth the duplication: a preview that renders
 * `{{amount_in_words}}` as an empty string would tell an author the token is
 * broken when it is not.
 */
export function amountInWords(value: number): string {
  const amount = Math.max(0, Math.round(value));
  if (amount === 0) return ONES[0];

  const chunk = (n: number): string => {
    if (n < 20) return ONES[n];
    if (n < 100) {
      const rest = n % 10;
      return TENS[Math.floor(n / 10)] + (rest ? `-${ONES[rest]}` : "");
    }
    const rest = n % 100;
    return `${ONES[Math.floor(n / 100)]} hundred${rest ? ` and ${chunk(rest)}` : ""}`;
  };

  const scales: [number, string][] = [
    [1_000_000_000, "billion"],
    [1_000_000, "million"],
    [1_000, "thousand"],
  ];

  let remaining = amount;
  const parts: string[] = [];

  for (const [size, name] of scales) {
    if (remaining >= size) {
      parts.push(`${chunk(Math.floor(remaining / size))} ${name}`);
      remaining %= size;
    }
  }

  if (remaining > 0) parts.push(chunk(remaining));
  return parts.join(" ");
}

/** Every token the preview knows how to fill, and what it fills it with. */
export function sampleValues(provider: SampleProvider): Record<string, string> {
  const today = new Date();
  const periodEnd = new Date(today);
  periodEnd.setMonth(periodEnd.getMonth() + SAMPLE_DEAL.termMonths);

  /* The same underscored blank the server writes for a detail nobody gave. */
  const blank = "__________";

  return {
    "{{company_name}}": SAMPLE_CUSTOMER.companyName,
    "{{tin_number}}": SAMPLE_CUSTOMER.tin,
    "{{owner_name}}": SAMPLE_CUSTOMER.ownerName,
    "{{owner_email}}": SAMPLE_CUSTOMER.ownerEmail,
    "{{business_phone}}": SAMPLE_CUSTOMER.phone,
    "{{business_address}}": SAMPLE_CUSTOMER.address,

    "{{provider_name}}": provider.legalName,
    "{{provider_tin}}": provider.tin || blank,
    "{{provider_registration}}": provider.registrationNo || blank,
    "{{provider_address}}": provider.address || blank,
    "{{provider_email}}": provider.email || blank,
    "{{provider_phone}}": provider.phone || blank,
    "{{provider_signer_name}}": provider.signerName || blank,
    "{{provider_signer_title}}": provider.signerTitle || blank,

    "{{plan_name}}": SAMPLE_DEAL.planName,
    "{{billing_cycle}}": SAMPLE_DEAL.billingCycle,
    "{{amount}}": `${SAMPLE_DEAL.currency} ${SAMPLE_DEAL.amount.toLocaleString("en-US")}`,
    "{{amount_in_words}}": `${amountInWords(SAMPLE_DEAL.amount)} ${SAMPLE_DEAL.currency}`,
    "{{currency}}": SAMPLE_DEAL.currency,
    "{{term_months}}": String(SAMPLE_DEAL.termMonths),
    "{{period_start}}": formatDate(today),
    "{{period_end}}": formatDate(periodEnd),

    "{{today}}": formatDate(today),
    "{{governing_law}}": provider.governingLaw,
  };
}

/** Fills a template body with the specimen values, token for token. */
export function fillSample(body: string, provider: SampleProvider): string {
  return Object.entries(sampleValues(provider)).reduce(
    (text, [token, value]) => text.split(token).join(value),
    body,
  );
}

/**
 * A complete agreement, ready to edit.
 *
 * Offered because "New template" opening onto an empty box asks an operator to
 * draft a subscription contract from memory, and what actually happens is that
 * they write four clauses about payment and none about data, liability,
 * notices, or how either side gets out — the clauses nobody misses until the
 * day they are needed. Starting from a complete document makes editing the
 * default and omission a decision.
 */
export const FULL_CONTRACT_STARTER = `SHOPCORE SOFTWARE SUBSCRIPTION AGREEMENT

This agreement is made on {{today}} between {{provider_name}}, TIN
{{provider_tin}}, of {{provider_address}} ("the Provider"), and {{company_name}},
TIN {{tin_number}}, of {{business_address}} ("the Customer"). Each is a "Party"
and together they are "the Parties".

1. DEFINITIONS
   "The Platform" means the ShopCore retail operating system and the modules
   included in the Customer's plan. "Customer Data" means everything the
   Customer or its staff enter into or generate on the Platform, including
   products, sales, customers, suppliers and financial records. "Term" means the
   period the Customer has paid for.

2. SUBSCRIPTION AND TERM
   The Customer subscribes to the {{plan_name}} plan, billed {{billing_cycle}},
   for a term of {{term_months}} month(s) running from {{period_start}} to
   {{period_end}}. The Term renews for a further period of the same length each
   time a renewal is paid.

3. FEES AND PAYMENT
   The fee for the Term is {{amount}} ({{amount_in_words}}), payable in advance.
   Fees are exclusive of any tax the law requires to be added. The Platform is
   made available once payment is confirmed by the payment provider.

4. RENEWAL, LATE PAYMENT AND SUSPENSION
   A renewal falls due on the last day of the Term. If a renewal is unpaid, the
   Provider may suspend access after giving the Customer at least seven (7)
   days' written notice. Suspension does not delete Customer Data, and access is
   restored on payment.

5. PRICE CHANGES
   The Provider may change the price of a plan for future terms only, and will
   give the Customer at least thirty (30) days' written notice before a renewal
   at the new price. The Customer may decline by not renewing.

6. THE ACCOUNT AND ITS USERS
   The account is registered to {{owner_name}} ({{owner_email}}), reachable on
   {{business_phone}}. The Customer decides who is given access, is responsible
   for what those users do, and will tell the Provider without delay if it
   believes an account has been compromised.

7. ACCEPTABLE USE
   The Customer will not resell or sublicense the Platform, attempt to
   circumvent its access controls, or use it to store unlawful content. The
   Provider may suspend an account that is being used to attack or degrade the
   service for others, and will say why.

8. OWNERSHIP OF CUSTOMER DATA
   Customer Data belongs to the Customer. The Provider claims no ownership of
   it, does not sell it, and does not share it with anyone except where the
   Customer asks, or where the law requires and the Customer is told unless the
   Provider is forbidden to say.

9. USE OF DATA BY THE PROVIDER
   The Provider processes Customer Data only to operate, secure and support the
   Platform. Aggregated statistics that identify no business and no person may
   be used to improve the service.

10. EXPORT AND RETURN
    The Customer may export its data at any time during the Term, in a
    machine-readable format, without asking. After this agreement ends the
    export remains available for thirty (30) days, after which the Provider may
    delete it.

11. SECURITY
    The Provider encrypts personal data at rest, protects data in transit, and
    keeps access to production systems restricted to named staff. The Provider
    will notify the Customer without undue delay of any breach affecting the
    Customer's data.

12. AVAILABILITY
    The Provider aims for 99% monthly availability of the online service,
    excluding scheduled maintenance announced in advance. The Platform continues
    to operate offline at the point of sale and synchronises when a connection
    returns, so a network outage does not stop the Customer trading.

13. SUPPORT
    The Provider gives support by email and telephone during business hours in
    {{governing_law}}, and will acknowledge a report that the Platform is
    unusable within one business day.

14. CHANGES TO THE PLATFORM
    The Provider may add to or improve the Platform at any time. It will give
    the Customer at least thirty (30) days' notice before removing a feature the
    Customer is actively using.

15. WARRANTIES AND LIABILITY
    The Provider warrants that it will supply the Platform with reasonable skill
    and care. Neither Party excludes liability for fraud, for death or personal
    injury caused by negligence, or for anything else the law does not permit to
    be excluded. Otherwise, each Party's total liability under this agreement is
    limited to the fees paid by the Customer in the twelve (12) months before the
    claim, and neither Party is liable for indirect or consequential loss.

16. CONFIDENTIALITY
    Each Party will keep the other's non-public information confidential and use
    it only for this agreement. This obligation continues for two (2) years
    after the agreement ends.

17. ENDING THE AGREEMENT
    Either Party may end this agreement at the close of a paid Term by giving
    written notice before that Term ends. Either Party may end it immediately if
    the other commits a material breach and does not remedy it within thirty
    (30) days of written notice. Fees already paid for the current Term are not
    refunded, except where the Provider is the Party in breach.

18. NOTICES
    Notices to the Provider go to {{provider_email}} and, if urgent, by
    telephone to {{provider_phone}}. Notices to the Customer go to
    {{owner_email}}. A notice sent by email is treated as received on the next
    business day.

19. FORCE MAJEURE
    Neither Party is liable for a failure caused by something outside its
    reasonable control, including a national network or power failure, provided
    it tells the other Party and works to resume performance.

20. ASSIGNMENT
    Neither Party may assign this agreement without the other's written consent,
    except that the Provider may assign it to a successor of its business on
    notice to the Customer.

21. ENTIRE AGREEMENT
    This document is the whole agreement between the Parties about the Platform
    and replaces anything said or written before it. Any change must be in
    writing and agreed by both Parties.

22. GOVERNING LAW AND DISPUTES
    This agreement is governed by the laws of {{governing_law}}. The Parties
    will attempt in good faith to settle any dispute between themselves before
    referring it to the competent courts of {{governing_law}}.
`;

/** A short agreement, for an operator who wants to write their own. */
export const SHORT_CONTRACT_STARTER = `SERVICE AGREEMENT

This agreement is made on {{today}} between {{provider_name}} ("the Provider")
and {{company_name}}, TIN {{tin_number}}, of {{business_address}} ("the
Customer").

1. SUBSCRIPTION
   The Customer subscribes to the {{plan_name}} plan, billed {{billing_cycle}},
   for {{amount}} ({{amount_in_words}}) covering {{period_start}} to
   {{period_end}}.

2. ACCOUNT
   The account is registered to {{owner_name}} ({{owner_email}}), reachable on
   {{business_phone}}.

3. TERM AND RENEWAL
   Service runs for the period above and continues on payment of each renewal.

4. DATA
   The Customer's data belongs to the Customer and is exportable at any time.

5. GOVERNING LAW
   This agreement is governed by the laws of {{governing_law}}.
`;
