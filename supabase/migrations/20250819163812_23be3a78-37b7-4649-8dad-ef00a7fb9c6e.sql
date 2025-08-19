-- Create a secure function to add a member to a board by slug
create or replace function public.add_board_member(_slug text, _email text, _display_name text)
returns boolean
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  bid uuid;
begin
  -- Find board id by slug
  select id into bid from public.boards where slug = _slug;
  if bid is null then
    return false;
  end if;

  -- Insert or update member
  insert into public.board_members (board_id, email, display_name, role)
  values (bid, _email, _display_name, 'member')
  on conflict (board_id, email)
  do update set 
    display_name = excluded.display_name,
    updated_at = now();

  return true;
end;
$$;
