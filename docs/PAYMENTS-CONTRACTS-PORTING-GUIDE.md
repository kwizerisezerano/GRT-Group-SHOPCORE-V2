# Porting ShopCore Payments & Contracts

Everything needed to lift the payment rails and the sign-before-you-pay contract
flow out of ShopCore and drop them into another project.

This is a **porting** document, not a description of ShopCore. It states what
each piece does, what it depends on, what has to be renamed, and — where it
matters most — **why** a decision was made, because several of them look
arbitrary until you hit the failure that caused them.

Everything described here is live in ShopCore and covered by
`npm run test:system` (57 checks, real browser), plus 132 unit and 299
integration tests.

---

## 0. The naming prefix — read this first

Every name that could collide with the host project is prefixed. Pick one
short token for your project and use it in all four places below. This guide
writes it as `ACME`/`acme`; ShopCore uses `SHOPCORE`/`shopcore`.

| What | ShopCore today | Yours |
| --- | --- | --- |
| Env vars | `LMB_APP_KEY`, `PAYMENTS_DRIVER` | `ACME_LMB_APP_KEY`, `ACME_PAYMENTS_DRIVER` |
| Tables | `payment_transactions`, `contract_templates` | `acme_payment_transactions`, `acme_contract_templates` |
| API mount | `/api/payments`, `/api/contracts` | `/api/acme/payments`, `/api/acme/contracts` |
| Browser storage | `shopcore_onboarding_contract` | `acme_onboarding_contract` |

> **Note on ShopCore itself.** ShopCore's own tables and env vars are *not*
> prefixed — they predate this guide, and renaming live tables and rotating
> every deployment's `.env` is a destructive migration that should be a
> deliberate, separately-tested change rather than a side effect of writing
> documentation. The prefix column above is the convention for **new**
> integrations. If you want ShopCore's existing names migrated too, that is a
> schema migration plus an `.env` rewrite, and worth doing on its own.

Prefixing matters most for the **env vars** and the **tables**. A host project
with its own `payment_transactions` table or its own `API_URL` will collide
silently and the failure surfaces as mystifying runtime behaviour, not as an
error at boot.

---

## 1. What you are porting

Two features that are separable, but designed to sit together:

**Payments** — mobile money (MTN, Airtel), card, and manual bank transfer,
against the LMBTech Rwanda gateway. Money is only ever considered received when
the gateway says so.

**Contracts** — a super-admin-authored agreement template, filled per customer,
signed (drawn or uploaded) with an optional company stamp, countersigned with
the provider's own signature and stamp, generated as a PDF automatically and
downloaded to the customer's device, and stored against the account. The
customer signs **before** paying.

They are joined at one point: the request that creates an account files the
signed contract and *then* puts the charge on the wire. That ordering is
deliberate and is the single most important thing to preserve — see §6.

---

## 2. Files to copy

### Backend

```
src/lib/payments/lmbtech.ts            The gateway client. The important file.
src/lib/payments/service.ts            Starting, settling, and recording a payment.
src/lib/payments/settlementPoller.ts   Watches a payment when no callback arrives.
src/lib/payments/logger.ts             Writes every request/response to the DB.
src/lib/payments/redact.ts             Masks PII before it is logged.
src/lib/payments/lmbtech.live.test.ts  9 tests pinning real captured payloads.

src/modules/payments/payments.routes.ts   Callback, return, status, transactions, logs.

src/modules/contracts/contracts.render.ts   Fills {{placeholders}} server-side.
src/modules/contracts/contracts.pdf.ts      Draws the PDF (pdfkit).
src/modules/contracts/contracts.service.ts  Validates and files a signature.
src/modules/contracts/contracts.routes.ts   preview / generate / mine / mine/pdf.

src/modules/platform/platform.contracts.routes.ts   Admin CRUD for templates.
```

### Frontend

