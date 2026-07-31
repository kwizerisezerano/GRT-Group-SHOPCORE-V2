-- Find all tables in supabase_migrations schema
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'supabase_migrations';
