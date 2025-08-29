-- Create function to check if user is board assistant
CREATE OR REPLACE FUNCTION public.is_board_assistant(_board_slug TEXT, _user_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM board_members bm
    JOIN boards b ON b.id = bm.board_id
    WHERE b.slug = _board_slug 
    AND bm.email = _user_email 
    AND bm.role = 'assistant'
  );
$$;