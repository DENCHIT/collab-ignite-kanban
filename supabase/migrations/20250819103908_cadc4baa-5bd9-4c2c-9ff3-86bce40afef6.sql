-- Create boards_secrets table for hashed passcodes
CREATE TABLE public.boards_secrets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  passcode_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(board_id)
);

-- Enable RLS on boards_secrets
ALTER TABLE public.boards_secrets ENABLE ROW LEVEL SECURITY;

-- Create policies for boards_secrets (only functions can access)
CREATE POLICY "Only functions can access board secrets" 
ON public.boards_secrets 
FOR ALL 
USING (false);

-- Create function to hash passcodes using pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create function to verify board passcode with hash
CREATE OR REPLACE FUNCTION public.verify_board_passcode_secure(_slug text, _passcode text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  DECLARE 
    stored_hash TEXT;
    board_exists BOOLEAN;
  BEGIN
    -- Check if board exists and get hash
    SELECT bs.passcode_hash INTO stored_hash
    FROM public.boards b
    JOIN public.boards_secrets bs ON b.id = bs.board_id
    WHERE b.slug = _slug;
    
    -- If no board found, return false
    IF stored_hash IS NULL THEN
      RETURN false;
    END IF;
    
    -- Verify passcode against hash
    RETURN crypt(_passcode, stored_hash) = stored_hash;
  END;
$$;

-- Create function to set board passcode (hashed)
CREATE OR REPLACE FUNCTION public.set_board_passcode(_board_id UUID, _passcode text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  DECLARE 
    passcode_hash TEXT;
  BEGIN
    -- Generate hash for passcode
    passcode_hash := crypt(_passcode, gen_salt('bf', 8));
    
    -- Insert or update the hashed passcode
    INSERT INTO public.boards_secrets (board_id, passcode_hash)
    VALUES (_board_id, passcode_hash)
    ON CONFLICT (board_id) 
    DO UPDATE SET 
      passcode_hash = EXCLUDED.passcode_hash,
      updated_at = now();
    
    RETURN true;
  END;
$$;

-- Create function to check if user is board member
CREATE OR REPLACE FUNCTION public.is_board_member(_board_slug text, _user_email text)
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
    JOIN public.boards b on b.id = bm.board_id
    WHERE b.slug = _board_slug 
    AND bm.email = _user_email
  ) INTO is_member;
  RETURN is_member;
END;
$$;

-- Update RLS policies for boards table to hide passcode
DROP POLICY IF EXISTS "Boards are readable by everyone" ON public.boards;
CREATE POLICY "Boards basic info readable by everyone" 
ON public.boards 
FOR SELECT 
USING (true);

-- Update RLS policies for ideas - only board members can access
DROP POLICY IF EXISTS "Ideas are viewable by everyone" ON public.ideas;
DROP POLICY IF EXISTS "Anyone can create ideas" ON public.ideas;
DROP POLICY IF EXISTS "Anyone can update ideas" ON public.ideas;
DROP POLICY IF EXISTS "Anyone can delete ideas" ON public.ideas;

-- New strict RLS policies for ideas
CREATE POLICY "Board members can view ideas" 
ON public.ideas 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.board_members bm 
    JOIN public.boards b ON b.id = bm.board_id 
    WHERE b.id = board_id AND bm.email = auth.email()
  )
);

CREATE POLICY "Board members can create ideas" 
ON public.ideas 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.board_members bm 
    JOIN public.boards b ON b.id = bm.board_id 
    WHERE b.id = board_id AND bm.email = auth.email()
  )
);

CREATE POLICY "Board members can update ideas" 
ON public.ideas 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.board_members bm 
    JOIN public.boards b ON b.id = bm.board_id 
    WHERE b.id = board_id AND bm.email = auth.email()
  )
);

CREATE POLICY "Board managers can delete ideas" 
ON public.ideas 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.board_members bm 
    JOIN public.boards b ON b.id = bm.board_id 
    WHERE b.id = board_id AND bm.email = auth.email() AND bm.role = 'manager'
  )
);

-- Update board_members policies to protect PII
DROP POLICY IF EXISTS "Board members are viewable by everyone" ON public.board_members;
CREATE POLICY "Board members visible to board members only" 
ON public.board_members 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.board_members bm2 
    JOIN public.boards b ON b.id = bm2.board_id 
    WHERE b.id = board_id AND bm2.email = auth.email()
  )
);

-- Migrate existing passcodes to hashed format
DO $$
DECLARE
  board_record RECORD;
BEGIN
  FOR board_record IN SELECT id, passcode FROM public.boards WHERE passcode IS NOT NULL LOOP
    PERFORM public.set_board_passcode(board_record.id, board_record.passcode);
  END LOOP;
END $$;

-- Remove passcode column from boards table (no longer needed)
ALTER TABLE public.boards DROP COLUMN IF EXISTS passcode;