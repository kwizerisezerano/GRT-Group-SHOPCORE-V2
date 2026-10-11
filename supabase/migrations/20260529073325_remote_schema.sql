-- ============================================================================
-- ShopCore — single-file database baseline (schema source of truth)
-- ============================================================================
-- This file replaces the previous incremental migration history
-- (20260529... through 20260729_set_profile_language_on_signup.sql), which
-- has been consolidated here and removed from the repo.
--
-- !!! DESTRUCTIVE !!!
-- This file starts with DROP TABLE ... CASCADE for every table in the
-- `public` schema. Running it against a database that has real data
-- (users, tenants, sales, etc.) PERMANENTLY DELETES that data. `auth.users`
-- is untouched by this file (it lives in Supabase's own `auth` schema), so
-- running this against a live project leaves existing logins orphaned with
-- no profile/tenant/subscription rows at all.
--
-- Only run this against a fresh/empty project, or a local `supabase start`
-- database, or after you have explicitly decided to wipe and rebuild.
--
-- KNOWN GAPS — these objects exist live in the original Supabase project
-- (created directly via the SQL editor / dashboard) and were never captured
-- in any tracked migration, so they are NOT included below. The app calls
-- them by name and will break without them:
--   - public.create_pending_workspace_for_user(...)  -- called from Signup.tsx
--   - public.is_platform_admin()                      -- called from Login.tsx
-- Before treating this file as a true "create from scratch" script, pull
-- the live definitions for these (e.g. `supabase db dump --linked`) and add
-- them here.
--
-- SECURITY NOTE: the previous 20260729_setup_super_admin.sql hardcoded a
-- real admin password in plaintext and inserted it directly into
-- auth.users. That has already been pushed to GitHub and must be treated
-- as compromised — rotate that account's password in the Supabase
-- dashboard regardless of this file. This baseline keeps the reusable
-- assign_super_admin_role() helper but deliberately drops the hardcoded
-- INSERT; create the super-admin account through normal signup or the
-- dashboard, then call assign_super_admin_role('their-email') once.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Reset (destructive — see warning above)
-- ----------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;

drop table if exists public.tenant_subscriptions cascade;
drop table if exists public.payment_methods cascade;
drop view if exists public.public_subscription_plan_catalog cascade;
drop table if exists public.public_subscription_plan_catalog cascade;
drop table if exists public.qa_audit_log cascade;
drop table if exists public.qa_isolation_leaks cascade;
drop table if exists public.qa_screenshots cascade;
drop table if exists public.qa_runs cascade;
drop table if exists public.qa_filter_presets cascade;
drop table if exists public.qa_settings cascade;
drop table if exists public.stock_movements cascade;
drop table if exists public.expired_products cascade;
drop table if exists public.expenses cascade;
drop table if exists public.credited_items cascade;
drop table if exists public.sale_items cascade;
drop table if exists public.sales cascade;
drop table if exists public.purchase_items cascade;
drop table if exists public.purchases cascade;
drop table if exists public.products cascade;
drop table if exists public.customers cascade;
drop table if exists public.suppliers cascade;
drop table if exists public.categories cascade;
drop table if exists public.brands cascade;
drop table if exists public.staff cascade;
drop table if exists public.user_roles cascade;
drop table if exists public.tenant_members cascade;
drop table if exists public.workspace_members cascade;
drop table if exists public.workspaces cascade;
drop table if exists public.profiles cascade;
drop table if exists public.tenants cascade;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.rls_auto_enable() cascade;
drop function if exists public.validate_and_update_profile(uuid, text, text, text) cascade;
drop function if exists public.update_payment_methods_updated_at() cascade;
drop function if exists public.update_tenant_subscriptions_updated_at() cascade;
drop function if exists public.approve_subscription(uuid, uuid) cascade;
drop function if exists public.reject_subscription(uuid, uuid, text) cascade;
drop function if exists public.assign_super_admin_role(text) cascade;

-- ----------------------------------------------------------------------------
-- 1. Tables
-- ----------------------------------------------------------------------------

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text,
  logo_url text,
  brand_color text default '#2563eb'::text,
  contact_email text,
  owner_id uuid,
  created_at timestamp with time zone default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamp without time zone default now()
);

-- NOTE: profiles.language and profiles.updated_at were introduced after the
-- original dump. `updated_at` is required by validate_and_update_profile()
-- below, which referenced it without the column ever having been added —
-- that RPC could not have worked until now.
create table public.profiles (
  id uuid primary key,
  tenant_id uuid,
  plan_id uuid,
  display_name text,                -- AES-encrypted client-side before storage
  phone text,                       -- AES-encrypted client-side before storage
  avatar_url text,
  language text not null default 'en',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint profiles_language_check check (language in ('en', 'fr', 'rw', 'sw'))
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  workspace_id uuid,
  role text default 'owner'::text,
  created_at timestamp without time zone default now(),
  constraint workspace_members_user_id_workspace_id_key unique (user_id, workspace_id)
);

