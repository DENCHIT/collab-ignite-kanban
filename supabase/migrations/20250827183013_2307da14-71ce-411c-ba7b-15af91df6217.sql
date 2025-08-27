-- Create user roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'manager_a', 'manager_b');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role app_role NOT NULL,
  assigned_by TEXT NOT NULL, -- email of who assigned this role
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_roles
CREATE POLICY "Admin can view all user roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.email() = 'ed@zoby.ai');

CREATE POLICY "Admin can insert user roles" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (auth.email() = 'ed@zoby.ai');

CREATE POLICY "Admin can update user roles" 
ON public.user_roles 
FOR UPDATE 
USING (auth.email() = 'ed@zoby.ai');

CREATE POLICY "Admin can delete user roles" 
ON public.user_roles 
FOR DELETE 
USING (auth.email() = 'ed@zoby.ai');

-- Security definer functions for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_email text, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE email = _user_email
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_email text)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT role
  FROM public.user_roles
  WHERE email = _user_email
  ORDER BY 
    CASE role 
      WHEN 'admin' THEN 1
      WHEN 'manager_a' THEN 2
      WHEN 'manager_b' THEN 3
      ELSE 4
    END
  LIMIT 1
$$;

-- Update boards table RLS policies to allow manager_a to create boards
DROP POLICY IF EXISTS "Only ed@zoby.ai can create boards" ON public.boards;

CREATE POLICY "Admin and manager_a can create boards" 
ON public.boards 
FOR INSERT 
WITH CHECK (
  auth.email() = 'ed@zoby.ai' OR 
  public.has_role(auth.email(), 'manager_a')
);

-- Update board_members RLS policies to allow managers to manage their boards
DROP POLICY IF EXISTS "Only admin can insert board members" ON public.board_members;
DROP POLICY IF EXISTS "Only admin can update board members" ON public.board_members;
DROP POLICY IF EXISTS "Only admin can delete board members" ON public.board_members;

CREATE POLICY "Admin and board creators can insert board members" 
ON public.board_members 
FOR INSERT 
WITH CHECK (
  auth.email() = 'ed@zoby.ai' OR
  EXISTS (
    SELECT 1 FROM public.boards b 
    WHERE b.id = board_id AND b.created_by_email = auth.email()
  )
);

CREATE POLICY "Admin and board creators can update board members" 
ON public.board_members 
FOR UPDATE 
USING (
  auth.email() = 'ed@zoby.ai' OR
  EXISTS (
    SELECT 1 FROM public.boards b 
    WHERE b.id = board_id AND b.created_by_email = auth.email()
  )
);

CREATE POLICY "Admin and board creators can delete board members" 
ON public.board_members 
FOR DELETE 
USING (
  auth.email() = 'ed@zoby.ai' OR
  EXISTS (
    SELECT 1 FROM public.boards b 
    WHERE b.id = board_id AND b.created_by_email = auth.email()
  )
);

-- Function to get manager activity data
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
  manager_b_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
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
    COALESCE(mb_count.manager_b_count, 0) as manager_b_count
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
    SELECT COUNT(*)::bigint as manager_b_count
    FROM public.board_members bm
    JOIN public.boards boards ON boards.id = bm.board_id
    WHERE boards.created_by_email = ur.email
    AND bm.role = 'manager'
    AND bm.email != ur.email
  ) mb_count ON true
  WHERE ur.role IN ('manager_a', 'manager_b')
  AND (auth.email() = 'ed@zoby.ai' OR ur.email = auth.email())
  ORDER BY ur.assigned_at DESC
$$;

-- Function to get boards accessible to current user (admin sees all, managers see their own)
CREATE OR REPLACE FUNCTION public.get_accessible_boards()
RETURNS TABLE(
  board_id uuid,
  name text,
  slug text,
  passcode text,
  item_type text,
  idea_count bigint,
  vote_count bigint,
  member_count bigint,
  created_at timestamp with time zone,
  created_by_email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT
    b.id as board_id,
    b.name,
    b.slug,
    bs.passcode_plain as passcode,
    b.item_type,
    COALESCE(i.cnt, 0) as idea_count,
    COALESCE(i.votes, 0) as vote_count,
    COALESCE(m.cnt, 0) as member_count,
    b.created_at,
    b.created_by_email
  FROM public.boards b
  LEFT JOIN public.boards_secrets bs ON bs.board_id = b.id
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
    auth.email() = 'ed@zoby.ai' OR 
    b.created_by_email = auth.email()
  )
  ORDER BY b.created_at DESC
$$;

-- Add trigger for updating updated_at on user_roles
CREATE TRIGGER update_user_roles_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert admin role for ed@zoby.ai
INSERT INTO public.user_roles (user_id, email, role, assigned_by)
SELECT 
  id, 
  email, 
  'admin'::app_role, 
  'system'
FROM auth.users 
WHERE email = 'ed@zoby.ai'
ON CONFLICT (user_id, role) DO NOTHING;