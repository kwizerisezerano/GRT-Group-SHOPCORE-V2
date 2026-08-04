# ShopCore ERP

A modern, cloud-based Enterprise Resource Planning (ERP) and Point of Sale (POS) platform designed to help businesses efficiently manage sales, inventory, purchasing, customers, suppliers, finance, and business operations from a single, intuitive system.

Developed by **GlobalRwanda Technologies Group (GRT Group)**.

---

## Features

- Modern Point of Sale (POS)
- Inventory & Stock Management
- Multi-Branch & Multi-Tenant Support
- Customer Management
- Supplier Management
- Purchase Management
- Sales Management
- Expense Tracking
- Financial Reporting
- Advanced Dashboard & Analytics
- Platform Administration
- EBM Intergration
- Advanced Offline performance & Accessibility 
- User Workspace Communication/Chat
- Subscription & Billing Management
- User Roles & Permissions
- Dark & Light Themes
- Multi-language Support
  - English
  - French
  - Kinyarwanda
  - Kiswahili
- Responsive Web Application
- Desktop Deployment Support (Windows)

---

## Technology Stack

Built using modern web technologies:

**Frontend** (`frontend/`): React, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router, TanStack Query, Tauri (Desktop).

**Backend** (`backend/`): Node.js, Express, Prisma ORM, MySQL, JWT auth, Resend (transactional email). Replacing Supabase module-by-module - see `supabase/` below.

`supabase/` is kept temporarily: most modules (products, sales, POS, platform-admin, etc.) still read/write directly through `@supabase/supabase-js` while they're migrated one at a time onto the new backend. Auth/session/workspace-bootstrap have already moved to `backend/`.

**Database** (`database/`): Enterprise-grade MySQL 8.0+ schema with comprehensive indexing, audit trails, soft delete patterns, and performance monitoring.

---

# Getting Started

## Prerequisites

Before running the project, ensure you have installed:

- Node.js 20+
- npm
- Git
- MySQL 8.0+ (for database)

---

## Installation

Clone the repository:

```bash
git clone https://github.com/GRT-Group/shopcore-main.git
```

Navigate into the project:

```bash
cd shopcore-main
```

Install dependencies for each project (frontend and backend are independent npm projects):

```bash
cd frontend && npm install
cd ../backend && npm install
```

The backend needs a MySQL database. Copy `backend/.env.example` to `backend/.env` and point `DATABASE_URL` at it (defaults assume a local XAMPP MySQL install - root user, no password, port 3306), then run the migration and seed:

```bash
cd backend
npx prisma migrate deploy
npx prisma db seed
```

**Alternative: Direct MySQL Schema Migration**

For direct MySQL database setup using the enterprise-grade schema:

```bash
# Create database first
mysql -u root -p -e "CREATE DATABASE shopcore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Run the migration script
cd database
chmod +x run_migration.sh
./run_migration.sh
```

The MySQL schema includes:
- **Performance**: 40+ indexes, JSON indexing, full-text search
- **Security**: View-based row-level security, comprehensive audit trails
- **Resilience**: Soft delete patterns, backup procedures
- **Monitoring**: Built-in performance logging and metrics
- **Requirements**: MySQL 8.0+ (for native UUID, JSON indexes, CTEs)

For real transactional email (password reset), also set `RESEND_API_KEY`/`RESEND_FROM_EMAIL` in `backend/.env`; without it, reset links are logged to the server console instead of emailed.

---

## Running the Development Server

Start the backend API (from `backend/`):

```bash
npm run dev
```

It listens on `http://127.0.0.1:4000`. Interactive API docs (Swagger UI) are at `http://127.0.0.1:4000/api/docs`.

In a separate terminal, start the frontend (from `frontend/`):

```bash
npm run dev
```

Vite proxies `/api` requests to the backend automatically in dev. By default, the application is available at:

```
http://localhost:5173
```

If port **5173** is already in use, Vite will automatically select the next available port (for example `5174`, `3000`, or `3004`) and display the correct URL in the terminal.
---

## Building for Production

From `frontend/`:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

From `backend/`:

```bash
npm run build
npm start
```

---

## Environment Variables

**Frontend** (`frontend/.env`): copy `frontend/.env.example`. Includes the Supabase keys still used by not-yet-migrated pages, the client-side field-encryption key (`VITE_ENCRYPTION_KEY`), and `VITE_API_URL` for the new backend (leave unset in browser dev - Vite's proxy handles it; required for the Tauri build).

**Backend** (`backend/.env`): copy `backend/.env.example`. Holds server-only secrets - `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `RESEND_API_KEY`, etc. Never exposed to the browser.

> Never commit your production secrets or API keys to Git.

---

## Project Structure

```
frontend/            # React/Vite SPA (also the Tauri webview target)
  src/
    components/
    contexts/
    hooks/
    i18n/
    integrations/    # legacy Supabase client, used by not-yet-migrated pages
    layouts/
    lib/             # includes apiClient.ts, the new backend's HTTP client
    pages/
    services/
    utils/
    main.tsx
  public/
  scripts/            # i18n phrase extraction/translation tooling

backend/              # Node/Express + Prisma + MySQL API
  src/
    modules/          # auth/, workspace/ (more land as migration phases land)
    middleware/
    lib/              # jwt, password hashing, Resend email
  prisma/
    schema.prisma
    migrations/
    seed.ts

database/             # Enterprise-grade MySQL 8.0+ schema
  mysql_schema.sql    # Complete database schema with 10/10 rating
  run_migration.sh    # Single-command migration runner

src-tauri/            # Tauri desktop shell, wraps frontend/dist
supabase/             # legacy Postgres/Supabase migrations - kept until every
                       # module has moved to backend/
```

---

## Deployment

ShopCore can be deployed to any modern static hosting provider, including:

- Vercel
- Netlify
- Cloudflare Pages
- Azure Static Web Apps

For production deployments:

```bash
npm run build
```

Deploy the generated **dist/** directory.

---

## Desktop Application

ShopCore also supports Windows desktop deployment using **Tauri**, providing:

- Native Windows Installer
- Cached Data Access
- Offline Continuity
- Synchronization Workflows
- Automatic Updates (optional)

---

## Contributing

Contributions are welcome.

1. Fork the repository
2. Create a feature branch

```bash
git checkout -b feature/new-feature
```

3. Commit your changes

```bash
git commit -m "Add new feature"
```

4. Push the branch

```bash
git push origin feature/new-feature
```

5. Open a Pull Request

---

## License

Copyright © 2026 GLOBALRWANDA TECHNOLOGIES GROUP (GRT Group).

All rights reserved.
