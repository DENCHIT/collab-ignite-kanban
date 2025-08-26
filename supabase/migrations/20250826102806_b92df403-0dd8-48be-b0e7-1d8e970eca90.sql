-- Create function to initialize profile for current user
CREATE OR REPLACE FUNCTION public.init_profile_for_current_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
  user_name text;
BEGIN
  -- Get current user's email
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  
  -- Use email prefix as default display name
  user_name := COALESCE(split_part(user_email, '@', 1), 'User');
  
  -- Insert profile if it doesn't exist
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (auth.uid(), user_email, user_name)
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(profiles.display_name, EXCLUDED.display_name);
END;
$$;