```
src/components/payments/PaymentBrandMark.tsx   The payment icons — see §8.
src/components/onboarding/SignaturePad.tsx     Draw-or-upload signature capture.
src/components/billing/SignedContractCard.tsx  Read + download a filed contract.
src/pages/onboarding/Contract.tsx              The signing screen.
src/pages/onboarding/Checkout.tsx              The payment screen.
src/pages/platform-admin/ContractTemplates.tsx Template editor.
src/lib/onboardingDraft.ts                     Session-storage handover between steps.
```

### Dependencies

Backend: `pdfkit`, `zod`, `@prisma/client`. Nothing else — no payment SDK, the
gateway is plain HTTP.
Frontend: `@tanstack/react-query`, `sonner`, `lucide-react`.

---

## 3. Environment

```bash
# --- driver -----------------------------------------------------------------
ACME_PAYMENTS_DRIVER=mock          # mock | lmbtech. See the warning below.

# --- LMBTech credentials ----------------------------------------------------
ACME_LMB_APP_KEY=app_xxxxxxxxxxxx
ACME_LMB_SECRET_KEY=scrt_xxxxxxxxxxxx

# --- gateway endpoints ------------------------------------------------------
ACME_API_URL=https://pay.lmbtech.rw/pay/config/api
ACME_LMBTECH_VERIFY_URL=https://pay.lmbtech.rw/pay/config/api.php

# --- your endpoints, which the gateway calls back --------------------------
ACME_LMB_CALLBACK_URL=https://api.example.com/api/acme/payments/callback/lmbtech
ACME_LMB_CARD_REDIRECT_URL=https://app.example.com/billing/payment-return

# --- wire values for each rail ---------------------------------------------
ACME_GATEWAY_METHOD_MTN=MTN_MOMO_RWA
ACME_GATEWAY_METHOD_AIRTEL=AIRTEL_MONEY_RWA
ACME_GATEWAY_METHOD_CARD=card

# --- how long to hold the pay request open ---------------------------------
ACME_LMB_PAY_TIMEOUT_SECONDS=8
```

> **`PAYMENTS_DRIVER=mock` is the safe default and must stay the default.**
> ShopCore pins it to `mock` in both vitest configs so a test run can never
> charge a real account. Do the same in yours before you write a single test.
> Making the live driver opt-in is worth more than it costs.

The gateway method values are in env, not in code, because the LMBTech
documentation names MTN and card explicitly and is **silent on Airtel** — the
Airtel value was established by probing. A change on their side should be a
config edit, not a deploy.

---

## 4. Database

Six tables. Prefix all of them.

| Table | Holds |
| --- | --- |
| `payment_methods` | The rails you offer: code, name, provider, `is_active`, display order |
| `payment_transactions` | One row per charge attempted. `reference_id` is unique and is your handle |
| `payment_logs` | Every request and response, both directions, redacted |
| `contract_templates` | The agreement, with `{{placeholders}}`, one `is_active` at a time |
| `signed_contracts` | What one customer actually signed — full rendered text, images, terms |
| `subscription_invoices` | Issued after a payment settles |

Two schema decisions worth keeping:

**Payer identity is encrypted at rest.** `payer_phone_encrypted`,
`payer_email_encrypted`, `payer_name_encrypted`. Nothing looks a payment up by
payer, so there is no blind index and no searchability cost.

**`signed_contracts.body` stores the full rendered text, not a reference to the
template.** Templates get edited. A contract has to say what was agreed on the
day it was agreed, and resolving it live would silently rewrite the history of
every signature every time somebody fixed a typo. `template_id` is nullable for
the same reason: deleting a template must not delete the record of what
somebody signed.

An invoice counter must be **platform-wide, not per tenant**. ShopCore reused a
per-tenant counter here and got invoice-number collisions across tenants.

---

## 5. The gateway — everything that is not in their docs

This section is the reason this document exists. Each item below cost real
debugging time.

### Auth is HTTP Basic, not Bearer

```
Authorization: Basic base64(app_key + ":" + secret_key)
```

