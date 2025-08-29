-- Update function to include proper search_path
CREATE OR REPLACE FUNCTION public.is_board_assistant(_board_slug TEXT, _user_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
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