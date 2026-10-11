# Subscriptions, plan limits and payments

How a company gets a ShopCore workspace, what its subscription lets it do, and
how the money moves.

---

## The shape of it

```
Platform console            Public signup             The workspace
──────────────────          ──────────────            ─────────────
Plan editor      ──writes──▶ subscription_plans ──reads──▶ pricing cards
  ceilings                   + _limits                     on /signup
  prices                     + _prices
  modules                    + _features
                                  │
                                  │ enforced by
                                  ▼
                            lib/planLimits.ts ──refuses──▶ POST /users/create
                                                            POST /branches
                                                            POST /products
Organizations    ──creates──▶ tenants + tenant_subscriptions
Payment gateway  ◀──logs───── payment_transactions + payment_logs
```

Nothing about a plan lives in code. A super admin writes it in the console, the
signup page reads the same rows, and the server refuses anything past the
ceilings those rows describe.

---

## Plans

A plan is `subscription_plans` plus three child tables, all edited as one
document from **Platform console → Subscription plans**.

| Table | What it holds |
|---|---|
| `subscription_plan_prices` | One row per billing cycle (monthly / six months / annual), with the list price and the discount. `final_price` is what the customer is charged and is computed on save. |
| `subscription_plan_limits` | The ceilings — "3 users", "2 branches", "unlimited products". |
| `subscription_plan_features` | The modules the plan opens, consumed by the frontend's `PlanGuard`. |

### How a limit resolves

Three layers, most specific first:

1. **`tenant_limit_overrides`** — a ceiling negotiated for one workspace
   ("they bought one extra seat"). Set from the console's organization drawer.
2. **`subscription_plan_limits`** — what the plan says.
3. **Nothing at all** — treated as **unlimited**.

Layer 3 is deliberate. A capacity key nobody has priced yet must not silently
block every workspace on the platform the moment it is added to the code — the
ceiling has to be a decision somebody made.

### Capacities the server counts

`users`, `branches`, `warehouses`, `products`, `customers`, `suppliers`,
`monthly_transactions`.

`pos_terminals`, `desktop_devices` and `storage_gb` can be priced and displayed
but have no source of truth in this schema yet, so nothing enforces them. The
console's limit picker marks them **not metered yet** rather than implying a
ceiling that would never bite.

Two details worth knowing:

- **A pending invitation spends a seat.** Counting only accepted members lets
  an admin send ten invitations against three seats and discover the problem
  when the seventh person cannot get in — after the promise was made.
- **Warehouses are branches with `type = "warehouse"`.** They count against
  their own ceiling, not the branch one.

### Where it is enforced

| Path | Ceiling |
|---|---|
| `POST /api/users/create` | `users` |
| `POST /api/users/invites` | `users` |
| `POST /api/platform/tenants/:id/users` | `users` — a platform admin outranks every tenant role, but not the subscription |
| `POST /api/branches` | `branches` or `warehouses`, by `type` |
| `POST /api/products` | `products` |
| `POST /api/customers`, `POST /api/suppliers` | `customers`, `suppliers` |

A refusal is `403` with `error.code = "capacity_reached"` and the numbers in
`error.details`, so the screen can say *"5 of 5 team members used"* rather than
just failing.

The browser shows the count before the form (`components/SubscriptionCapacity.tsx`),
but that is a courtesy. The rule is the server's.

---

## Payments

LMBTech Pay (`pay.lmbtech.rw`) fronts MTN Mobile Money, Airtel Money and card
payments. One JSON endpoint does everything; `action` decides which, and
credentials go in an HTTP Basic header as `app_key:secret_key`.

> **The live API differs from the documentation.** Everything in this section
> marked *observed* was captured from real calls against `pay.lmbtech.rw` with
> production credentials, because building to the documented shapes produced an
> integration that could not take a single payment. The captured payloads are
> pinned as tests in `lib/payments/lmbtech.live.test.ts`, so if their wire
> format moves, that file fails first and says what changed.

### Two drivers