create table public.tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  user_id uuid,
  role text default 'member'::text,
  is_default boolean default true,
  created_at timestamp with time zone default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  tenant_id uuid,
  role text not null,
  created_at timestamp with time zone default now()
);

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  profile_id uuid,
  position text,
  salary numeric default 0,
  created_at timestamp with time zone default now()
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  name text not null,
  created_at timestamp with time zone default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  name text not null,
  description text,
  created_at timestamp with time zone default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  name text not null,
  phone text,
  email text,
  address text,
  user_id uuid,
  created_at timestamp with time zone default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  user_id uuid,
  name text not null,
  phone text,
  email text,
  address text,
  total_spent numeric default 0,
  loyalty_points integer default 0,
  status text default 'active'::text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  category_id uuid,
  brand_id uuid,
  supplier_id uuid,
  user_id uuid,
  name text not null,
  barcode text,
  sku text,
  category text,
  category_name text,
  brand text,
  description text,
  unit text default 'pcs'::text,
  status text default 'active'::text,
  cost_price numeric default 0,
  selling_price numeric default 0,
  stock integer default 0,
  min_stock integer default 0,
  stock_quantity integer default 0,
  min_stock_level integer default 5,
  tax_rate numeric default 0,
  image_url text,
  expiry_date date,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  supplier_id uuid,
  user_id uuid,
  supplier_name text,
  purchase_no text,
  status text default 'completed'::text,
  payment_status text default 'paid'::text,
  subtotal numeric default 0,
  tax numeric default 0,
  discount numeric default 0,
  total numeric default 0,
  notes text,
  purchase_date timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  purchase_id uuid,
  product_id uuid,
  product_name text,
  sku text,
  quantity integer default 1,
  unit_cost numeric default 0,
  subtotal numeric default 0,
  created_at timestamp with time zone default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  user_id uuid,
  invoice_no text not null,
  sale_no text,
  customer_name text,
  items integer default 0,
  subtotal numeric default 0,
  tax numeric default 0,
  discount numeric default 0,
  total numeric default 0,
  paid numeric default 0,
  due numeric default 0,
  payment_method text,
  status text default 'completed'::text,
  branch text,
  cashier text,
  notes text,
  date timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  sale_id uuid,
  product_id uuid,
  product_name text not null,
  sku text,
  quantity integer not null default 1,
  unit_price numeric not null default 0,
  discount numeric not null default 0,
  tax numeric not null default 0,
  subtotal numeric not null default 0,
  total numeric default 0,
  created_at timestamp with time zone default now()
);

create table public.credited_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  customer_id uuid,
  sale_id uuid,
  product_id uuid,
  quantity integer not null default 1,
  unit_price numeric not null default 0,
  total numeric not null default 0,
  amount_paid numeric default 0,
  remaining_balance numeric default 0,
  due_date timestamp with time zone,
  status text default 'pending'::text,
  notes text,
  created_at timestamp with time zone default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  user_id uuid,
  title text not null,
  amount numeric not null default 0,
  category text,
  notes text,
  created_at timestamp with time zone default now()
);

create table public.expired_products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  product_id uuid,
  quantity integer not null default 0,
  expiry_date date,
  status text default 'expired'::text,
  disposal_method text,
  notes text,
  created_at timestamp with time zone default now()
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  product_id text,
  product_name text,
  movement_type text not null,
  quantity_change integer not null,
  stock_before integer,
  stock_after integer,
  reference text,
  reference_id text,
  notes text,
  created_at timestamp with time zone default now()
);

create table public.qa_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  auto_capture boolean default false,
  screenshot_retention_days integer default 30,
  isolation_enabled boolean default true,
  webhook_url text,
  webhook_enabled boolean default false,
  capture_screenshots boolean default true,
  diff_threshold numeric default 0.1,
  created_at timestamp with time zone default now()
);

create table public.qa_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  created_by uuid,
  status text default 'pending'::text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone default now()
);

create table public.qa_screenshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  qa_run_id uuid,
  created_by uuid,
  image_url text not null,
  label text,
  created_at timestamp with time zone default now()
);

create table public.qa_filter_presets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  created_by uuid,
  user_id uuid,
  name text not null,
  filters jsonb default '{}'::jsonb,
  action text,
  filter_user text,
  from_date timestamp without time zone,
  to_date timestamp without time zone,
  search text,
  created_at timestamp with time zone default now()
);

create table public.qa_isolation_leaks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  detected_by uuid,
  run_id uuid,
  table_name text,
  row_id uuid,
  expected_tenant uuid,
  actual_tenant uuid,
  description text,
  severity text default 'low'::text,
  resolved boolean default false,
  context jsonb,
  created_at timestamp with time zone default now()
);

create table public.qa_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  user_id uuid,
  action text not null,
  entity text,
  entity_id uuid,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

create table public.public_subscription_plan_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  short_description text,
  currency text default 'RWF',
  monthly_price numeric not null,
  six_month_price numeric not null,
  yearly_price numeric not null,
  six_month_discount integer default 8,
  yearly_discount integer default 15,
  is_popular boolean default false,
  display_order integer not null,
  badge_text text,
  button_label text,
  prices jsonb not null default '[]'::jsonb,
  features jsonb not null default '[]'::jsonb,
  limits jsonb not null default '[]'::jsonb,
  is_active boolean default true,
  is_public boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  provider text,
  is_active boolean default true,
  display_order integer default 0,
  supports_recurring boolean default false,
  supports_one_time boolean default true,
  currency text default 'RWF',
  config jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table public.tenant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid not null,
  plan_id uuid not null,
  billing_cycle text not null, -- 'monthly', 'six_months', 'annual'
  billing_months integer not null,
  subscription_amount numeric not null,
  subscription_currency text default 'RWF',
  subscription_discount_percent integer default 0,
  payment_method_id uuid,
  subscription_status text not null default 'pending_approval',
  payment_status text not null default 'unpaid',
  approval_status text default 'pending',
  requested_by uuid,
  requested_at timestamp with time zone default now(),
  approved_by uuid,
  approved_at timestamp with time zone,
  rejection_reason text,
  activated_at timestamp with time zone,
  expires_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint valid_subscription_status check (subscription_status in ('pending_approval', 'approved', 'active', 'suspended', 'cancelled')),
  constraint valid_payment_status check (payment_status in ('unpaid', 'pending_payment', 'paid', 'failed')),
  constraint valid_approval_status check (approval_status in ('pending', 'approved', 'rejected'))
);