A Bearer token returns `401 "Invalid Authorization header format"`. The
symptom in the product is worse than an error: **no prompt ever reaches the
phone**, and nothing says why.

### One endpoint, an `action` field

```jsonc
POST https://pay.lmbtech.rw/pay/config/api
{
  "action": "pay",                 // or "payout"
  "email": "customer@example.com",
  "name": "Jean Uwimana",
  "payment_method": "MTN_MOMO_RWA",
  "amount": 15000,
  "service_paid": "Starter plan",
  "reference_id": "your-unique-id",
  "callback_url": "https://api.example.com/...",
  "payer_phone": "0791545579",      // mobile money only
  "card_redirect_url": "https://..." // card only
}
```

Verification is a **different URL** and a `GET`:

```
GET https://pay.lmbtech.rw/pay/config/api.php?reference_id=<id>
```

### `pay` blocks until the customer approves

It does not return when the prompt reaches the handset. It holds the connection
open until the payer enters their PIN or the prompt expires — which can run to
minutes.

So: send it with a short `AbortSignal.timeout` (8s), and **on timeout do not
mark the payment failed**. Ask the verify endpoint what actually happened. An
early version treated the timeout as failure and marked genuinely successful
payments as failed — the worst possible direction for that error.

### Response shapes vary

Sometimes flat, sometimes wrapped in `data`. Merge both:

```ts
const merged = { ...parsed, ...parsed.data };
```

A boolean `status` means "not found", not a state. `mapStatus` returns `null`
for it, and null means *ask again*, never *assume failed*.

### The fee is added on top, on bands they do not publish

RWF 35,000 arrives on the handset as 36,400. Tell the customer a fee will be
added; **do not compute a total** — the bands are theirs to change and a wrong
figure is worse than an honest warning.

### The callback may never arrive

Do not depend on it. `settlementPoller.ts` watches every pending payment on a
backoff of `[5,5,5,10,10,15,15,20,30,30,45,60,60,60]` seconds, giving up at 6
minutes — longer than a mobile money prompt stays alive. It takes a `settle`
callback rather than importing the settlement service, to avoid an import
cycle.

**Money is received only when the gateway confirms it.** No timeout, no
callback shape, and no client-side signal is allowed to open an account.

---

## 6. The contract flow

```
plan chosen
   ↓
POST /contracts/preview          server renders the agreement with their details
   ↓
customer reads it, ticks agree, signs (draw or upload), optional stamp
   ↓
POST /contracts/generate         PDF returned; browser saves it automatically
   ↓
POST /workspace/pending          creates the account, FILES the contract, THEN charges
   ↓
GET  /contracts/mine  ·  GET /contracts/mine/pdf
```

### The two rules that matter

**1. The server renders the text. Twice. The browser never sends it back.**

The signing screen shows text the server produced. When the signature is filed,
the server renders it *again* from the same template and the same inputs and
stores its own output. Same template, same data, same result — so what is
stored is what was shown, and it stays true even if the client is hostile. If
the browser posted the body back, the record would be whatever the client
claimed, which is not a record of anything.

Only the **signature image, stamp image and typed name** come from the client,
because they can only come from there.

**2. Sign, then pay — in that order, in one request.**

The contract is written before the charge goes on the wire. If the charge went
first, a customer could be debited for an agreement no record says they
accepted — the one failure here that cannot be put right afterwards. A contract
with no payment against it is merely an account awaiting payment, which the rest
of the system already understands.

### Template placeholders

Twelve, filled at signing time:

```
{{company_name}} {{tin_number}}   {{owner_name}}    {{owner_email}}
{{business_phone}} {{business_address}} {{plan_name}} {{billing_cycle}}
{{amount}}       {{period_start}} {{period_end}}    {{today}}
```

The editor lists them beside the text and flags any `{{token}}` that is not one
of them, because a misspelled placeholder is invisible until it prints
literally on a customer's contract. An unsupplied value renders as `__________`
— visibly incomplete, rather than the word `null` or a silent gap.

