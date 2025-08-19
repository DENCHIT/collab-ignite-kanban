-- Add item_type field to boards table to store preference between 'idea' and 'task'
ALTER TABLE public.boards 
ADD COLUMN IF NOT EXISTS item_type text DEFAULT 'idea' CHECK (item_type IN ('idea', 'task'));