-- ----------------------------------------------------------------------------
-- 2. Foreign keys
-- ----------------------------------------------------------------------------

alter table public.profiles add constraint profiles_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;
alter table public.profiles add constraint profiles_plan_id_fkey foreign key (plan_id) references public.public_subscription_plan_catalog(id);

alter table public.workspace_members add constraint workspace_members_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.workspace_members add constraint workspace_members_workspace_id_fkey foreign key (workspace_id) references public.workspaces(id) on delete cascade;

alter table public.tenant_members add constraint tenant_members_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;
alter table public.tenant_members add constraint tenant_members_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.user_roles add constraint user_roles_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.staff add constraint staff_tenant_id_fkey foreign key (tenant_id) references public.tenants(id);
alter table public.staff add constraint staff_profile_id_fkey foreign key (profile_id) references public.profiles(id);

alter table public.suppliers add constraint suppliers_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;

alter table public.customers add constraint customers_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;

alter table public.purchases add constraint purchases_tenant_id_fkey foreign key (tenant_id) references public.tenants(id);
alter table public.purchases add constraint purchases_supplier_id_fkey foreign key (supplier_id) references public.suppliers(id);

alter table public.purchase_items add constraint purchase_items_purchase_id_fkey foreign key (purchase_id) references public.purchases(id) on delete cascade;
alter table public.purchase_items add constraint purchase_items_product_id_fkey foreign key (product_id) references public.products(id);

alter table public.sale_items add constraint sale_items_sale_id_fkey foreign key (sale_id) references public.sales(id) on delete cascade;
alter table public.sale_items add constraint sale_items_product_id_fkey foreign key (product_id) references public.products(id);

alter table public.credited_items add constraint credited_items_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;
alter table public.credited_items add constraint credited_items_customer_id_fkey foreign key (customer_id) references public.customers(id);
alter table public.credited_items add constraint credited_items_sale_id_fkey foreign key (sale_id) references public.sales(id);
alter table public.credited_items add constraint credited_items_product_id_fkey foreign key (product_id) references public.products(id);

alter table public.expenses add constraint expenses_tenant_id_fkey foreign key (tenant_id) references public.tenants(id);

alter table public.expired_products add constraint expired_products_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;
alter table public.expired_products add constraint expired_products_product_id_fkey foreign key (product_id) references public.products(id);

alter table public.qa_settings add constraint qa_settings_tenant_id_fkey foreign key (tenant_id) references public.tenants(id);

alter table public.qa_runs add constraint qa_runs_tenant_id_fkey foreign key (tenant_id) references public.tenants(id);
alter table public.qa_runs add constraint qa_runs_created_by_fkey foreign key (created_by) references public.profiles(id);

alter table public.qa_screenshots add constraint qa_screenshots_tenant_id_fkey foreign key (tenant_id) references public.tenants(id);
alter table public.qa_screenshots add constraint qa_screenshots_qa_run_id_fkey foreign key (qa_run_id) references public.qa_runs(id) on delete cascade;
alter table public.qa_screenshots add constraint qa_screenshots_created_by_fkey foreign key (created_by) references public.profiles(id);

alter table public.qa_filter_presets add constraint qa_filter_presets_tenant_id_fkey foreign key (tenant_id) references public.tenants(id);
alter table public.qa_filter_presets add constraint qa_filter_presets_created_by_fkey foreign key (created_by) references public.profiles(id);

alter table public.qa_isolation_leaks add constraint qa_isolation_leaks_tenant_id_fkey foreign key (tenant_id) references public.tenants(id);
alter table public.qa_isolation_leaks add constraint qa_isolation_leaks_detected_by_fkey foreign key (detected_by) references public.profiles(id);

alter table public.qa_audit_log add constraint qa_audit_log_tenant_id_fkey foreign key (tenant_id) references public.tenants(id);
alter table public.qa_audit_log add constraint qa_audit_log_user_id_fkey foreign key (user_id) references public.profiles(id);

alter table public.tenant_subscriptions add constraint tenant_subscriptions_tenant_id_fkey foreign key (tenant_id) references public.tenants(id) on delete cascade;
alter table public.tenant_subscriptions add constraint tenant_subscriptions_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.tenant_subscriptions add constraint tenant_subscriptions_plan_id_fkey foreign key (plan_id) references public.public_subscription_plan_catalog(id);
alter table public.tenant_subscriptions add constraint tenant_subscriptions_payment_method_id_fkey foreign key (payment_method_id) references public.payment_methods(id);
alter table public.tenant_subscriptions add constraint tenant_subscriptions_requested_by_fkey foreign key (requested_by) references auth.users(id);
alter table public.tenant_subscriptions add constraint tenant_subscriptions_approved_by_fkey foreign key (approved_by) references auth.users(id);

-- ----------------------------------------------------------------------------
-- 3. Indexes (beyond the primary keys created inline above)
-- ----------------------------------------------------------------------------

create index idx_tenant_subscriptions_tenant_id on public.tenant_subscriptions(tenant_id);
create index idx_tenant_subscriptions_user_id on public.tenant_subscriptions(user_id);
create index idx_tenant_subscriptions_status on public.tenant_subscriptions(subscription_status);
create index idx_tenant_subscriptions_approval_status on public.tenant_subscriptions(approval_status);

