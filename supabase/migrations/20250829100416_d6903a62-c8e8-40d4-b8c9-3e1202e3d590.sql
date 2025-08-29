-- Drop the existing check constraint that only allows member and manager
ALTER TABLE public.board_members DROP CONSTRAINT board_members_role_check;

-- Add a new check constraint that includes assistant
ALTER TABLE public.board_members ADD CONSTRAINT board_members_role_check 
CHECK (role = ANY (ARRAY['member'::text, 'manager'::text, 'assistant'::text]));