-- PHASE 1: CRITICAL SECURITY FIXES

-- 1. DROP overly permissive RLS policies and replace with secure ones
DROP POLICY IF EXISTS "Anyone can view ideas" ON public.ideas;
DROP POLICY IF EXISTS "Anyone can create ideas" ON public.ideas;
DROP POLICY IF EXISTS "Anyone can update ideas" ON public.ideas;
DROP POLICY IF EXISTS "Boards basic info readable by everyone" ON public.boards;
DROP POLICY IF EXISTS "Anyone can create notifications" ON public.notifications;

-- 2. Create secure RLS policies for ideas
CREATE POLICY "Board members can view ideas" ON public.ideas
FOR SELECT USING (
  user_is_board_member(board_id, auth.email()) OR 
  has_role(auth.email(), 'admin'::app_role) OR
  (SELECT created_by_email FROM boards WHERE id = ideas.board_id) = auth.email()
);

CREATE POLICY "Board members can create ideas" ON public.ideas
FOR INSERT WITH CHECK (
  user_is_board_member(board_id, auth.email()) OR 
  has_role(auth.email(), 'admin'::app_role) OR
  (SELECT created_by_email FROM boards WHERE id = ideas.board_id) = auth.email()
);

CREATE POLICY "Board managers and assistants can update ideas" ON public.ideas
FOR UPDATE USING (
  has_role(auth.email(), 'admin'::app_role) OR
  (SELECT created_by_email FROM boards WHERE id = ideas.board_id) = auth.email() OR
  EXISTS (
    SELECT 1 FROM board_members bm 
    WHERE bm.board_id = ideas.board_id 
    AND bm.email = auth.email() 
    AND bm.role IN ('manager', 'assistant')
  )
);

-- 3. Create secure RLS policies for boards
CREATE POLICY "Board members can view boards" ON public.boards
FOR SELECT USING (
  user_is_board_member(id, auth.email()) OR 
  has_role(auth.email(), 'admin'::app_role) OR
  created_by_email = auth.email()
);

-- 4. Create secure RLS policy for notifications
CREATE POLICY "Board members can create notifications" ON public.notifications
FOR INSERT WITH CHECK (
  user_is_board_member(
    (SELECT board_id FROM ideas WHERE id = notifications.idea_id), 
    auth.email()
  ) OR 
  has_role(auth.email(), 'admin'::app_role)
);

-- 5. Remove plaintext passcode column (CRITICAL SECURITY FIX)
ALTER TABLE public.boards_secrets DROP COLUMN IF EXISTS passcode_plain;