-- ----------------------------------------------------------------------------
-- 4. Row Level Security
-- ----------------------------------------------------------------------------
-- NOTE (faithfully preserved from the original schema, not something this
-- consolidation changed): `tenants` and `tenant_members` have RLS left
-- disabled. Also, `brands`, `categories`, `credited_items`,
-- `expired_products`, `staff`, `stock_movements`, `workspace_members`,
-- `workspaces`, and every `qa_*` table have RLS ENABLED but have ZERO
-- policies defined anywhere in the original migration history — with RLS
-- on and no policies, those tables default-deny all access to non-service
-- roles. If features touching those tables (staff, QA tooling, stock
-- movement history) appear broken/empty in the app, this is why. Worth a
-- follow-up pass once the app's actual tenant-isolation policy is decided.

alter table public.brands enable row level security;
alter table public.categories enable row level security;
alter table public.credited_items enable row level security;
alter table public.customers enable row level security;
alter table public.expenses enable row level security;
alter table public.expired_products enable row level security;
alter table public.products enable row level security;
alter table public.profiles enable row level security;
alter table public.purchase_items enable row level security;
alter table public.purchases enable row level security;
alter table public.qa_audit_log enable row level security;
alter table public.qa_filter_presets enable row level security;
alter table public.qa_isolation_leaks enable row level security;
alter table public.qa_runs enable row level security;
alter table public.qa_screenshots enable row level security;
alter table public.qa_settings enable row level security;
alter table public.sale_items enable row level security;
alter table public.sales enable row level security;
alter table public.staff enable row level security;
alter table public.stock_movements enable row level security;
alter table public.suppliers enable row level security;
alter table public.user_roles enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspaces enable row level security;
alter table public.public_subscription_plan_catalog enable row level security;
alter table public.payment_methods enable row level security;
alter table public.tenant_subscriptions enable row level security;

create policy "Allow authenticated access customers" on public.customers for all to authenticated using (true) with check (true);
create policy "Allow authenticated access expenses" on public.expenses for all to authenticated using (true) with check (true);
create policy "Allow authenticated access products" on public.products for all to authenticated using (true) with check (true);
create policy "Allow authenticated access purchase_items" on public.purchase_items for all to authenticated using (true) with check (true);
create policy "Allow authenticated access purchases" on public.purchases for all to authenticated using (true) with check (true);
create policy "Allow authenticated access sale_items" on public.sale_items for all to authenticated using (true) with check (true);
create policy "Allow authenticated access sales" on public.sales for all to authenticated using (true) with check (true);
create policy "Allow authenticated access suppliers" on public.suppliers for all to authenticated using (true) with check (true);
create policy "Allow authenticated access user_roles" on public.user_roles for all to authenticated using (true) with check (true);

create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "Service role can insert profiles" on public.profiles for insert to service_role with check (true);
create policy "Service role can update profiles" on public.profiles for update to service_role using (true);

create policy "Allow public read access" on public.public_subscription_plan_catalog for select using (true);
create policy "Allow public read access" on public.payment_methods for select using (true);

create policy "Users can view their own subscriptions" on public.tenant_subscriptions
  for select using (auth.uid() = user_id);
create policy "Admins can view all subscriptions" on public.tenant_subscriptions
  for select using (
    exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin', 'super_admin'))
  );
create policy "Users can create subscription requests" on public.tenant_subscriptions
  for insert with check (auth.uid() = user_id);
create policy "Admins can approve subscriptions" on public.tenant_subscriptions
  for update using (
    exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin', 'super_admin'))
  );

-- ----------------------------------------------------------------------------
-- 5. Functions & triggers
-- ----------------------------------------------------------------------------

set check_function_bodies = off;

-- Provisions profiles + default workspace membership for every new
-- auth.users row. Non-fatal on error by design (see the exception block) so
-- a bad subscription_plan_id or similar never blocks signup itself — but
-- that also means a real bug here fails *silently*. If profiles stop
-- getting created again, check Dashboard -> Logs -> Postgres Logs for the
-- "handle_new_user: non-fatal provisioning error" WARNING it raises.
create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
as $function$
declare
  default_workspace uuid;
  user_plan_id uuid;
  user_display_name text;
  user_language text;
begin
  begin
    select id into default_workspace
    from public.workspaces
    order by created_at asc
    limit 1;

    user_display_name := new.raw_user_meta_data->>'display_name';

    user_language := new.raw_user_meta_data->>'language';
    if user_language is null or user_language not in ('en', 'fr', 'rw', 'sw') then
      user_language := 'en';
    end if;

    begin
      user_plan_id := (new.raw_user_meta_data->>'subscription_plan_id')::uuid;
    exception when others then
      user_plan_id := null;
    end;

    if user_plan_id is not null and not exists (
      select 1 from public.public_subscription_plan_catalog where id = user_plan_id
    ) then
      user_plan_id := null;
    end if;

    -- Get default starter plan ID if no plan specified
    if user_plan_id is null then
      user_plan_id := (
        select id from public.public_subscription_plan_catalog
        where code = 'starter' and is_active = true
        limit 1
      );
    end if;

    insert into public.profiles (id, display_name, plan_id, language)
    values (new.id, coalesce(user_display_name, ''), user_plan_id, user_language)
    on conflict (id) do nothing;

    if default_workspace is not null then
      insert into public.workspace_members (user_id, workspace_id, role)
      values (new.id, default_workspace, 'owner')
      on conflict (user_id, workspace_id) do nothing;
    end if;
  exception when others then
    raise warning 'handle_new_user: non-fatal provisioning error for user %: %', new.id, sqlerrm;
  end;

  return new;
