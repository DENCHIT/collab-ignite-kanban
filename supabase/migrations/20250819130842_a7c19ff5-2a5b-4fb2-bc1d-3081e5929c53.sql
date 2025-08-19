-- Update the function to store both hashed and plaintext passcode
CREATE OR REPLACE FUNCTION public.set_board_passcode(_board_id uuid, _passcode text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  DECLARE 
    passcode_hash TEXT;
    salt_value TEXT;
  BEGIN
    -- Generate salt
    salt_value := gen_random_uuid()::text;
    
    -- Generate hash for passcode using MD5 with salt
    passcode_hash := md5(salt_value || _passcode || salt_value);
    
    -- Insert or update both hashed and plaintext passcode
    INSERT INTO public.boards_secrets (board_id, passcode_hash, salt, passcode_plain)
    VALUES (_board_id, passcode_hash, salt_value, _passcode)
    ON CONFLICT (board_id) 
    DO UPDATE SET 
      passcode_hash = EXCLUDED.passcode_hash,
      salt = EXCLUDED.salt,
      passcode_plain = EXCLUDED.passcode_plain,
      updated_at = now();
    
    RETURN true;
  END;
$function$;