-- Allow anyone to update ideas (for voting and comments)
DROP POLICY IF EXISTS "Board members can update ideas" ON public.ideas;
CREATE POLICY "Anyone can update ideas" 
ON public.ideas 
FOR UPDATE 
USING (true);