end;
$function$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Auto-enables RLS on any new table created in `public`. Defined for
-- parity with the original schema; it is NOT currently wired up as an
-- event trigger (the original schema never had a matching `CREATE EVENT
-- TRIGGER` either), so newly created tables will NOT get RLS automatically
-- unless someone adds that separately.
create or replace function public.rls_auto_enable()
 returns event_trigger
 language plpgsql
 security definer
 set search_path to 'pg_catalog'
as $function$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table','partitioned table')
  loop
     if cmd.schema_name is not null and cmd.schema_name in ('public') and cmd.schema_name not in ('pg_catalog','information_schema') and cmd.schema_name not like 'pg_toast%' and cmd.schema_name not like 'pg_temp%' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
     else
        raise log 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     end if;
  end loop;
end;
$function$;

-- Backend validation for profile edits (display_name/phone are encrypted
-- client-side before this is called, so validation happens on the
-- plaintext values before encryption in the app layer).
create or replace function public.validate_and_update_profile(
  p_user_id uuid,
  p_display_name text,
  p_phone text,
  p_avatar_url text default null
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_display_name_min_length int := 3;
  v_display_name_max_length int := 100;
begin
  if p_display_name is not null and p_display_name != '' then
    if length(trim(p_display_name)) < v_display_name_min_length then
      raise exception 'Display name must be at least % characters', v_display_name_min_length;
    end if;

    if length(trim(p_display_name)) > v_display_name_max_length then
      raise exception 'Display name must not exceed % characters', v_display_name_max_length;
    end if;

    if not (trim(p_display_name) ~ '^[a-zA-Z\s\-''À-ſ]+$') then
      raise exception 'Display name contains invalid characters';
    end if;
  end if;

  if p_phone is not null and p_phone != '' then
    if not (p_phone ~ '^[\d\s\+\-\(\)]+$') then
      raise exception 'Phone number contains invalid characters';
    end if;

    if length(regexp_replace(p_phone, '[^\d]', '', 'g')) < 10 then
      raise exception 'Phone number must have at least 10 digits';
    end if;
  end if;

  update public.profiles
  set
    display_name = p_display_name,
    phone = p_phone,
    avatar_url = p_avatar_url,
    updated_at = now()
  where id = p_user_id;

  return true;
end;
$$;

create or replace function public.update_payment_methods_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger payment_methods_updated_at
  before update on public.payment_methods
  for each row
  execute function public.update_payment_methods_updated_at();

create or replace function public.update_tenant_subscriptions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tenant_subscriptions_updated_at
  before update on public.tenant_subscriptions
  for each row
  execute function public.update_tenant_subscriptions_updated_at();

create or replace function public.approve_subscription(
  p_subscription_id uuid,
  p_admin_user_id uuid
)
returns boolean
language plpgsql
security definer
as $$
begin
  update public.tenant_subscriptions
  set
    approval_status = 'approved',
    subscription_status = 'approved',
    payment_status = 'pending_payment',
    approved_by = p_admin_user_id,
    approved_at = now(),
    updated_at = now()
  where id = p_subscription_id
    and approval_status = 'pending';

  return found;
end;
$$;

create or replace function public.reject_subscription(
  p_subscription_id uuid,
  p_admin_user_id uuid,
  p_rejection_reason text
)
returns boolean
language plpgsql
security definer
as $$
begin
  update public.tenant_subscriptions
  set
    approval_status = 'rejected',
    subscription_status = 'cancelled',
    approved_by = p_admin_user_id,
    approved_at = now(),
    rejection_reason = p_rejection_reason,
    updated_at = now()
  where id = p_subscription_id
    and approval_status = 'pending';

  return found;
end;
$$;

-- Assigns the super_admin role to an existing auth.users account by email.
-- Deliberately does NOT create the account itself (the previous version of
-- this file did, with a hardcoded plaintext password — see the SECURITY
-- NOTE at the top of this file). Create the account normally (signup or
-- Supabase dashboard), then run:
--   select assign_super_admin_role('the-account-email@example.com');
create or replace function public.assign_super_admin_role(p_email text)
returns boolean
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
begin
  select id into v_user_id
  from auth.users
  where email = p_email;

  if v_user_id is null then
    raise notice 'User with email % not found in auth.users', p_email;
    return false;
  end if;

  insert into public.user_roles (user_id, role)
  values (v_user_id, 'super_admin')
  on conflict (user_id) do update set role = 'super_admin';

  insert into public.profiles (id, display_name, tenant_id)
  values (v_user_id, 'Super Admin', null)
  on conflict (id) do nothing;

  raise notice 'Super admin role assigned to user %', p_email;
  return true;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. Grants
-- ----------------------------------------------------------------------------
-- Equivalent to the original schema's per-table/per-role GRANT statements
-- (which repeated delete/insert/references/select/trigger/truncate/update
-- for every table x anon/authenticated/service_role — effectively "all
-- privileges on everything"), collapsed into the standard Supabase form so
-- it also applies to tables added later without needing to repeat this
-- block per table.

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

grant execute on function public.validate_and_update_profile to authenticated;
grant execute on function public.approve_subscription to authenticated;
grant execute on function public.reject_subscription to authenticated;
grant execute on function public.assign_super_admin_role to authenticated;
grant execute on function public.assign_super_admin_role to service_role;

-- ----------------------------------------------------------------------------
-- 7. Seed data
-- ----------------------------------------------------------------------------

insert into public.public_subscription_plan_catalog (
  code, name, description, short_description, currency,
  monthly_price, six_month_price, yearly_price, six_month_discount, yearly_discount,
  is_popular, display_order, badge_text, button_label,
  prices, features, limits
) values (
  'starter',
  'Starter',
  'Essential retail operations for small businesses running one location.',
  'Essential sales and stock control for a small shop.',
  'RWF',
  15999, 88314, 163190, 8, 15,
  false, 1, null, 'Start with Starter',
  '[
    {"billing_cycle": "monthly", "billing_months": 1, "list_price": 15999, "discount_percent": 0, "final_price": 15999, "currency": "RWF"},
    {"billing_cycle": "six_months", "billing_months": 6, "list_price": 95994, "discount_percent": 8, "final_price": 88314, "currency": "RWF"},
    {"billing_cycle": "annual", "billing_months": 12, "list_price": 191988, "discount_percent": 15, "final_price": 163190, "currency": "RWF"}
  ]'::jsonb,
  '[
    {"feature_key": "dashboard", "name": "Operational Dashboard", "description": "Daily business activity and operating summaries.", "category": "Core Operations", "feature_type": "module", "access_level": "included", "display_note": null, "is_highlighted": true},
    {"feature_key": "pos", "name": "Point of Sale", "description": "Checkout, receipts and sales processing.", "category": "Sales", "feature_type": "module", "access_level": "included", "display_note": "One POS terminal", "is_highlighted": true},
    {"feature_key": "products", "name": "Product Catalog", "description": "Product and retail item management.", "category": "Inventory", "feature_type": "module", "access_level": "included", "display_note": "Up to 500 products", "is_highlighted": true},
    {"feature_key": "customers", "name": "Customers", "description": "Customer profiles and sales history.", "category": "Customer Management", "feature_type": "module", "access_level": "included", "display_note": null, "is_highlighted": false},
    {"feature_key": "inventory_basic", "name": "Basic Inventory", "description": "Basic quantity and availability control.", "category": "Inventory", "feature_type": "capability", "access_level": "included", "display_note": null, "is_highlighted": true},
    {"feature_key": "reports_basic", "name": "Basic Reports", "description": "Core sales and inventory reporting.", "category": "Analytics", "feature_type": "capability", "access_level": "included", "display_note": null, "is_highlighted": false},
    {"feature_key": "offline_mode", "name": "Offline Operations", "description": "Core continuity during network interruptions.", "category": "Platform", "feature_type": "capability", "access_level": "limited", "display_note": "One approved device", "is_highlighted": true}
  ]'::jsonb,
  '[
    {"limit_key": "users", "name": "Users", "value": 2, "is_unlimited": false, "unit": "users"},
    {"limit_key": "branches", "name": "Branches", "value": 1, "is_unlimited": false, "unit": "branches"},
    {"limit_key": "products", "name": "Products", "value": 500, "is_unlimited": false, "unit": "products"},
    {"limit_key": "pos_terminals", "name": "POS terminals", "value": 1, "is_unlimited": false, "unit": "terminals"}
  ]'::jsonb
);

