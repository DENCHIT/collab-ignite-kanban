-- Add column names field to boards table
ALTER TABLE public.boards ADD COLUMN column_names JSONB DEFAULT '{
  "backlog": "Backlog",
  "discussion": "In discussion", 
  "production": "In production",
  "review": "In review",
  "roadblock": "Roadblock",
  "done": "Done"
}'::jsonb;