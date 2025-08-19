-- Add checklist column to ideas table
ALTER TABLE public.ideas ADD COLUMN checklist jsonb NOT NULL DEFAULT '[]'::jsonb;