| `PAYMENTS_DRIVER` | Behaviour |
|---|---|
| `mock` (default) | Never calls out. Accepts a collection as pending, then posts itself the same callback the real gateway would a few seconds later, writing the same `payment_transactions` and `payment_logs` rows. The whole flow — including the callback handler — is exercised on every local run. |
| `lmbtech` | The real gateway. Requires `LMB_APP_KEY` and `LMB_SECRET_KEY`; without both, charges are refused locally rather than sent unauthenticated. |

### Configuration

```ini
PAYMENTS_DRIVER="mock"          # or "lmbtech"

API_URL="https://pay.lmbtech.rw/pay/config/api"

# The pair LMBTech issue. Both are required with the live driver.
LMB_APP_KEY=""
LMB_SECRET_KEY=""
API_KEY=""                      # superseded; kept so old deployments boot

# How long to hold their blocking `pay` call open before polling instead.
LMB_PAY_TIMEOUT_SECONDS="8"

# Where a payment's status can be re-asked for.
LMBTECH_VERIFY_URL="https://pay.lmbtech.rw/pay/config/api.php"

# What each rail is called on the wire — a config edit, not a deploy.
GATEWAY_METHOD_MTN="MTN_MOMO_RWA"
GATEWAY_METHOD_AIRTEL="AIRTEL_MONEY_RWA"
GATEWAY_METHOD_CARD="card"

# The gateway posts results to {API_PUBLIC_URL}/api/payments/callback/lmbtech,
# so with the live driver this must be an address it can actually reach.
API_PUBLIC_URL="http://127.0.0.1:4000"

LMB_CALLBACK_URL=""             # only when the derived URL is wrong
LMB_CARD_REDIRECT_URL=""        # defaults to {FRONTEND_URL}/billing/payment-return
MOCK_PAYMENT_SETTLE_SECONDS="4"
```

### Authentication — *observed*

`Authorization: Basic base64(app_key:secret_key)` on every call. Not a bearer
token: the server rejects one before it reaches any payment logic, and does so
identically for a valid key, so the failure looks like bad credentials rather
than a bad scheme.

| Sent | Response |
|---|---|
| *(nothing)* | `401 {"status":"fail","message":"Authorization header is missing"}` |
| `Bearer <app key>` | `401 {"status":"fail","message":"Invalid Authorization header format"}` |
| `Bearer <secret key>` | `401` — same |
| `Basic <app:secret>` | `200` |

### The `pay` call blocks — *observed*

For mobile money their endpoint **does not return when the prompt reaches the
handset**. It holds the connection open until the payer approves it or it
expires, which can run to minutes. Two consequences the integration is built
around:

1. **We abort deliberately** after `LMB_PAY_TIMEOUT_SECONDS` (default 8) rather
   than pinning an Express worker and a browser request to one person's PIN
   entry. The payment is already created on their side by then — a reference
   aborted at 40s was queryable and settled normally.
2. **A timeout is not a failure.** `GatewayError.timedOut` marks it, and
   `startSubscriptionPayment` asks the verify endpoint whether the gateway knows
   the reference. If it does, the charge is live and stays `pending`. Only an
   unknown reference is a genuine failure. Before this, a working payment was
   marked `failed` seconds after the customer's phone lit up asking them to
   approve it.

Card is different: it returns immediately with a `redirect_url` to their Pesapal
iframe, and the customer finishes there.

### Response shapes — *observed*

The same field arrives three ways, so both the wrapped and flat forms are read
(`{ ...parsed, ...parsed.data }`, flat first so a wrapper still wins):

| Call | Shape |
|---|---|
| verify | **flat** — `{status, amount, reference_id, transaction_id, name, message}` |
| card initiate | **wrapped** in `data`, with `redirect_url` at the *top* level |
| unknown reference | `{"status": false, "message": "Payment not found …"}` — HTTP **200** |

That last row is why `mapStatus` returns `null` for a boolean. `String(false)`
is `"false"`, which is not a known status, and an earlier version fell through
to `"pending"` — leaving a reference the gateway had never heard of polling
until its watch expired.

