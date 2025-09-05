-- PHASE 1A: Drop all functions that need to be recreated
DROP FUNCTION IF EXISTS public.get_accessible_boards();
DROP FUNCTION IF EXISTS public.get_accessible_boards(text);
DROP FUNCTION IF EXISTS public.get_manager_activity();
DROP FUNCTION IF EXISTS public.get_manager_activity(text);
DROP FUNCTION IF EXISTS public.verify_board_passcode(text, text);
DROP FUNCTION IF EXISTS public.get_boards_admin_data();