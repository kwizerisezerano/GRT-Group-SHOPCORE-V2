-- Run this in Supabase SQL Editor to check if data exists
-- These queries work in the SQL Editor with default privileges

-- Check main business tables
SELECT 'Products' as table_name, COUNT(*) as row_count FROM public.products
UNION ALL
SELECT 'Customers', COUNT(*) FROM public.customers
UNION ALL  
SELECT 'Sales', COUNT(*) FROM public.sales
UNION ALL
SELECT 'Categories', COUNT(*) FROM public.categories
UNION ALL
SELECT 'Brands', COUNT(*) FROM public.brands
UNION ALL
SELECT 'Suppliers', COUNT(*) FROM public.suppliers
UNION ALL
SELECT 'Staff', COUNT(*) FROM public.staff
UNION ALL
SELECT 'Expenses', COUNT(*) FROM public.expenses
UNION ALL
SELECT 'Tenants', COUNT(*) FROM public.tenants
UNION ALL
SELECT 'Tenant Members', COUNT(*) FROM public.tenant_members
UNION ALL
SELECT 'Profiles', COUNT(*) FROM public.profiles
UNION ALL
SELECT 'Auth Users', COUNT(*) FROM auth.users;

-- Check if there are any orphaned users (users without tenant membership)
SELECT 'Orphaned Users (no tenant membership)' as check_name, COUNT(*) as count
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenant_members tm WHERE tm.user_id = au.id
);

-- Check recent data creation
SELECT 'Recent products (last 24h)' as check_name, COUNT(*) as count
FROM public.products 
WHERE created_at > NOW() - INTERVAL '24 hours';