Exactly one template is live. Activating one stands the others down, and the
live one cannot be deleted until another is activated. The `version` bumps only
when the **body** changes — renaming a template or switching which is live does
not change what anybody agreed to, and bumping it for that would make the
number meaningless as a record.

### The PDF

`contracts.pdf.ts`, drawn with pdfkit rather than a headless browser: rendering
a few pages of text should not mean shipping Chromium.

The body is plain text — the right format for an editor where an author should
not have to learn markup to change a payment term. `parseBody` reads the
conventions people already use (`3. SERVICE` is a clause heading, a short
all-caps line is a heading, indented lines belong to the clause above) and sets
them accordingly. Anything unrecognised becomes a paragraph, so an author
cannot produce something it refuses to render.

**Never hand pdfkit an image you have not structurally validated.** This is the
single most expensive thing in this document. png-js throws "Incomplete or
corrupt PNG file" from inside `doc.image()`, and catching it does not save you:
from that moment the **process is poisoned**, and the next image parse — even in
a brand new document — *hangs* instead of throwing. The request never answers,
and every render queued behind it stalls too. One truncated PNG takes the whole
payment step down, silently, with no error anywhere.

Browsers render truncated PNGs happily, so a customer can upload one, see it
perfectly in the preview, and take the endpoint down. `isCompleteImage()` in
`contracts.pdf.ts` walks the PNG chunk table to IEND (and checks JPEG
SOI/EOI) before pdfkit ever sees the bytes. Port it.

Three more pdfkit traps, all of which produce silent wrong output:

- **Footers below the bottom margin add pages.** pdfkit reads text crossing the
  bottom margin as overflow and starts a new page — which gets its own footer,
  and so on. A two-page agreement came out as six. Zero `doc.page.margins.bottom`
  while writing the footer, then restore it.
- **`bufferedPageRange()`, not `bufferedPages()`,** and it is indexed from
  `range.start`, not from zero.
- **PDF text lives in compressed streams.** Asserting `pdf.toString()` contains
  a name will fail on a perfectly good document. Compare sizes and page counts
  instead.

---

### The body-size ceiling

`express.json()` defaults to **100kb** — about a fifth of one photographed
stamp. A frontend that accepts 2MB images against that default produces the
worst kind of failure: the upload is accepted, the preview renders, and signup
dies at the last step with nothing to explain it.

Raise it only for the routes that legitimately carry images, mounted *before*
the general parser (body-parser marks the request as parsed, so the default one
then leaves them alone):

```ts
app.use(
  ["/api/contracts", "/api/platform/contract-templates", "/api/workspace/pending"],
  express.json({ limit: "12mb" }),
);

app.use(express.json());
```

Every other endpoint keeps the small ceiling, which is the one protecting them.

### Countersigning

The provider's signature, stamp, signer name and title live on the **template**,
not on each contract: they are identical on every agreement issued, so an
operator uploads them once. They are then **copied onto each signed contract**,
for the same reason the body is — a change of director next year must not
rewrite what somebody already signed.

An agreement signed by one party reads as a form the customer filled in. Both
signatures side by side is the difference between that and a contract.

---

## 7. Browser traps that cost real time

These are not ShopCore-specific. Any project doing this will hit them.

**A programmatic download cancels itself if you clean up too early.**

```ts
link.click();
// NOT here — this silently cancels the download, with no error and no request:
// link.remove(); URL.revokeObjectURL(url);
setTimeout(() => { link.remove(); URL.revokeObjectURL(url); }, 60_000);
```

**`window.open(url, "_blank", "noopener")` returns `null` by specification.**
If you need the handle (to point a claimed tab at a gateway URL you learn after
an `await`), open without it and set `tab.opener = null` yourself.

