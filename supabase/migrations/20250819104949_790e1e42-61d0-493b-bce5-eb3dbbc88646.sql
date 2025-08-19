-- Allow anyone to create ideas (temporary fix for the permission issue)
DROP POLICY IF EXISTS "Board members can create ideas" ON public.ideas;
CREATE POLICY "Anyone can create ideas" 
ON public.ideas 
FOR INSERT 
WITH CHECK (true);