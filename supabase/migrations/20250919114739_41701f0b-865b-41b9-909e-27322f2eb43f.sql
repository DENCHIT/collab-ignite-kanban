-- Allow public access to view board basic info for invitations (needed for unauthenticated users with invitation links)
DROP POLICY IF EXISTS "Board members can view boards" ON public.boards;

CREATE POLICY "Board members can view boards" 
ON public.boards 
FOR SELECT 
USING (
  -- Allow access to board members, admins, and board creators as before
  user_is_board_member(id, auth.email()) OR 
  has_role(auth.email(), 'admin'::app_role) OR 
  (created_by_email = auth.email()) OR
  -- Allow access if this board is referenced in a valid invitation (for unauthenticated users)
  EXISTS (
    SELECT 1 FROM public.board_invitations bi 
    WHERE bi.board_id = boards.id 
    AND bi.used_at IS NULL 
    AND bi.expires_at > now()
  )
);