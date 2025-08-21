-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily digest email at 8:00 AM UTC every day
SELECT cron.schedule(
  'daily-digest-emails',
  '0 8 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://sixpcrgvsxfhtthwdbkm.supabase.co/functions/v1/send-digest',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpeHBjcmd2c3hmaHR0aHdkYmttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5NDE4MjMsImV4cCI6MjA3MDUxNzgyM30.QWCqVAQvWZZBbyjL7OUTQV8mWxc8rHvaAaN3OYOZtec"}'::jsonb,
      body := '{"period": "daily"}'::jsonb
    ) AS request_id;
  $$
);

-- Schedule weekly digest email at 8:00 AM UTC every Monday
SELECT cron.schedule(
  'weekly-digest-emails',
  '0 8 * * 1',
  $$
  SELECT
    net.http_post(
      url := 'https://sixpcrgvsxfhtthwdbkm.supabase.co/functions/v1/send-digest',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpeHBjcmd2c3hmaHR0aHdkYmttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5NDE4MjMsImV4cCI6MjA3MDUxNzgyM30.QWCqVAQvWZZBbyjL7OUTQV8mWxc8rHvaAaN3OYOZtec"}'::jsonb,
      body := '{"period": "weekly"}'::jsonb
    ) AS request_id;
  $$
);