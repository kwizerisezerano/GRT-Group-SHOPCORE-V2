# Running ShopCore Locally

Verified working on 2026-08-04. Node 22.22.2, MySQL 8.0.46, npm 10.9.7.

---

## 1. Database

The README assumes XAMPP. On a plain Linux box, install MySQL 8 directly:

```bash
sudo apt-get install -y mysql-server
sudo mysqld_safe --user=mysql &
```

**Important:** Ubuntu's MySQL configures the `root` user with `auth_socket`, so
`root` works from the `mysql` CLI but **cannot connect over TCP**. Prisma connects over
TCP, so the `DATABASE_URL` in `.env.example`
(`mysql://root@127.0.0.1:3306/shopcore_v2`) fails with
`Access denied for user 'root'@'localhost'`.

Create a dedicated user instead:

```sql
CREATE DATABASE IF NOT EXISTS shopcore_v2
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'shopcore'@'%' IDENTIFIED BY 'shopcore_dev_pw';
GRANT ALL PRIVILEGES ON shopcore_v2.* TO 'shopcore'@'%';
-- Prisma needs a shadow database for `migrate dev`:
GRANT CREATE, DROP, ALTER, REFERENCES ON *.* TO 'shopcore'@'%';
FLUSH PRIVILEGES;
```

---

## 2. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:

```ini
DATABASE_URL="mysql://shopcore:shopcore_dev_pw@127.0.0.1:3306/shopcore_v2"
JWT_ACCESS_SECRET="<openssl rand -hex 32>"
JWT_REFRESH_SECRET="<openssl rand -hex 32>"
RESEND_API_KEY=""   # empty => reset links are logged to the console
```

`src/config/env.ts` validates this with Zod and exits on boot if anything is
missing, so a bad `.env` fails loudly rather than at first request.

```bash
npx prisma generate
npx prisma migrate deploy   # creates 36 tables
npx prisma db seed          # 4 subscription plans + 4 payment methods
npm run dev                 # http://127.0.0.1:4000
```

Swagger UI: <http://127.0.0.1:4000/api/docs> — currently documents 12 endpoints.

---

## 3. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```ini
VITE_ENCRYPTION_KEY="local-dev-encryption-key-not-for-production"
```

Leave the `VITE_SUPABASE_*` vars unset. `integrations/supabase/client.ts` falls back to
`https://placeholder.invalid` and logs a warning rather than crashing at import, so the
app boots fine — but any page still calling `supabase.from(...)` will fail at request
time. That is the migration surface tracked in `docs/AUDIT-2026-08-04.md`.

```bash
npm run dev                 # http://127.0.0.1:5173
```

Vite proxies `/api` → `127.0.0.1:4000`, so no `VITE_API_URL` is needed in browser dev.

---

## 4. Verifying the stack

```bash
curl http://127.0.0.1:4000/api/health
# {"status":"ok"}

# Through the Vite proxy — confirms frontend -> backend -> MySQL
curl http://127.0.0.1:5173/api/workspace/plans

curl -X POST http://127.0.0.1:5173/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@shopcore.local","password":"DemoPass123",
       "displayName":"Demo Owner","businessName":"Demo Retail Ltd",
       "planCode":"starter","billingCycle":"monthly","language":"en"}'
```

Verified behaviour:

| Case | Result |
|---|---|
| Signup | 201, returns user + tenantId + token pair |
| Duplicate signup | 409 `{"error":{"code":"conflict",...}}` |
| Login | 200 with access + refresh tokens |
| `GET /auth/me` with token | 200 with user, tenant, role, subscription |
| Wrong password | 401 `Invalid email or password` |
| Malformed body | 400 `validation_error` with per-field details |
| No bearer token | 401 `Missing bearer token` |

One signup writes a consistent row set across `users`, `profiles`, `tenants`,
`tenant_members`, `user_roles`, and `tenant_subscriptions` — no orphans.

---

## 5. Routes

There is no `/login` route. Auth lives at:

- `/auth` — login
- `/signup` — registration
- `/reset-password`
- `/pricing`, `/modules`, `/security` — public marketing
- `/platform-admin` — platform console

---

## 6. Known local-environment noise

- **Google Fonts blocked.** `index.css` imports Inter from `fonts.googleapis.com`. Where
  egress is restricted the request fails and the UI falls back to system fonts. Cosmetic.
