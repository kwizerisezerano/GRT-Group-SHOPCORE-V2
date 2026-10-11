-- Check how many times each migration was run
SELECT 
  version,
  name,
  COUNT(*) as run_count
FROM supabase_migrations.schema_migrations
GROUP BY version, name
ORDER BY run_count DESC;
