-- Set stable, secure search_path for functions to satisfy linter
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.verify_board_passcode(_slug text, _passcode text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
  declare ok boolean;
begin
  select exists(
    select 1 from public.boards b where b.slug = _slug and b.passcode = _passcode
  ) into ok;
  return ok;
end;
$$;