insert into public.public_subscription_plan_catalog (
  code, name, description, short_description, currency,
  monthly_price, six_month_price, yearly_price, six_month_discount, yearly_discount,
  is_popular, display_order, badge_text, button_label,
  prices, features, limits
) values (
  'professional',
  'Professional',
  'Expanded inventory, purchasing and compliance tools for growing businesses.',
  'Advanced retail control for growing operations.',
  'RWF',
  20999, 115914, 214190, 8, 15,
  false, 2, 'Growing Business', 'Choose Professional',
  '[
    {"billing_cycle": "monthly", "billing_months": 1, "list_price": 20999, "discount_percent": 0, "final_price": 20999, "currency": "RWF"},
    {"billing_cycle": "six_months", "billing_months": 6, "list_price": 125994, "discount_percent": 8, "final_price": 115914, "currency": "RWF"},
    {"billing_cycle": "annual", "billing_months": 12, "list_price": 251988, "discount_percent": 15, "final_price": 214190, "currency": "RWF"}
  ]'::jsonb,
  '[
    {"feature_key": "dashboard", "name": "Operational Dashboard", "description": null, "category": "Core Operations", "feature_type": "module", "access_level": "included", "display_note": null, "is_highlighted": true},
    {"feature_key": "pos", "name": "Point of Sale", "description": null, "category": "Sales", "feature_type": "module", "access_level": "included", "display_note": "Up to three POS terminals", "is_highlighted": true},
    {"feature_key": "products", "name": "Product Catalog", "description": null, "category": "Inventory", "feature_type": "module", "access_level": "included", "display_note": "Up to 1,000 products", "is_highlighted": true},
    {"feature_key": "suppliers", "name": "Suppliers", "description": null, "category": "Procurement", "feature_type": "module", "access_level": "included", "display_note": null, "is_highlighted": true},
    {"feature_key": "purchases", "name": "Purchases", "description": null, "category": "Procurement", "feature_type": "module", "access_level": "included", "display_note": null, "is_highlighted": true},
    {"feature_key": "inventory_advanced", "name": "Advanced Inventory Control", "description": null, "category": "Inventory", "feature_type": "capability", "access_level": "included", "display_note": null, "is_highlighted": true},
    {"feature_key": "stock_transfers", "name": "Stock Transfers", "description": null, "category": "Inventory", "feature_type": "module", "access_level": "included", "display_note": "Across two branches and two warehouses", "is_highlighted": true},
    {"feature_key": "warehouses", "name": "Warehouse Management", "description": null, "category": "Inventory", "feature_type": "module", "access_level": "limited", "display_note": "Up to two warehouses", "is_highlighted": false},
    {"feature_key": "loyalty", "name": "Customer Loyalty", "description": null, "category": "Customer Management", "feature_type": "module", "access_level": "included", "display_note": null, "is_highlighted": false},
    {"feature_key": "reports_advanced", "name": "Advanced Reports", "description": null, "category": "Analytics", "feature_type": "capability", "access_level": "limited", "display_note": "Operational reporting set", "is_highlighted": true},
    {"feature_key": "offline_mode", "name": "Offline Operations", "description": null, "category": "Platform", "feature_type": "capability", "access_level": "included", "display_note": null, "is_highlighted": true},
    {"feature_key": "ebm", "name": "RRA EBM Integration", "description": null, "category": "Integrations", "feature_type": "integration", "access_level": "included", "display_note": "Configuration requirements apply", "is_highlighted": true}
  ]'::jsonb,
  '[
    {"limit_key": "users", "name": "Users", "value": 5, "is_unlimited": false, "unit": "users"},
    {"limit_key": "branches", "name": "Branches", "value": 2, "is_unlimited": false, "unit": "branches"},
    {"limit_key": "warehouses", "name": "Warehouses", "value": 2, "is_unlimited": false, "unit": "warehouses"},
    {"limit_key": "products", "name": "Products", "value": 1000, "is_unlimited": false, "unit": "products"},
    {"limit_key": "pos_terminals", "name": "POS terminals", "value": 3, "is_unlimited": false, "unit": "terminals"}
  ]'::jsonb
);

