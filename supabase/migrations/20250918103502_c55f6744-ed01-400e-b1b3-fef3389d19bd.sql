-- Create table for board invitations with magic links
CREATE TABLE public.board_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID NOT NULL,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  invited_by_email TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.board_invitations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Board creators and managers can create invitations" 
ON public.board_invitations 
FOR INSERT 
WITH CHECK (
  has_role(auth.email(), 'admin'::app_role) OR
  EXISTS (
    SELECT 1 FROM public.boards b 
    WHERE b.id = board_id AND b.created_by_email = auth.email()
  ) OR
  EXISTS (
    SELECT 1 FROM public.board_members bm 
    WHERE bm.board_id = board_invitations.board_id 
    AND bm.email = auth.email() 
    AND bm.role IN ('manager', 'assistant')
  )
);

CREATE POLICY "Board creators and managers can view invitations" 
ON public.board_invitations 
FOR SELECT 
USING (
  has_role(auth.email(), 'admin'::app_role) OR
  EXISTS (
    SELECT 1 FROM public.boards b 
    WHERE b.id = board_id AND b.created_by_email = auth.email()
  ) OR
  EXISTS (
    SELECT 1 FROM public.board_members bm 
    WHERE bm.board_id = board_invitations.board_id 
    AND bm.email = auth.email() 
    AND bm.role IN ('manager', 'assistant')
  )
);

-- Create index for performance
CREATE INDEX idx_board_invitations_token ON public.board_invitations(token);
CREATE INDEX idx_board_invitations_email ON public.board_invitations(email);
CREATE INDEX idx_board_invitations_expires_at ON public.board_invitations(expires_at);

-- Add trigger for updated_at
CREATE TRIGGER update_board_invitations_updated_at
BEFORE UPDATE ON public.board_invitations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();