### The gateway adds a fee — *observed*

The amount charged is **higher than the amount requested**, on a banded
schedule they do not publish:

| Requested | Charged | Added |
|---|---|---|
| 100 | 105 | 5% |
| 1,000 | 1,200 | 20% |
| 15,000 | 15,600 | 4% |
| 35,000 | 36,400 | 4% |
| 150,000 | 156,000 | 4% |

Every real plan price sits in the 4% band, so a Professional subscription at
RWF 35,000 reaches the handset as **RWF 36,400**. The checkout screen warns
that the approved amount will be higher rather than printing a computed total —
the bands are theirs to change, and a wrong figure would be worse than an
honest warning. The exact figure they charged is in `payment_logs`.

### Settlement does not depend on the callback

`lib/payments/settlementPoller.ts` watches every live pending reference — dense
at first, backing off, giving up at six minutes. It exists because the callback
goes to `API_PUBLIC_URL`, so on a laptop, behind NAT, or before DNS is pointed,
it is posted into the void. Without it a customer could approve the prompt,
watch the money leave, and never get their workspace. The callback remains the
fast path where it can arrive; this is the guarantee.

### References

`INV-YYYYMMDD-<timestamp tail>-<random>` — e.g. `INV-20260827-19284736-4821`.

The timestamp tail keeps references roughly ordered in a log; the random suffix
(from `crypto.randomInt`, not `Math.random`) is what stops two workspaces paying
in the same millisecond from colliding, and stops one being guessed from
another. That matters because the callback endpoint is unauthenticated and the
reference is the only thing a forger would need.

### Method mapping

| Our `payment_methods.code` | On the wire |
|---|---|
| `mobile_money_mtn` | `MTN_MOMO_RWA` |
| `mobile_money_airtel` | `AIRTEL_MONEY_RWA` |
| `card` | `card` |
| `bank_transfer` | *(never sent — settled by a human)* |

> **Airtel is unconfirmed.** The gateway validates no method names at all — a
> deliberately invented `BOGUS_METHOD_X` was accepted and created a pending
> payment exactly like `AIRTEL_MONEY_RWA` did. So acceptance proves nothing,
> and Airtel cannot be verified without debiting a real Airtel line. MTN and
> card are confirmed end to end. If Airtel turns out to need a different
> string, change `GATEWAY_METHOD_AIRTEL` in `.env` — no deploy, no code.

### Never charge a real account from a test run

`PAYMENTS_DRIVER` is pinned to `mock` in both `vitest.config.ts` and
`vitest.integration.config.ts`, not inherited from `.env`. Once a machine has
live credentials configured — which is the normal state after testing the
integration — the payment suites would otherwise put real charges on a real
account every time somebody ran the tests. `dotenv` leaves already-set
variables alone, so the pin wins.

`scripts/smoke_lmbtech_live.ts` is the one thing that does charge, and it is
never part of `npm test`:

```
npx tsx scripts/smoke_lmbtech_live.ts 0791545579 100
```

### The flow

```
signup / billing ──▶ POST /subscription/checkout
                        │
                        │ writes payment_transactions (status: pending)
                        │ BEFORE calling out, so a timeout still leaves a row
                        ▼
                     gateway
                        │
      ┌─────────────────┼──────────────────┐
      │                 │                  │
   MoMo prompt     card redirect      bank transfer
   on the phone    to Pesapal         (no callback)
      │                 │                  │
      └────────┬────────┘                  │
               ▼                           ▼
   POST /payments/callback/lmbtech   platform admin approves
               │                           │
               └───────────┬───────────────┘
                           ▼
                  applyPaymentResult()
                  → subscription period set
                  → tenant.workspace_status = "active"
```

**Signing up is not paying.** A workspace opens only when a payment is
confirmed — or when the plan grants a trial *and* the customer chose no payment
method. Choosing MTN Mobile Money always means paying now; giving them fourteen
free days instead would mean the charge they just authorised never happens.

### The four signup steps

Signup is split across four screens rather than one form:

