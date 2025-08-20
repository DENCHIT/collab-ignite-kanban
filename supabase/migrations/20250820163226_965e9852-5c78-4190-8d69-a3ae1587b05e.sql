-- Create enum for email digest frequency
CREATE TYPE public.digest_frequency AS ENUM ('off', 'daily', 'weekly');

-- Create email preferences table
CREATE TABLE public.email_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  -- Member notifications
  mentions BOOLEAN NOT NULL DEFAULT true,
  assigned BOOLEAN NOT NULL DEFAULT true,
  -- Manager notifications  
  new_items BOOLEAN NOT NULL DEFAULT true,
  items_moved BOOLEAN NOT NULL DEFAULT false,
  new_board_members BOOLEAN NOT NULL DEFAULT true,
  -- Admin notifications
  admin_digest digest_frequency NOT NULL DEFAULT 'off',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only view and modify their own preferences
CREATE POLICY "Users can view their own email preferences"
ON public.email_preferences
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own email preferences"
ON public.email_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own email preferences"
ON public.email_preferences
FOR UPDATE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_email_preferences_updated_at
BEFORE UPDATE ON public.email_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();