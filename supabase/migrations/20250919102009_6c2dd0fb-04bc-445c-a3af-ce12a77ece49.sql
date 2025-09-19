-- Allow public access to view invitations by token (for unauthenticated users clicking invitation links)
DROP POLICY IF EXISTS "Board creators, managers, and invited users can view invitations" ON public.board_invitations;

CREATE POLICY "Board creators, managers, and invited users can view invitations" 
ON public.board_invitations 
FOR SELECT 
USING (
  -- Always allow viewing invitations (needed for unauthenticated users with invitation links)
  true
);