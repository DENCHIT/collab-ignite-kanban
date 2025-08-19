-- Create profiles table for global user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profile policies - users can read/update their own profile, admin can read all
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (auth.email() = 'ed@zoby.ai');

-- Create function to initialize profile for current user
CREATE OR REPLACE FUNCTION public.init_profile_for_current_user(_display_name TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  profile_id UUID;
  user_email TEXT;
  final_display_name TEXT;
BEGIN
  -- Get current user email
  SELECT auth.email() INTO user_email;
  
  IF user_email IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Use provided display name or derive from email
  final_display_name := COALESCE(_display_name, SPLIT_PART(user_email, '@', 1));
  
  -- Insert or update profile
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (auth.uid(), user_email, final_display_name)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    email = EXCLUDED.email,
    display_name = COALESCE(_display_name, profiles.display_name),
    updated_at = now()
  RETURNING id INTO profile_id;
  
  RETURN profile_id;
END;
$$;

-- Create function to get boards for current user
CREATE OR REPLACE FUNCTION public.get_my_boards()
RETURNS TABLE(
  board_id UUID,
  board_name TEXT,
  board_slug TEXT,
  item_type TEXT,
  role TEXT,
  joined_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  RETURN QUERY
  SELECT 
    b.id as board_id,
    b.name as board_name,
    b.slug as board_slug,
    b.item_type,
    bm.role,
    bm.joined_at
  FROM public.board_members bm
  JOIN public.boards b ON b.id = bm.board_id
  WHERE bm.email = auth.email()
  ORDER BY bm.joined_at DESC;
END;
$$;

-- Add index on board_members.email for faster queries
CREATE INDEX IF NOT EXISTS idx_board_members_email ON public.board_members(email);

-- Add trigger for automatic timestamp updates on profiles
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();