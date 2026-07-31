-- Check when migrations were run with timestamps
SELECT 
  version,
  statements,
  executed_at
FROM supabase_migrations.schema_migrations
ORDER BY executed_at DESC
LIMIT 10;
