-- Admin-only data for boards, including plaintext passcode and accurate counts
CREATE OR REPLACE FUNCTION public.get_boards_admin_data()
RETURNS TABLE (
  board_id uuid,
  name text,
  slug text,
  passcode text,
  idea_count bigint,
  vote_count bigint,
  member_count bigint,
  created_at timestamptz
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
    COALESCE(i.cnt, 0) as idea_count,
    COALESCE(i.votes, 0) as vote_count,
    COALESCE(m.cnt, 0) as member_count,
    b.created_at
  FROM public.boards b
  LEFT JOIN public.boards_secrets bs ON bs.board_id = b.id
  LEFT JOIN LATERAL (
    SELECT 
      COUNT(*)::bigint as cnt,
      COALESCE(SUM(jsonb_object_length(ideas.voters)), 0)::bigint as votes
    FROM public.ideas
    WHERE ideas.board_id = b.id
  ) i ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::bigint as cnt
    FROM public.board_members bm
    WHERE bm.board_id = b.id
  ) m ON true
  WHERE auth.email() = 'ed@zoby.ai';
$$;