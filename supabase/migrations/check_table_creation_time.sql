-- Check when tables were created (this shows when the destructive migration ran)
SELECT 
  table_name,
  (SELECT pg_class.relfrozenxid FROM pg_class WHERE pg_class.relname = table_name) as creation_indicator
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('products', 'customers', 'sales', 'brands', 'categories')
ORDER BY table_name;

-- Alternative: Check the oldest row in each table (approximate creation time)
SELECT 'Products' as table_name, MIN(created_at) as oldest_created FROM public.products
UNION ALL
SELECT 'Customers', MIN(created_at) FROM public.customers
UNION ALL  
SELECT 'Sales', MIN(created_at) FROM public.sales
UNION ALL
SELECT 'Categories', MIN(created_at) FROM public.categories
UNION ALL
SELECT 'Brands', MIN(created_at) FROM public.brands;
