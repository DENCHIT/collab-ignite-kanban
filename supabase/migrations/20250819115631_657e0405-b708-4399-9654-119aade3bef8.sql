
-- 1) Store plaintext passcode (admin-only access via function)
alter table public.boards_secrets
add column if not exists passcode_plain text;

-- 2) Update the function that sets a board passcode to also store the plaintext
create or replace function public.set_board_passcode(_board_id uuid, _passcode text)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
  declare 
    passcode_hash text;
    salt_value text;
  begin
    -- Generate salt
    salt_value := gen_random_uuid()::text;

    -- Generate salted hash
    passcode_hash := md5(salt_value || _passcode || salt_value);

    -- Upsert hashed + plaintext passcode
    insert into public.boards_secrets (board_id, passcode_hash, salt, passcode_plain)
    values (_board_id, passcode_hash, salt_value, _passcode)
    on conflict (board_id)
    do update set 
      passcode_hash = excluded.passcode_hash,
      salt          = excluded.salt,
      passcode_plain = excluded.passcode_plain,
      updated_at    = now();

    return true;
  end;
$function$;

-- 3) Admin-only data for boards, including plaintext passcode and accurate counts
-- vote_count = sum of unique votes on ideas (jsonb_object_length(voters))
create or replace function public.get_boards_admin_data()
returns table (
  board_id uuid,
  name text,
  slug text,
  passcode text,
  idea_count bigint,
  vote_count bigint,
  member_count bigint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = 'public', 'pg_temp'
as $$
  select
    b.id as board_id,
    b.name,
    b.slug,
    bs.passcode_plain as passcode,
    coalesce(i.cnt, 0) as idea_count,
    coalesce(i.votes, 0) as vote_count,
    coalesce(m.cnt, 0) as member_count,
    b.created_at
  from public.boards b
  left join public.boards_secrets bs on bs.board_id = b.id
  left join lateral (
    select 
      count(*)::bigint as cnt,
      coalesce(sum(jsonb_object_length(i.voters)), 0)::bigint as votes
    from public.ideas i
    where i.board_id = b.id
  ) i on true
  left join lateral (
    select count(*)::bigint as cnt
    from public.board_members bm
    where bm.board_id = b.id
  ) m on true
  -- Ensure only the admin gets results
  where auth.email() = 'ed@zoby.ai';
$$;
