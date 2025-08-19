-- Add assignees column to ideas table
ALTER TABLE public.ideas ADD COLUMN assignees jsonb NOT NULL DEFAULT '[]'::jsonb;