| Step | Route | What it does |
|---|---|---|
| 1–2 | `/signup` | Account, then business details. Creates the **account only** — `tenantId` comes back `null` and `needsPlan: true`. |
| — | `/verify-otp` | The emailed six-digit code. Raised by signup itself (`otpRequired`), so an unverified account cannot reach a workspace at all. |
| 3 | `/onboarding/plan` | The live catalogue, with each plan's ceilings, features and amount — plus **Start N days free** where the plan offers a trial. |
| 4 | `/onboarding/checkout` | Payment method, then the charge. `POST /workspace/pending` creates the workspace **and** starts the payment in one request. |

### The free trial

`POST /workspace/pending` with `start_trial: true` and **no** payment method
opens the workspace on the plan's trial and charges nothing. Choosing a payment
method always means paying now — being handed fourteen free days after
authorising a MoMo charge is not what anybody expects.

A trial deliberately does **not** set `activatedAt`: that field means "a payment
activated this subscription", and it is what `resolveSubscriptionState` reads to
tell a trial apart from an unpaid term. When `trialEndsAt` passes, the
subscription resolves to `trial_expired` and the workspace closes until they
pay — with no scheduler involved.

Two consequences worth knowing:

- **The access token is reissued** by `POST /workspace/pending`. The tenant is
  baked into the token, and the one minted at signup knows nothing about the
  workspace that now exists — without the swap, every tenant-scoped call after
  the plan screen is refused with `tenant_required` on a workspace that
  demonstrably exists.
- **An account with no workspace is a real state.** Signing in lands on the
  plan screen rather than an empty dashboard.

### When a workspace is shut

A closed workspace is no longer redirected to a bare activation page. The app
shell stays — header, menu, footer — the menu collapses to the screens that
still work (`lib/workspaceLock.ts`), and the page area explains the state:

| State | What the customer is asked to do |
|---|---|
| `pending_payment` | Pay for the first time |
| `expired` | Renew — their data is intact |
| `trial_expired` | Choose a plan |
| `blocked` | Contact support |

### Seeing what is left

`GET /subscription/current` returns a `period` block — `used_days`,
`remaining_days`, `total_days`, `percent_used` — computed server-side because a
trial measures from `trialEndsAt` and a paid term from `currentPeriodEnd`, and
doing that arithmetic in the browser puts the wrong number on the one screen
where it matters. `remaining_days` goes negative once the term has run out,
which the screens read as "overdue by".

The billing screen and the locked screen both render it through
`components/SubscriptionUsage.tsx`, above the capacity bars.

Expiry is **resolved from the period dates on every session read**
(`lib/subscriptionState.ts`), not written by a scheduled job. A term that ends
closes the workspace by itself, and a renewal payment reopens it the moment the
callback lands — with no cron to fail.


### Reading a callback

The gateway does not send one shape. The same field arrives as `reference_id`,
`refid`, `reference` or `OrderMerchantReference` depending on the rail, and some
payloads nest everything under `data`. All of them are read
(`extractReference` / `extractTrackingId` / `extractStatus`).

Statuses are equally varied — `success`, `successful`, `paid` and `completed`
all mean the money arrived. `STATUS_MAP` holds the whole vocabulary.

An unrecognised status is **not** treated as pending, because that is
indistinguishable from a payment still in flight and would leave a paid
workspace shut. Instead:

1. Ask the gateway directly (`LMBTECH_VERIFY_URL`).
2. Card returns only: if the payer came back through the browser with a tracking
   id and nothing that reads as a failure, the redirect itself is the
   confirmation — that is what it means.
3. Otherwise leave the payment pending and log why.

### The callback endpoint

`POST /api/payments/callback/lmbtech` is deliberately unauthenticated — the
caller is LMBTech's server, which has no session with us. What protects it:

- References are 14 random characters minted per payment; a caller who cannot
  guess one cannot reach anything.
- Every callback is written to `payment_logs` with its source address *before*
  it is acted on.
- `applyPaymentResult` refuses to move an already-settled payment, so a forged
  or repeated callback cannot double-extend a subscription period.

