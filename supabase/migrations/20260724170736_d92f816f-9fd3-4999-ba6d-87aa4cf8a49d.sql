-- Restore EXECUTE grants on SECURITY DEFINER functions used inside RLS policies.
-- Without these, PostgREST evaluates policies as the authenticated role and gets
-- "permission denied for function has_role" (SQLSTATE 42501), which surfaces as
-- 403 on user_roles / user_sectors reads. That in turn makes the frontend treat
-- every user as a non-admin with no sectors, blocking access to sector-scoped
-- screens like /pilots, /dev-kanban, /prototipos, /ficha-tecnica.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_sector(uuid, public.app_sector) TO authenticated, anon, service_role;