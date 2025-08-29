-- Fix get_accessible_boards function to accept email parameter
CREATE OR REPLACE FUNCTION public.get_accessible_boards(_user_email text DEFAULT NULL)
 RETURNS TABLE(board_id uuid, name text, slug text, passcode text, item_type text, idea_count bigint, vote_count bigint, member_count bigint, created_at timestamp with time zone, created_by_email text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
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
    COALESCE(_user_email, auth.email()) = 'ed@zoby.ai' OR 
    b.created_by_email = COALESCE(_user_email, auth.email())
  )
  ORDER BY b.created_at DESC
$$;

-- Fix get_manager_activity function to accept email parameter
CREATE OR REPLACE FUNCTION public.get_manager_activity(_user_email text DEFAULT NULL)
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
  AND (COALESCE(_user_email, auth.email()) = 'ed@zoby.ai' OR ur.email = COALESCE(_user_email, auth.email()))
  ORDER BY ur.assigned_at DESC
$$;