-- Add Bob and Ed as board members for hh-demo board
INSERT INTO public.board_members (board_id, email, display_name, role) VALUES 
('d7d450b0-9a82-42df-8ef9-06de381ab886', 'bob@example.com', 'Bob', 'member'),
('d7d450b0-9a82-42df-8ef9-06de381ab886', 'ed@zoby.ai', 'Ed', 'manager');