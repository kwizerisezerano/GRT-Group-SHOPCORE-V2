import { prisma } from "../../db/prisma";
import { amountInWords } from "../../lib/amountWords";
import { addMonths, monthsForCycle } from "../../lib/billingPeriod";
import { HttpError } from "../../lib/httpError";

/**
 * Filling a contract template for one customer.
 *
 * ## Why the server renders it, both times
 *
 * The signing screen shows the customer some text, and afterwards we store what
 * they signed. If the client sent that text back to be stored, the record would
 * be whatever the client claimed — which is not a record of anything.
 *
 * So the server renders it for the preview and renders it again at signing from
 * the same inputs. Same template, same data, same output: what is stored is
 * what was shown, and it stays true even if the client is hostile.
 *
 * ## Why the placeholder catalogue lives here
 *
 * The console lists the fields an author may insert; this file is what actually
 * fills them. Those two lists have to be the same list. Kept apart, a token
 * added to one and forgotten in the other prints literally on a real customer's
 * contract — so the catalogue is declared next to the code that supplies the
 * values, and the console imports it.
 */

/** The facts a contract can mention. Everything else is template text. */
export type ContractFacts = {
  companyName: string;
  tinNumber: string | null;
  ownerName: string;
  ownerEmail: string;
  businessPhone: string | null;
  businessAddress: string | null;
  planCode: string;
  billingCycle: string;
};

/** ShopCore's own identity on the face of the document. */
export type ProviderIdentity = {
  legalName: string;
  tin: string | null;
  registrationNo: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  governingLaw: string;
};

export type RenderedContract = {
  template: {
    id: string;
    name: string;
    version: number;
    /** The provider's own signature and stamp, applied to every contract. */
    providerSignatureImage: string | null;
    providerStampImage: string | null;
    providerSignerName: string | null;
    providerSignerTitle: string | null;
  };
  provider: ProviderIdentity;
  body: string;
  plan: { code: string; name: string };
  amount: number;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  termMonths: number;
};

const CYCLE_LABELS: Record<string, string> = {
  monthly: "monthly",
  six_months: "every six months",
  annual: "annually",
};

/**
 * What the document falls back to when nobody has filled the provider's details
 * in yet.
 *
 * A blank provider block would be the one half of the agreement that is not
 * identified, so the brand name stands in until an operator supplies the
 * registered one. Rwanda because that is where the company is; an operator who
 * moves changes it on the template, not in this file.
 */
export const PROVIDER_DEFAULTS = {
  legalName: "ShopCore",
  address: "Kigali, Rwanda",
  governingLaw: "the Republic of Rwanda",
} as const;

/** Rwandan business dates read as "29 August 2026", not "8/29/2026". */
const formatDate = (date: Date) =>
  date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

const formatMoney = (amount: number, currency: string) =>
  `${currency} ${Math.round(amount).toLocaleString("en-US")}`;

/**
 * Every placeholder a template may use, and what fills it.
 *
 * Exported for the console's editor, which lists them beside the body so an
 * author never has to guess the spelling of a token that would otherwise render
 * as literal text on a signed agreement.
 */
export const CONTRACT_PLACEHOLDERS = [
  // ---- the customer
  { token: "{{company_name}}", describes: "The customer's registered business name", group: "Customer" },
  { token: "{{tin_number}}", describes: "Their TIN, as entered at signup", group: "Customer" },
  { token: "{{owner_name}}", describes: "Name of the person signing", group: "Customer" },
  { token: "{{owner_email}}", describes: "Their email address", group: "Customer" },
  { token: "{{business_phone}}", describes: "Business phone number", group: "Customer" },
  { token: "{{business_address}}", describes: "Business location", group: "Customer" },

  // ---- ShopCore
  { token: "{{provider_name}}", describes: "ShopCore's registered legal name", group: "Provider" },
  { token: "{{provider_tin}}", describes: "ShopCore's TIN", group: "Provider" },
  { token: "{{provider_registration}}", describes: "Company registration number", group: "Provider" },
  { token: "{{provider_address}}", describes: "Registered address", group: "Provider" },
  { token: "{{provider_email}}", describes: "Contact email for notices", group: "Provider" },
  { token: "{{provider_phone}}", describes: "Contact phone for notices", group: "Provider" },
  { token: "{{provider_signer_name}}", describes: "Who signs for ShopCore", group: "Provider" },
  { token: "{{provider_signer_title}}", describes: "Their title", group: "Provider" },

  // ---- the deal
  { token: "{{plan_name}}", describes: "Subscription plan chosen", group: "Commercial" },
  { token: "{{billing_cycle}}", describes: "Monthly, six months or annual", group: "Commercial" },
  { token: "{{amount}}", describes: "Amount due, with currency", group: "Commercial" },
  { token: "{{amount_in_words}}", describes: "The same amount spelled out", group: "Commercial" },
  { token: "{{currency}}", describes: "Currency code on its own", group: "Commercial" },
  { token: "{{term_months}}", describes: "Length of the term in months", group: "Commercial" },
  { token: "{{period_start}}", describes: "First day of the subscription term", group: "Commercial" },
  { token: "{{period_end}}", describes: "Last day of the term", group: "Commercial" },

  // ---- the document
  { token: "{{today}}", describes: "Date the contract is signed", group: "Document" },
  { token: "{{governing_law}}", describes: "Whose law governs the agreement", group: "Document" },
] as const;

