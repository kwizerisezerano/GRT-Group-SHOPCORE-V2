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
