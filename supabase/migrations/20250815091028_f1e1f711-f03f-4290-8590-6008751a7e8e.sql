-- Create ideas table
CREATE TABLE public.ideas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  creator_name TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'backlog',
  last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  voters JSONB NOT NULL DEFAULT '{}',
  comments JSONB NOT NULL DEFAULT '[]',
  history JSONB NOT NULL DEFAULT '[]',
  blocked_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;

-- Create policies for idea access
CREATE POLICY "Ideas are viewable by everyone" 
ON public.ideas 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create ideas" 
ON public.ideas 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update ideas" 
ON public.ideas 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete ideas" 
ON public.ideas 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_ideas_updated_at
BEFORE UPDATE ON public.ideas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for better performance
CREATE INDEX idx_ideas_board_id ON public.ideas(board_id);
CREATE INDEX idx_ideas_status ON public.ideas(status);

-- Enable realtime for ideas table
ALTER TABLE public.ideas REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ideas;