/**
 * Renders the live template for one customer.
 *
 * Throws if there is no live template — a customer must never be walked to a
 * signing screen with nothing on it, and a silent empty contract would be
 * worse than an error.
 */
export async function renderActiveContract(facts: ContractFacts): Promise<RenderedContract> {
  const template = await prisma.contractTemplate.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  if (!template) {
    throw HttpError.badRequest("contracts.noActiveTemplate", { code: "no_active_contract" });
  }

  const plan = await prisma.subscriptionPlan.findUnique({ where: { code: facts.planCode } });
  if (!plan) {
    throw HttpError.badRequest("workspace.invalidPlan", {
      code: "invalid_plan",
      params: { plan: facts.planCode },
    });
  }

  const price = await prisma.subscriptionPlanPrice.findFirst({
    where: { planCode: facts.planCode, billingCycle: facts.billingCycle, isActive: true },
  });

  if (!price) {
    throw HttpError.badRequest("workspace.invalidPrice", {
      code: "invalid_price",
      params: { plan: facts.planCode, cycle: facts.billingCycle },
    });
  }

  const now = new Date();
  const months = monthsForCycle(facts.billingCycle, price.billingMonths);
  const periodEnd = addMonths(now, months);
  const amount = Number(price.finalPrice);

  const provider: ProviderIdentity = {
    legalName: template.providerLegalName?.trim() || PROVIDER_DEFAULTS.legalName,
    tin: template.providerTin?.trim() || null,
    registrationNo: template.providerRegistrationNo?.trim() || null,
    address: template.providerAddress?.trim() || PROVIDER_DEFAULTS.address,
    email: template.providerEmail?.trim() || null,
    phone: template.providerPhone?.trim() || null,
    governingLaw: template.governingLaw?.trim() || PROVIDER_DEFAULTS.governingLaw,
  };

  /*
   * An unsupplied detail becomes an underscored blank rather than the word
   * "null" or an empty gap. A contract reading "TIN ______" is plainly
   * incomplete; one reading "TIN null" looks like a system fault, and one with
   * nothing there at all hides that anything is missing.
   */
  const blank = "__________";

  const values: Record<string, string> = {
    "{{company_name}}": facts.companyName,
    "{{tin_number}}": facts.tinNumber?.trim() || blank,
    "{{owner_name}}": facts.ownerName,
    "{{owner_email}}": facts.ownerEmail || blank,
    "{{business_phone}}": facts.businessPhone?.trim() || blank,
    "{{business_address}}": facts.businessAddress?.trim() || blank,

    "{{provider_name}}": provider.legalName,
    "{{provider_tin}}": provider.tin || blank,
    "{{provider_registration}}": provider.registrationNo || blank,
    "{{provider_address}}": provider.address || blank,
    "{{provider_email}}": provider.email || blank,
    "{{provider_phone}}": provider.phone || blank,
    "{{provider_signer_name}}": template.providerSignerName?.trim() || blank,
    "{{provider_signer_title}}": template.providerSignerTitle?.trim() || blank,

    "{{plan_name}}": plan.name,
    "{{billing_cycle}}": CYCLE_LABELS[facts.billingCycle] ?? facts.billingCycle,
    "{{amount}}": formatMoney(amount, price.currency),
    "{{amount_in_words}}": `${amountInWords(amount)} ${price.currency}`,
    "{{currency}}": price.currency,
    "{{term_months}}": String(months),
    "{{period_start}}": formatDate(now),
    "{{period_end}}": formatDate(periodEnd),

    "{{today}}": formatDate(now),
    "{{governing_law}}": provider.governingLaw,
  };

  const body = Object.entries(values).reduce(
    (text, [token, value]) => text.split(token).join(value),
    template.body,
  );

  return {
    template: {
      id: template.id,
      name: template.name,
      version: template.version,
      providerSignatureImage: template.providerSignatureImage,
      providerStampImage: template.providerStampImage,
      providerSignerName: template.providerSignerName,
      providerSignerTitle: template.providerSignerTitle,
    },
    provider,
    body,
    plan: { code: plan.code, name: plan.name },
    amount,
    currency: price.currency,
    periodStart: now,
    periodEnd,
    termMonths: months,
  };
}
