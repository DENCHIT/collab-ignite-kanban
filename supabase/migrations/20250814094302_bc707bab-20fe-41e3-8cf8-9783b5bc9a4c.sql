-- Create board_members table to track who joins each board
CREATE TABLE public.board_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'manager')),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(board_id, email)
);

-- Enable Row Level Security
ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;

-- Create policies for board_members
CREATE POLICY "Board members are viewable by everyone" 
ON public.board_members 
FOR SELECT 
USING (true);

CREATE POLICY "Only admin can insert board members" 
ON public.board_members 
FOR INSERT 
WITH CHECK (auth.email() = 'ed@zoby.ai');

CREATE POLICY "Only admin can update board members" 
ON public.board_members 
FOR UPDATE 
USING (auth.email() = 'ed@zoby.ai');

CREATE POLICY "Only admin can delete board members" 
ON public.board_members 
FOR DELETE 
USING (auth.email() = 'ed@zoby.ai');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_board_members_updated_at
BEFORE UPDATE ON public.board_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to check if user is manager of a board
CREATE OR REPLACE FUNCTION public.is_board_manager(_board_slug text, _user_email text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  declare is_manager boolean;
begin
  select exists(
    select 1 
    from public.board_members bm
    join public.boards b on b.id = bm.board_id
    where b.slug = _board_slug 
    and bm.email = _user_email 
    and bm.role = 'manager'
  ) into is_manager;
  return is_manager;
end;
$$;