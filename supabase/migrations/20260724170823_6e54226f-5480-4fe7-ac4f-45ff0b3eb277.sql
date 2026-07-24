-- Tighten: revoke anon (public) execute from role/sector checkers; they are only
-- needed inside RLS policies for signed-in users and by service_role.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_sector(uuid, public.app_sector) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_sector(uuid, public.app_sector) TO authenticated, service_role;