-- 6. Update passcode functions to use strong bcrypt hashing
CREATE OR REPLACE FUNCTION public.set_board_passcode(_board_id uuid, _passcode text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE 
  passcode_hash TEXT;
BEGIN
  -- Generate bcrypt hash (cost factor 12 for strong security)
  passcode_hash := crypt(_passcode, gen_salt('bf', 12));
  
  -- Insert or update only the hashed passcode
  INSERT INTO public.boards_secrets (board_id, passcode_hash)
  VALUES (_board_id, passcode_hash)
  ON CONFLICT (board_id) 
  DO UPDATE SET 
    passcode_hash = EXCLUDED.passcode_hash,
    updated_at = now();
  
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_board_passcode_secure(_slug text, _passcode text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE 
  stored_hash TEXT;
BEGIN
  -- Get the bcrypt hash for the board
  SELECT bs.passcode_hash INTO stored_hash
  FROM public.boards b
  JOIN public.boards_secrets bs ON b.id = bs.board_id
  WHERE b.slug = _slug;
  
  -- If no board found, return false
  IF stored_hash IS NULL THEN
    RETURN false;
  END IF;
  
  -- Verify using bcrypt
  RETURN crypt(_passcode, stored_hash) = stored_hash;
END;
$$;

-- 7. Fix SECURITY DEFINER functions to prevent privilege escalation
CREATE OR REPLACE FUNCTION public.get_accessible_boards()
RETURNS TABLE(board_id uuid, name text, slug text, item_type text, idea_count bigint, vote_count bigint, member_count bigint, created_at timestamp with time zone, created_by_email text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT
    b.id as board_id,
    b.name,
    b.slug,
    b.item_type,
    COALESCE(i.cnt, 0) as idea_count,
    COALESCE(i.votes, 0) as vote_count,
    COALESCE(m.cnt, 0) as member_count,
    b.created_at,
    b.created_by_email
  FROM public.boards b
  LEFT JOIN LATERAL (
    SELECT 
      COUNT(*)::bigint as cnt,
      COALESCE(SUM(
        CASE 
          WHEN jsonb_typeof(ideas.voters) = 'object' 
          THEN (SELECT COUNT(*) FROM jsonb_each(ideas.voters))
          ELSE 0 
        END
      ), 0)::bigint as votes
    FROM public.ideas
    WHERE ideas.board_id = b.id
  ) i ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::bigint as cnt
    FROM public.board_members bm
    WHERE bm.board_id = b.id
  ) m ON true
  WHERE (
    has_role(auth.email(), 'admin'::app_role) OR 
    b.created_by_email = auth.email() OR
    user_is_board_member(b.id, auth.email())
  )
  ORDER BY b.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_manager_activity()
RETURNS TABLE(email text, display_name text, role app_role, assigned_at timestamp with time zone, boards_created bigint, total_ideas bigint, total_votes bigint, total_members bigint, assistant_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT
    ur.email,
    COALESCE(p.display_name, split_part(ur.email, '@', 1)) as display_name,
    ur.role,
    ur.assigned_at,
    COALESCE(b.boards_created, 0) as boards_created,
    COALESCE(b.total_ideas, 0) as total_ideas,
    COALESCE(b.total_votes, 0) as total_votes,
    COALESCE(b.total_members, 0) as total_members,
    COALESCE(assistant_count.assistant_count, 0) as assistant_count
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON p.email = ur.email
  LEFT JOIN LATERAL (
    SELECT 
      COUNT(*)::bigint as boards_created,
      COALESCE(SUM(ideas.cnt), 0)::bigint as total_ideas,
      COALESCE(SUM(ideas.votes), 0)::bigint as total_votes,
      COALESCE(SUM(members.cnt), 0)::bigint as total_members
    FROM public.boards boards
    LEFT JOIN LATERAL (
      SELECT 
        COUNT(*)::bigint as cnt,
        COALESCE(SUM(
          CASE 
            WHEN jsonb_typeof(i.voters) = 'object' 
            THEN (SELECT COUNT(*) FROM jsonb_each(i.voters))
            ELSE 0 
          END
        ), 0)::bigint as votes
      FROM public.ideas i
      WHERE i.board_id = boards.id
    ) ideas ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::bigint as cnt
      FROM public.board_members bm
      WHERE bm.board_id = boards.id
    ) members ON true
    WHERE boards.created_by_email = ur.email
  ) b ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::bigint as assistant_count
    FROM public.board_members bm
    JOIN public.boards boards ON boards.id = bm.board_id
    WHERE boards.created_by_email = ur.email
    AND bm.role = 'assistant'
    AND bm.email != ur.email
  ) assistant_count ON true
  WHERE ur.role = 'manager'
  AND (has_role(auth.email(), 'admin'::app_role) OR ur.email = auth.email())
  ORDER BY ur.assigned_at DESC;
$$;

-- 8. Secure add_board_member function with proper authorization
CREATE OR REPLACE FUNCTION public.add_board_member(_slug text, _email text, _display_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  bid uuid;
  board_creator_email text;
  caller_is_manager boolean;
BEGIN
  -- Find board id and creator by slug
  SELECT id, created_by_email INTO bid, board_creator_email 
  FROM public.boards WHERE slug = _slug;
  
  IF bid IS NULL THEN
    RETURN false;
  END IF;

  -- Check if caller is board manager/assistant
  SELECT EXISTS(
    SELECT 1 FROM public.board_members 
    WHERE board_id = bid 
    AND email = auth.email() 
    AND role IN ('manager', 'assistant')
  ) INTO caller_is_manager;

  -- Authorization check: only admin, board creator, or board manager can add members
  IF NOT (
    has_role(auth.email(), 'admin'::app_role) OR 
    board_creator_email = auth.email() OR 
    caller_is_manager
  ) THEN
    RAISE EXCEPTION 'Unauthorized to add members to this board';
  END IF;

  -- Insert or update member
  INSERT INTO public.board_members (board_id, email, display_name, role)
  VALUES (bid, _email, _display_name, 'member')
  ON CONFLICT (board_id, email)
  DO UPDATE SET 
    display_name = EXCLUDED.display_name,
    updated_at = now();

  RETURN true;
END;
$$;

-- 9. Drop legacy insecure functions
DROP FUNCTION IF EXISTS public.verify_board_passcode(text, text);
DROP FUNCTION IF EXISTS public.get_accessible_boards(text);
DROP FUNCTION IF EXISTS public.get_manager_activity(text);

-- 10. Update admin functions to use role-based checks instead of hardcoded email
CREATE OR REPLACE FUNCTION public.get_boards_admin_data()
RETURNS TABLE(board_id uuid, name text, slug text, item_type text, idea_count bigint, vote_count bigint, member_count bigint, created_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT
    b.id as board_id,
    b.name,
    b.slug,
    b.item_type,
    COALESCE(i.cnt, 0) as idea_count,
    COALESCE(i.votes, 0) as vote_count,
    COALESCE(m.cnt, 0) as member_count,
    b.created_at
  FROM public.boards b
  LEFT JOIN LATERAL (
    SELECT 
      COUNT(*)::bigint as cnt,
      COALESCE(SUM(
        CASE 
          WHEN jsonb_typeof(ideas.voters) = 'object' 
          THEN (SELECT COUNT(*) FROM jsonb_each(ideas.voters))
          ELSE 0 
        END
      ), 0)::bigint as votes
    FROM public.ideas
    WHERE ideas.board_id = b.id
  ) i ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::bigint as cnt
    FROM public.board_members bm
    WHERE bm.board_id = b.id
  ) m ON true
  WHERE has_role(auth.email(), 'admin'::app_role);
$$;