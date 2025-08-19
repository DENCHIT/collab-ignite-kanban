-- Add unique constraint to prevent duplicate board memberships
ALTER TABLE public.board_members ADD CONSTRAINT unique_board_member UNIQUE (board_id, email);

-- Also add foreign key constraint to boards table for data integrity
ALTER TABLE public.board_members ADD CONSTRAINT fk_board_member_board FOREIGN KEY (board_id) REFERENCES public.boards(id) ON DELETE CASCADE;