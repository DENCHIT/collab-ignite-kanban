-- Allow invited users to view their own invitations
DROP POLICY IF EXISTS "Board creators and managers can view invitations" ON public.board_invitations;

CREATE POLICY "Board creators, managers, and invited users can view invitations" 
ON public.board_invitations 
FOR SELECT 
USING (
  has_role(auth.email(), 'admin'::app_role) OR 
  (EXISTS ( SELECT 1
    FROM boards b
    WHERE ((b.id = board_invitations.board_id) AND (b.created_by_email = auth.email()))
  )) OR 
  (EXISTS ( SELECT 1
    FROM board_members bm
    WHERE ((bm.board_id = board_invitations.board_id) AND (bm.email = auth.email()) AND (bm.role = ANY (ARRAY['manager'::text, 'assistant'::text])))
  )) OR
  -- Allow invited users to view their own invitations
  (board_invitations.email = auth.email())
);