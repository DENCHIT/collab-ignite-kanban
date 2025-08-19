-- Allow anyone to view ideas
DROP POLICY IF EXISTS "Board members can view ideas" ON public.ideas;
CREATE POLICY "Anyone can view ideas" 
ON public.ideas 
FOR SELECT 
USING (true);