**Claim the tab inside the click.** Browsers block `window.open` that is not a
direct result of a gesture, and the gesture has expired by the time an `await`
resolves. Open a blank tab synchronously, set its location later.

**Check your CSS actually applies.** ShopCore's `index.css` carries a legacy
bridge rule:

```css
.dark .bg-white { background-color: hsl(var(--card)) !important; }
```

which made the signature pad dark, with near-black ink on it — invisible. Use an
arbitrary value (`bg-[#ffffff]`) for surfaces that must genuinely be white, such
as anything whose pixels end up on a white PDF page.

**A `{/* comment */}` inside a ternary branch is a second child, not a comment.**
`{cond ? ( {/* … */} <div/> ) : …}` is a syntax error that 500s the route.

**Canvas needs its bitmap sized separately from its CSS box**, scaled by
`devicePixelRatio`, or every stroke is blurred and skewed. Size it in an effect,
and re-size on window resize.

**Use pointer events, not mouse or touch.** One set of handlers covers phone,
trackpad and stylus. Mouse-only leaves the pad dead on phones; both sets means a
touch draws two overlapping strokes. `setPointerCapture` keeps a stroke attached
when a finger slides past the edge.

---

## 8. The payment icons

`PaymentBrandMark.tsx` — MTN, Airtel, Visa/Mastercard, bank, and a generic
fallback. Copy the file; it has no dependencies beyond `lucide-react` and a
`cn` helper.

```tsx
import { PaymentBrandMark, brandFor } from "@/components/payments/PaymentBrandMark";

<PaymentBrandMark brand={brandFor({ provider: method.provider, code: method.code })} />
```

`brandFor` maps a `payment_methods` row onto a mark by provider then code, so
adding a rail needs no component change.

**They are inline SVG, not `<img>` tags pointing at a CDN.** This is deliberate:

- No request, so they render offline — and a till showing three broken-image
  icons on the payment screen is exactly when that matters.
- No layout shift, crisp at any size.
- Remote logos change without warning and block on someone else's uptime.
- No third party learns which page your customer is on.

`currentColor` is deliberately **not** used inside the marks. MTN's yellow and
Visa's blue *are* the recognition; recolouring them to match a theme defeats the
point. The surrounding chip handles light/dark instead.

---

## 9. Porting checklist

1. Copy the files in §2. Rename per §0.
2. Add the tables (§4) with your prefix. Keep the encrypted payer columns and
   the full-text `signed_contracts.body`.
3. Set the env in §3. Leave `PAYMENTS_DRIVER=mock`. Pin it to `mock` in your
   test config **before** writing tests.
4. Mount `/api/<prefix>/payments` and `/api/<prefix>/contracts`. Register the
   callback URL with the gateway.
5. Seed `payment_methods` and one active contract template.
6. Wire the flow in §6. Keep sign-then-pay in one request.
7. Go live: set `PAYMENTS_DRIVER=lmbtech` and test with a small real amount
   against a real handset. RWF 100 is enough. **Nothing else proves it works** —
   the mock driver cannot tell you the auth header is wrong.
8. Port the browser checks in §7 into your own test, or you will rediscover
   them.

## 10. Things to verify in a real browser, not by reading code

Every serious defect in this feature was invisible in the source and obvious the
moment a browser touched it. ShopCore's `scripts/test-system.mjs` is the model:
it asserts on **measured facts** — a computed background colour, a count of
inked pixels, the magic bytes of a PDF, the row occupancy of a grid — not on
whether an element exists.

Minimum worth asserting:

- The signature pad's computed background is actually `rgb(255,255,255)`.
- Drawing leaves a non-zero count of inked pixels.
- The generated file's first five bytes are `%PDF-`.
- Payment is disabled before signing and enabled after.
- The filed contract body matches what was displayed.
- The download button both requests the file *and* triggers a save — they fail
  for different reasons, and the difference is the whole diagnosis.

Run against **bank transfer**, the one rail that never reaches the gateway, so
the suite can run as often as you like without charging anybody.
