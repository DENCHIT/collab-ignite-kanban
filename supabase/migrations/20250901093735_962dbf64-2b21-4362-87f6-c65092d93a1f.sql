-- Remove lingering manager role for the specified user so they no longer see Create Board UI
DELETE FROM public.user_roles
WHERE email = 'ed.dench@tippr.co.uk'
  AND role = 'manager';