It accepts both shapes the gateway documents — JSON for mobile money, form
fields for card returns.

### Logs

Two tables, answering two different support questions.

| Table | Question it answers |
|---|---|
| `payment_transactions` | *"Did they pay?"* — one row per attempt, with its final state. |
| `payment_logs` | *"Then why didn't it work?"* — every request sent, answer received, callback posted and failure in between, in order. |

Payloads are stored with the payer's phone, email and name **masked**
(`lib/payments/redact.ts`): a log that support reads must not be a second,
unencrypted copy of the personal data the transaction row carefully encrypts.
`+250780000000` becomes `+2507*****000` — enough for the customer on the phone
to confirm it was theirs, not enough to reuse.

Read them at **Platform console → Payment gateway**, or per-workspace at
`GET /api/payments/transactions/:referenceId/logs`.

### Settling by hand

For the case the gateway cannot resolve itself — a transfer that arrived in the
bank, a callback that never came. **Payment gateway → open a payment → Mark as
paid**, with a note. It goes through the same `applyPaymentResult` path as a
real callback, so it activates the subscription identically, and it is written
to the log with the note attached, because a payment marked paid by a person
rather than by a gateway is exactly what an audit asks about.

---

## API surface

### Public

| Route | Purpose |
|---|---|
| `GET /api/subscription/plans` | The live catalogue the signup and pricing pages read |
| `GET /api/subscription/payment-methods` | Methods, and whether each needs a phone number |
| `POST /api/payments/callback/lmbtech` | The gateway's callback |
| `GET /api/payments/return/lmbtech` | Where a card payer is returned |

### A workspace's own

| Route | Purpose |
|---|---|
| `GET /api/subscription/entitlements` | Features, ceilings and usage — loaded once per session by `AuthContext` |
| `GET /api/subscription/usage` | Just the capacity table; cheap to re-read after a create |
| `GET /api/subscription/current` | The current subscription and its plan |
| `POST /api/subscription/checkout` | Pay, renew, or upgrade |
| `GET /api/payments/status/:referenceId` | Polled while a prompt is on the customer's phone |
| `GET /api/payments/transactions` | Payment history |

### Platform console

| Route | Purpose |
|---|---|
| `GET/POST /api/platform/plans`, `PATCH/DELETE /api/platform/plans/:code` | The plan editor |
| `GET /api/platform/plans/capacity-keys` | The capacities the server actually counts |
| `GET/POST /api/platform/organizations` | Every workspace; create one from the console |
| `PATCH /api/platform/organizations/:id` | Suspend, reinstate, rename, move plan |
| `PUT/DELETE /api/platform/organizations/:id/limits/:key` | Per-workspace ceiling overrides |
| `GET /api/platform/payments`, `/payment-logs`, `/overview` | The ledger, the trail, the dashboard |
| `POST /api/platform/payments/:ref/refresh`, `/reconcile` | Re-ask the gateway; settle by hand |

A plan cannot be deleted while a workspace is subscribed to it — deleting would
take its ceilings with it, and a workspace with no ceilings resolves to
*unlimited*. Deactivating is the operation an operator actually wants: it clears
the plan off the pricing page while everyone on it keeps what they bought.

---

## Checking it works

```bash
# Unit + integration (integration needs a migrated MySQL)
cd backend && npm test && npm run test:integration

# End to end against a running API: signup → MoMo → callback → seat ceiling
cd backend && npm run dev          # in one terminal
cd backend && npm run smoke:subscription   # plans, limits, gateway, logs
cd backend && npm run smoke:onboarding     # signup -> plan -> pay -> expiry -> renewal
cd backend && npm run smoke:rails          # OTP, trial, MTN + Airtel + card, callback shapes
```

`smoke_subscription_flow.ts` walks the real customer path and asserts the parts
that are easy to break and hard to notice: that the workspace does **not** open
until the gateway confirms, that the callback opens it, that the payer's number
is masked in the logs, and that the plan's seat ceiling is refused by the
server rather than merely hidden by the browser.
