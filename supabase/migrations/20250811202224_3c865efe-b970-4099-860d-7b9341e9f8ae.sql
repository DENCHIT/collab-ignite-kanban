-- Create boards table for multi-board support
create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  passcode text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.boards enable row level security;

-- Function to update updated_at
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger for updated_at
create or replace trigger boards_set_updated_at
before update on public.boards
for each row
execute function public.update_updated_at_column();

-- Policy: Allow anyone to read minimal board metadata except passcode via explicit column policy (we'll avoid selecting passcode in the app)
create policy "Boards are readable by everyone"
on public.boards
for select
using (true);

-- Policy: Only admin ed@zoby.ai can create boards
create policy "Only ed@zoby.ai can create boards"
on public.boards
for insert
to authenticated
with check (auth.email() = 'ed@zoby.ai');

-- Policy: Only creator admin can update/delete their boards (optional, restrictive)
create policy "Board creator can update"
on public.boards
for update
to authenticated
using (auth.uid() = created_by);

create policy "Board creator can delete"
on public.boards
for delete
to authenticated
using (auth.uid() = created_by);

-- RPC to verify passcode without exposing it
create or replace function public.verify_board_passcode(_slug text, _passcode text)
returns boolean
language plpgsql
stable
security definer
as $$
  declare ok boolean;
begin
  select exists(
    select 1 from public.boards b where b.slug = _slug and b.passcode = _passcode
  ) into ok;
  return ok;
end;
$$;

grant execute on function public.verify_board_passcode(text, text) to anon, authenticated;