-- Add column_order field to boards table to store the order of columns
ALTER TABLE public.boards ADD COLUMN column_order TEXT[] DEFAULT NULL;