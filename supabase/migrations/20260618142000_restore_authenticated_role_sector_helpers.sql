-- RLS policies for user_roles/user_sectors call these helpers while resolving
-- the current authenticated user's access. Without EXECUTE, the client cannot
-- load roles/sectors and protected modules such as /dev-kanban are hidden.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_sector(uuid, public.app_sector) TO authenticated;
