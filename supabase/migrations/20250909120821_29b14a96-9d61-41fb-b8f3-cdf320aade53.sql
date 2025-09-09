-- Ensure real-time updates are properly configured for the ideas table
ALTER TABLE public.ideas REPLICA IDENTITY FULL;

-- Add the ideas table to the supabase_realtime publication if not already added
DO $$
BEGIN
    -- Check if the table is already in the publication
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'ideas'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ideas;
    END IF;
END $$;