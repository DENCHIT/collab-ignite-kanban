-- Fix infinite recursion in board_members RLS policy
-- First drop the existing policy that causes recursion
DROP POLICY IF EXISTS "Board members visible to board members only" ON public.board_members;

-- Create a security definer function to check board membership without recursion
CREATE OR REPLACE FUNCTION public.user_is_board_member(_board_id uuid, _user_email text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  -- Check if user is a member of the board
  RETURN EXISTS (
    SELECT 1 
    FROM public.board_members bm
    WHERE bm.board_id = _board_id 
    AND bm.email = _user_email
  );
END;
$$;

-- Create a new policy that uses the security definer function
CREATE POLICY "Board members visible to board members and admin"
ON public.board_members
FOR SELECT
USING (
  -- Allow admin full access
  auth.email() = 'ed@zoby.ai'
  OR
  -- Allow board members to see other board members of the same board
  public.user_is_board_member(board_id, auth.email())
);

-- Update other board_members policies to allow admin access
DROP POLICY IF EXISTS "Only admin can delete board members" ON public.board_members;
CREATE POLICY "Only admin can delete board members"
ON public.board_members
FOR DELETE
USING (auth.email() = 'ed@zoby.ai');

DROP POLICY IF EXISTS "Only admin can insert board members" ON public.board_members;  
CREATE POLICY "Only admin can insert board members"
ON public.board_members
FOR INSERT
WITH CHECK (auth.email() = 'ed@zoby.ai');

DROP POLICY IF EXISTS "Only admin can update board members" ON public.board_members;
CREATE POLICY "Only admin can update board members"  
ON public.board_members
FOR UPDATE
USING (auth.email() = 'ed@zoby.ai');