- **Pricing plans fail to load on the landing page.** `PricingWorkspace.tsx` fetches from
  Supabase, not the backend — so it fails without Supabase credentials, even though
  `/api/workspace/plans` serves that exact data correctly. A good first migration target.
- **Docker Hub may be unreachable** behind a policy proxy
  (`production.cloudfront.docker.com` 403), so a containerised MySQL is not always an
  option. The apt route above avoids this.

---

## 7. Encryption keys (added 2026-08-04)

`backend/.env` now requires two 32-byte keys. The server refuses to boot without
them — there is deliberately no fallback, because booting with a default key would
silently write data that cannot be decrypted later.

```bash
openssl rand -hex 32   # -> ENCRYPTION_KEY
openssl rand -hex 32   # -> BLIND_INDEX_KEY
```

They must be different values. **Back them up with the database**: the encrypted
columns are unreadable without `ENCRYPTION_KEY`, and every lookup hash must be
recomputed if `BLIND_INDEX_KEY` changes.

If you already had a local database from before this change, reset it — the
migration drops the plaintext columns and cannot backfill the encrypted ones
(encryption happens in the application, not in SQL):

```bash
mysql -uroot -e "DROP DATABASE shopcore_v2; CREATE DATABASE shopcore_v2
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
cd backend && npx prisma migrate deploy && npx prisma db seed
```

Run the backend test suite with `npm test` (25 crypto tests).

---

## 8. One-command bring-up

`scripts/dev-up.sh` does everything in sections 1-3 and is idempotent, so it is
also how you recover after a restart:

```bash
./scripts/dev-up.sh            # start MySQL, migrate, seed, run both servers
./scripts/dev-up.sh --reset    # drop and recreate the database first
```

It generates `backend/.env` with fresh secrets on first run and skips whatever
is already healthy. Logs land in `/tmp/shopcore-dev/`.

---

## 9. Seeing changes in the browser

The pricing catalogue on `/pricing` and the signup flow now read from the
backend, so with the stack up you can watch the full path work:

| What to do | What proves it |
|---|---|
| Open `/pricing` | Four plans render from MySQL via `/api/workspace/plans` — no Supabase involved |
| Sign up at `/signup` | 201 with a backend-authored success message |
| Sign up twice | 409 "An account with this email already exists." — the message shown is the backend's |
| Switch language, then trigger an error | The message changes language; the API translates it, the frontend just displays it |
| Watch `/tmp/shopcore-dev/backend.log` during signup | Welcome and subscription emails render in the signup language |

Emails are printed to the backend log rather than sent while `RESEND_API_KEY`
is empty, so the whole notification path is exercised locally with no provider
account and no risk of mailing a real person from a dev database.

---

## 10. Login or registration failing? Run the doctor first

```bash
cd backend && npm run doctor
```

It checks the whole chain — env completeness, key validity, database
reachability, migration state, seeded plans, and whether any account predates
the encryption migration — and prints the exact command to fix whatever it
finds. Use it before reading logs.

**The most common cause by far:** a `backend/.env` written before
`ENCRYPTION_KEY` and `BLIND_INDEX_KEY` existed. Those are required with no
fallback, so the server **exits at boot**. The API then answers nothing at all,
and the browser reports login as a failed/CORS request with no status code —
which looks like a frontend bug but is a backend that never started.

`./scripts/dev-up.sh` now backfills missing secrets into an existing `.env`. It
will never overwrite one that already has a value: `ENCRYPTION_KEY` is what
every encrypted column was written with, so replacing it would turn readable
data into ciphertext nobody can open. A key that is present but malformed is
reported by the doctor for a human to decide about.

**Second most common:** accounts created before the encryption migration. Login
looks a user up by their email blind index, and those rows have none, so no
password will ever match. The doctor counts them. In development:

```bash
./scripts/dev-up.sh --reset     # drop, recreate, migrate, seed
```

**Third:** a stale frontend bundle. Vite caches aggressively, so a pull can
leave the old code running:

```bash
rm -rf frontend/node_modules/.vite && ./scripts/dev-up.sh
```

---

## 11. Windows (PowerShell)

`dev-up.sh` is bash. On Windows use the PowerShell version:

```powershell
.\scripts\dev-up.ps1
.\scripts\dev-up.ps1 -Reset     # drop and recreate the database first
```

It finds XAMPP's MySQL automatically, creates the database, repairs `.env`,
migrates, seeds, and opens the backend and frontend each in their own window —
leave both open.

**Windows PowerShell 5.1 does not support `&&`.** This fails:

