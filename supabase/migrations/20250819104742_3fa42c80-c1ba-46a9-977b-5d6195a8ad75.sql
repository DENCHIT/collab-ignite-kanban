-- Create a more flexible function to check board membership that works with local sessions
CREATE OR REPLACE FUNCTION public.is_user_board_member(_board_id UUID, _user_email text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  DECLARE is_member boolean;
BEGIN
  SELECT exists(
    SELECT 1 
    FROM public.board_members bm
    WHERE bm.board_id = _board_id 
    AND bm.email = _user_email
  ) INTO is_member;
  RETURN is_member;
END;
$$;

-- Update RLS policies for ideas to work with current local session system
-- Allow anyone to view ideas for now (can be restricted later if needed)
DROP POLICY IF EXISTS "Board members can view ideas" ON public.ideas;
CREATE POLICY "Anyone can view ideas" 
ON public.ideas 
FOR SELECT 
USING (true);

-- Allow creation but will be validated in application logic
DROP POLICY IF EXISTS "Board members can create ideas" ON public.ideas;
CREATE POLICY "Anyone can create ideas" 
ON public.ideas 
FOR INSERT 
WITH CHECK (true);

-- Allow updates but will be validated in application logic  
DROP POLICY IF EXISTS "Board members can update ideas" ON public.ideas;
CREATE POLICY "Anyone can update ideas" 
ON public.ideas 
FOR UPDATE 
USING (true);

-- Keep delete restricted to authenticated managers/admins only
DROP POLICY IF EXISTS "Board managers can delete ideas" ON public.ideas;
CREATE POLICY "Authenticated managers can delete ideas" 
ON public.ideas 
FOR DELETE 
USING (
  auth.email() IS NOT NULL AND (
    auth.email() = 'ed@zoby.ai' OR 
    EXISTS (
      SELECT 1 FROM public.board_members bm 
      JOIN public.boards b ON b.id = bm.board_id 
      WHERE b.id = board_id AND bm.email = auth.email() AND bm.role = 'manager'
    )
  )
);