-- Check what columns exist in the migrations table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'schema_migrations' 
  AND table_schema = 'supabase_migrations';