```powershell
cd backend && npm run doctor      # The token '&&' is not a valid statement separator
```

Use two statements, or `;`:

```powershell
cd backend
npm run doctor
```

**Running the two servers by hand** needs two terminals. One is not enough —
the frontend dev server does not start the backend, it only proxies to it:

```powershell
# terminal 1
cd backend
npm run dev        # must stay running, listens on :4000

# terminal 2
cd frontend
npm run dev        # :5173, proxies /api to :4000
```

`ECONNREFUSED 127.0.0.1:4000` in the frontend terminal means terminal 1 is not
running, or its server exited. Check that window: if it exited at startup,
`npm run doctor` in `backend/` will say why.

---

## 12. XAMPP is MariaDB, not MySQL

The XAMPP control panel labels it "MySQL", but the server underneath is
MariaDB. Both are supported — the migrations and seed are verified against
**MySQL 8.0.46** and **MariaDB 10.11**, all 36 tables and 4 migrations, on
both. `npm run doctor` prints which one you actually have.

### `P1017: Server has closed the connection`

The database dropped the connection partway through a migration. It is not a
SQL problem — the same migrations apply cleanly to both engines. Look at
XAMPP's own log:

```
C:\xampp\mysql\data\mysql_error.log
```

A crash or restart around the timestamp confirms it.

### `P3009: migrate found failed migrations`

The knock-on effect of the above, and the more confusing of the two: the
*first* run failed partway and left a failed row in `_prisma_migrations`, so
every later run refuses before doing anything. The second error is caused by
the first.

`dev-up.ps1` now detects this, explains it, and offers to rebuild. Or do it
yourself:

```powershell
.\scripts\dev-up.ps1 -Reset
```

`npm run doctor` also reports it by name, with the migration that is stuck.

Or clear it yourself with Prisma's own command — no script involved. It drops,
re-migrates and re-seeds in one step:

```powershell
cd backend
npx prisma migrate reset --force
```

---

## 13. The till says "Offline" but everything is running

The POS screen shows a **Mode** tile reading Online or Offline, and it decides
where a completed sale goes: to the API, or into a local queue to be synced
later. A sale in that queue is not in the database, so this is worth knowing
how to read.

Two things put it in Offline:

| Signal | Where it lives | Set by |
|---|---|---|
| `shopcore_offline_mode` | localStorage | An explicit choice. Cleared on every login. |
| `shopcore_network_state` | localStorage | The API client, on a request that could not reach the backend. Self-clears after 15s. |

Check both in the browser console:

```js
localStorage.getItem("shopcore_offline_mode")   // null when online
localStorage.getItem("shopcore_network_state")  // {"reachable":true,...}
```

Only `lib/apiClient.ts` may set the second one, and only when `fetch` itself
rejects — a 4xx or 5xx means the backend answered, so the app stays online.

This used to be inferred much more loosely: `isNetworkError()` in
`lib/offlineStore.ts` marked the whole app unreachable whenever it was *asked*
whether an error was a network error. While the migration off Supabase is
still in progress that was actively wrong — a leftover call to the
unconfigured `placeholder.invalid` host fails on every load of the till, so
the POS believed it was offline and queued every sale locally while the
backend was up and answering. Fixed, with a regression test in
`frontend/src/lib/offlineStore.test.ts`.

---

## 14. How offline sales get back

A till that works disconnected has one hard problem, and it is not storage.
It is that **a request which times out is indistinguishable from a request
that succeeded and lost its reply.** Retry and you risk a duplicate sale;
don't retry and you risk losing one. For a record that is money and stock,
neither is acceptable.

ShopCore settles it with an idempotency key.

```
POST /api/sales  { ..., "client_request_id": "<uuid>" }
```

The till picks the key **once, when the sale is first attempted**, and reuses
it for every retry of that same sale. Crucially it is chosen in `completeSale`
*before* the online/offline decision, so a checkout that fails and gets queued
offline carries the same key when it finally syncs.

`sales.client_request_id` is unique per tenant, so:

| Attempt | Server does | Answers |
|---|---|---|
| First | Records the sale | `201` + the sale |
| Any retry | Nothing | `200` + *the same sale* |

200 rather than 201 is the signal that nothing was created. The message is
"This sale was already recorded. Returning the original receipt.", translated
like every other.

