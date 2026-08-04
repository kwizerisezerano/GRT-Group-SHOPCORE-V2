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
