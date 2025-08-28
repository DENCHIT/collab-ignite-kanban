-- Update the app_role enum to have cleaner roles
DROP TYPE IF EXISTS app_role CASCADE;
CREATE TYPE app_role AS ENUM ('admin', 'manager');

-- Update the user_roles table to reflect the new role structure
-- We'll keep the existing data and migrate manager_a to manager
UPDATE public.user_roles SET role = 'manager' WHERE role = 'manager_a';
DELETE FROM public.user_roles WHERE role = 'manager_b';

-- Update the board_members table to add 'assistant' role
-- Current roles are 'member' and 'manager' at board level
-- We'll add 'assistant' role for board-specific management
ALTER TABLE public.board_members 
ALTER COLUMN role TYPE text,
ALTER COLUMN role SET DEFAULT 'member';

-- Update RLS policies for the new role structure
DROP POLICY IF EXISTS "Admin and manager_a can create boards" ON public.boards;
CREATE POLICY "Admin and manager can create boards" 
ON public.boards 
FOR INSERT 
WITH CHECK (
  auth.email() = 'ed@zoby.ai' OR 
  has_role(auth.email(), 'manager')
);

-- Update board members policies to allow assistants to manage ideas
DROP POLICY IF EXISTS "Board managers can delete ideas" ON public.ideas;
CREATE POLICY "Board managers and assistants can delete ideas" 
ON public.ideas 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 
    FROM board_members bm
    JOIN boards b ON b.id = bm.board_id
    WHERE b.id = ideas.board_id 
    AND bm.email = auth.email() 
    AND bm.role IN ('manager', 'assistant')
  )
);

-- Update the get_manager_activity function to work with new roles
CREATE OR REPLACE FUNCTION public.get_manager_activity()
RETURNS TABLE(
  email text, 
  display_name text, 
  role app_role, 
  assigned_at timestamp with time zone, 
  boards_created bigint, 
  total_ideas bigint, 
  total_votes bigint, 
  total_members bigint, 
  assistant_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
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
  AND (auth.email() = 'ed@zoby.ai' OR ur.email = auth.email())
  ORDER BY ur.assigned_at DESC
$$;