The read-before-write check in the handler is only a fast path. The guarantee
is the unique index — the integration suite passes with the fast path disabled,
which is how we know. That matters because the previous sync engine guarded
duplicates by reading back an invoice number first, and check-then-act loses
races: two replays can both read "not found" and both insert.

### Offline sales may drive stock negative

An offline sale already happened — the customer left with the goods on a till
that could not ask the server anything. By the time it replays, refusing it to
protect a stock count would leave the shop with goods gone, no record of the
money, and a number that is wrong anyway. So `"offline": true` permits negative
stock, and negative stock is the shop being told its count disagrees with what
left the shelves. A stock take resolves that; silence does not.

Online sales get no such licence: there the server is present to refuse before
the goods move.

### What sync does with a sale it cannot replay

`syncOfflineData.ts` distinguishes two failures that look alike:

- **Could not reach the server** — nothing is wrong with the sale. It stays
  queued and the run stops, because the rest of the queue will hit the same
  wall.
- **The server answered and refused** — retrying will fail identically forever,
  so the sale is quarantined with the server's own explanation rather than
  spinning in a hot loop. Read them with `getQuarantinedOfflineRecords()`.

Sales carrying a refund taken offline are quarantined too: there is no refunds
endpoint yet, and syncing the sale while dropping its refund would overstate
takings and understate stock.

### Seeing it work

`scripts/` has no canned demo for this, but the whole path is four curl calls —
send a checkout with a `client_request_id`, then send it again. The second
answers 200 with the first sale's id, and `SELECT COUNT(*) FROM sales WHERE
client_request_id = '…'` stays at 1.

---

## 15. Switching between online and offline

The app is **online by default** and drops to offline only on evidence. It
switches back and drains its queue on its own; nobody presses anything.

`frontend/src/lib/connectivity.ts` owns the decision.

### Why it does not just use the browser

`navigator.onLine` and the `online`/`offline` events describe the *network
interface*, not the internet. A till on a shop's wifi with the line down is
reported online and always has been — which is the ordinary case here, not an
edge case. So "online" is defined as **the API answered**:

```
GET /api/health   → unauthenticated, touches no database
```

Browser events are still used as hints. `offline` is conclusive and applies
immediately; `online` only means it is worth probing again right now.

### The rules

| | |
|---|---|
| Going offline | Two consecutive failures. One dropped request happens on a healthy network, and queueing sales over it is worse than a moment's delay. |
| Coming back | One success. A shop should be recording normally again as soon as it can, and a false positive self-corrects on the next request. |
| Idle heartbeat | 15s online, 5s→15s (backing off) offline. |
| Confirming a failure | ~1s — a suspected failure is settled quickly, not at the next heartbeat. |
| Real traffic | Every API call reports its own outcome, so an active till notices **instantly**. The heartbeat only covers an idle screen. |
| Hidden tab | Polling stops; state is re-established on return. |

Measured in a browser with the API blocked at the network layer and
`navigator.onLine` still `true`: offline within ~16s idle, back online and
synced within ~6s of the connection returning.

### What auto-syncs

On the offline→online transition the queue replays automatically after a 2s
settle. Working today:

- **sales** — through `POST /api/sales`, idempotent (section 14)
- **products, categories, brands, customers, suppliers, expenses** — through
  their CRUD endpoints

- **purchases** — through `POST /api/purchases`, idempotent on the same key
- **units** — through its CRUD endpoints

Everything else (stock adjustments, transfers, quotations, loyalty, staff, EBM
settings, workspace, branches, warehouses, stock counts) still syncs through
Supabase, so it queues offline and **cannot come back yet**. Each follows its
own backend module; `API_BACKED_TABLES` in `syncOfflineData.ts` is the list for
plain CRUD, and transactional modules (sales, purchases) get their own replay
function beside it.

### Checking the state by hand

```js
localStorage.getItem("shopcore_network_state")   // {"reachable":true,...}

// Watch it switch:
addEventListener("shopcore-connectivity-changed", (e) => console.log(e.detail));
```

Two earlier bugs are worth knowing about, because both made the switch look
like it worked when it did not:

- The monitor used to read its own previous state back from `isOnline()`, which
  treats a failure older than 15s as stale and reports online again by itself.
  A connection returning after a long outage therefore found the previous state
  already "online", emitted no transition, and never triggered the sync. The
  monitor now holds its own state.
- Reporting and the timer loop both scheduled the next check, so the fast
  confirmation retry was immediately overwritten by the idle cadence and an
  outage took a full interval to confirm.