insert into public.public_subscription_plan_catalog (
  code, name, description, short_description, currency,
  monthly_price, six_month_price, yearly_price, six_month_discount, yearly_discount,
  is_popular, display_order, badge_text, button_label,
  prices, features, limits
) values (
  'business_plus',
  'Business Plus',
  'Connected business operations for established multi-location organizations.',
  'Multi-branch operations with advanced governance.',
  'RWF',
  35999, 198714, 367190, 8, 15,
  true, 3, 'Most Popular', 'Choose Business Plus',
  '[
    {"billing_cycle": "monthly", "billing_months": 1, "list_price": 35999, "discount_percent": 0, "final_price": 35999, "currency": "RWF"},
    {"billing_cycle": "six_months", "billing_months": 6, "list_price": 215994, "discount_percent": 8, "final_price": 198714, "currency": "RWF"},
    {"billing_cycle": "annual", "billing_months": 12, "list_price": 431988, "discount_percent": 15, "final_price": 367190, "currency": "RWF"}
  ]'::jsonb,
  '[
    {"feature_key": "dashboard", "name": "Operational Dashboard", "description": null, "category": "Core Operations", "feature_type": "module", "access_level": "included", "display_note": null, "is_highlighted": true},
    {"feature_key": "pos", "name": "Point of Sale", "description": null, "category": "Sales", "feature_type": "module", "access_level": "included", "display_note": "Unlimited POS terminals", "is_highlighted": true},
    {"feature_key": "products", "name": "Product Catalog", "description": null, "category": "Inventory", "feature_type": "module", "access_level": "included", "display_note": "Up to 5,000 products", "is_highlighted": true},
    {"feature_key": "suppliers", "name": "Suppliers", "description": null, "category": "Procurement", "feature_type": "module", "access_level": "included", "display_note": null, "is_highlighted": true},
    {"feature_key": "purchases", "name": "Purchases", "description": null, "category": "Procurement", "feature_type": "module", "access_level": "included", "display_note": null, "is_highlighted": true},
    {"feature_key": "inventory_advanced", "name": "Advanced Inventory Control", "description": null, "category": "Inventory", "feature_type": "capability", "access_level": "included", "display_note": null, "is_highlighted": true},
    {"feature_key": "stock_transfers", "name": "Stock Transfers", "description": null, "category": "Inventory", "feature_type": "module", "access_level": "included", "display_note": "Unlimited branches and warehouses", "is_highlighted": true},
    {"feature_key": "warehouses", "name": "Warehouse Management", "description": null, "category": "Inventory", "feature_type": "module", "access_level": "included", "display_note": "Unlimited warehouses", "is_highlighted": false},
    {"feature_key": "loyalty", "name": "Customer Loyalty", "description": null, "category": "Customer Management", "feature_type": "module", "access_level": "included", "display_note": null, "is_highlighted": false},
    {"feature_key": "crm", "name": "Customer Relationship Management", "description": null, "category": "Customer Management", "feature_type": "module", "access_level": "included", "display_note": null, "is_highlighted": true},
    {"feature_key": "procurement", "name": "Procurement", "description": null, "category": "Procurement", "feature_type": "module", "access_level": "included", "display_note": null, "is_highlighted": true},
    {"feature_key": "staff", "name": "Staff Management", "description": null, "category": "Human Resources", "feature_type": "module", "access_level": "included", "display_note": null, "is_highlighted": true},
    {"feature_key": "payroll", "name": "Payroll", "description": null, "category": "Human Resources", "feature_type": "module", "access_level": "included", "display_note": "Configuration requirements apply", "is_highlighted": true},
    {"feature_key": "workspace", "name": "Workspace Collaboration", "description": null, "category": "Collaboration", "feature_type": "module", "access_level": "included", "display_note": null, "is_highlighted": true},
    {"feature_key": "meetings", "name": "Meetings", "description": null, "category": "Collaboration", "feature_type": "module", "access_level": "included", "display_note": null, "is_highlighted": false},
    {"feature_key": "reports_advanced", "name": "Advanced Reports", "description": null, "category": "Analytics", "feature_type": "capability", "access_level": "included", "display_note": "Full reporting suite", "is_highlighted": true},
    {"feature_key": "executive_analytics", "name": "Executive Analytics", "description": null, "category": "Analytics", "feature_type": "capability", "access_level": "included", "display_note": "Executive intelligence layer", "is_highlighted": true},
    {"feature_key": "audit_logs", "name": "Audit Logs", "description": null, "category": "Governance", "feature_type": "security", "access_level": "included", "display_note": null, "is_highlighted": true},
    {"feature_key": "approval_workflows", "name": "Approval Workflows", "description": null, "category": "Governance", "feature_type": "capability", "access_level": "included", "display_note": null, "is_highlighted": true},
    {"feature_key": "offline_mode", "name": "Offline Operations", "description": null, "category": "Platform", "feature_type": "capability", "access_level": "included", "display_note": "Unlimited approved devices", "is_highlighted": true},
    {"feature_key": "ebm", "name": "RRA EBM Integration", "description": null, "category": "Integrations", "feature_type": "integration", "access_level": "included", "display_note": "Configuration requirements apply", "is_highlighted": true}
  ]'::jsonb,
  '[
    {"limit_key": "users", "name": "Users", "value": 25, "is_unlimited": false, "unit": "users"},
    {"limit_key": "branches", "name": "Branches", "value": null, "is_unlimited": true, "unit": "branches"},
    {"limit_key": "warehouses", "name": "Warehouses", "value": null, "is_unlimited": true, "unit": "warehouses"},
    {"limit_key": "products", "name": "Products", "value": 5000, "is_unlimited": false, "unit": "products"},
    {"limit_key": "pos_terminals", "name": "POS terminals", "value": null, "is_unlimited": true, "unit": "terminals"}
  ]'::jsonb
);

