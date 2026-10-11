import { prisma } from "../src/db/prisma";

/**
 * Puts a first contract template in place.
 *
 * Without one, a customer who picks a plan reaches the signing step with
 * nothing to sign. The console can edit or replace this — the point is that the
 * flow is never staring at an empty screen on a fresh install.
 *
 * ## Why the body is this long
 *
 * The first version of this seed was eight short clauses, and it read as a
 * summary of an agreement rather than as one. A subscription contract that a
 * business signs before paying has to answer the questions that actually come
 * up later: what happens when a renewal is missed, who owns the data, what the
 * provider may do with it, how a price change is announced, what uptime is
 * promised and what is not, how either side gets out, and whose courts decide.
 * Every clause below exists because its absence is a question somebody would
 * have to answer over email, under pressure, with money already spent.
 *
 * The signature and stamp are deliberately *not* seeded. They are ShopCore's
 * own marks, they bind the company, and attaching them is PIN-confirmed in the
 * console by a person — not something a setup script does on their behalf.
 *
 * Idempotent: if any template already exists, this leaves it alone. Run with
 *
 *   npx tsx scripts/seed_contract_template.ts
 */

const BODY = `SHOPCORE SOFTWARE SUBSCRIPTION AGREEMENT

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

async function main() {
  const existing = await prisma.contractTemplate.count();

  if (existing > 0) {
    console.log(`${existing} contract template(s) already exist — nothing seeded.`);
    return;
  }

  const template = await prisma.contractTemplate.create({
    data: {
      name: "Standard service agreement",
      description: "The default agreement signed at signup, before the first payment.",
      body: BODY,
      isActive: true,
      /*
       * The provider block is seeded with what is already true and left blank
       * where it is not. A placeholder TIN would print on real contracts and
       * look like a fact; an empty one prints as an underscored blank, which is
       * visibly something for an operator to fill in.
       */
      providerLegalName: "ShopCore",
      providerAddress: "Kigali, Rwanda",
      governingLaw: "the Republic of Rwanda",
    },
  });

  console.log(`Seeded "${template.name}" (v${template.version}) and made it live.`);
  console.log(
    "Next: open Platform → Contract Templates, fill in the provider details, and attach ShopCore's signature and stamp with your signing PIN.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