insert into public.public_subscription_plan_catalog (
  code, name, description, short_description, currency,
  monthly_price, six_month_price, yearly_price, six_month_discount, yearly_discount,
  is_popular, display_order, badge_text, button_label,
  prices, features, limits
) values (
  'enterprise_pro',
  'Enterprise Pro',
  'Enterprise governance and complete control for large businesses.',
  'Complete business operating system for enterprise.',
  'RWF',
  79999, 441594, 815990, 8, 15,
  false, 4, 'Enterprise', 'Choose Enterprise Pro',
  '[
    {"billing_cycle": "monthly", "billing_months": 1, "list_price": 79999, "discount_percent": 0, "final_price": 79999, "currency": "RWF"},
    {"billing_cycle": "six_months", "billing_months": 6, "list_price": 479994, "discount_percent": 8, "final_price": 441594, "currency": "RWF"},
    {"billing_cycle": "annual", "billing_months": 12, "list_price": 959988, "discount_percent": 15, "final_price": 815990, "currency": "RWF"}
  ]'::jsonb,
  '[
    {"feature_key": "executive_analytics", "name": "Executive Analytics", "description": null, "category": "Analytics", "feature_type": "capability", "access_level": "included", "display_note": null, "is_highlighted": true},
    {"feature_key": "multi_company", "name": "Multi-company Control", "description": null, "category": "Enterprise", "feature_type": "capability", "access_level": "included", "display_note": null, "is_highlighted": true},
    {"feature_key": "sso", "name": "Single Sign-On", "description": null, "category": "Enterprise Security", "feature_type": "security", "access_level": "included", "display_note": null, "is_highlighted": true},
    {"feature_key": "custom_integrations", "name": "Custom Integrations", "description": null, "category": "Enterprise", "feature_type": "integration", "access_level": "included", "display_note": null, "is_highlighted": true},
    {"feature_key": "priority_support", "name": "Priority Support", "description": null, "category": "Support", "feature_type": "support", "access_level": "included", "display_note": "Enterprise support priority", "is_highlighted": true},
    {"feature_key": "dedicated_success", "name": "Dedicated Success Management", "description": null, "category": "Support", "feature_type": "support", "access_level": "included", "display_note": "Dedicated enterprise success oversight", "is_highlighted": true}
  ]'::jsonb,
  '[
    {"limit_key": "users", "name": "Users", "value": null, "is_unlimited": true, "unit": "users"},
    {"limit_key": "branches", "name": "Branches", "value": null, "is_unlimited": true, "unit": "branches"},
    {"limit_key": "warehouses", "name": "Warehouses", "value": null, "is_unlimited": true, "unit": "warehouses"},
    {"limit_key": "products", "name": "Products", "value": 10000, "is_unlimited": false, "unit": "products"},
    {"limit_key": "pos_terminals", "name": "POS terminals", "value": null, "is_unlimited": true, "unit": "terminals"}
  ]'::jsonb
);

insert into public.payment_methods (code, name, description, provider, is_active, display_order, supports_recurring, supports_one_time, currency) values
('mobile_money_mtn', 'MTN Mobile Money', 'Pay using MTN Mobile Money', 'MTN Rwanda', true, 1, true, true, 'RWF'),
('mobile_money_airtel', 'Airtel Money', 'Pay using Airtel Money', 'Airtel Rwanda', true, 2, true, true, 'RWF'),
('card_visa', 'Visa Card', 'Pay using Visa debit/credit cards', 'Visa', true, 3, true, true, 'RWF'),
('card_mastercard', 'Mastercard', 'Pay using Mastercard debit/credit cards', 'Mastercard', true, 4, true, true, 'RWF'),
('bank_transfer', 'Bank Transfer', 'Direct bank transfer', 'Various Banks', true, 5, true, true, 'RWF'),
('cash', 'Cash Payment', 'Pay with cash at office', 'ShopCore', true, 6, false, true, 'RWF'),
('check', 'Bank Check', 'Pay using bank check', 'Various Banks', false, 7, false, true, 'RWF');
