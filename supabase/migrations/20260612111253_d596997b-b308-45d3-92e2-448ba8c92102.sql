
-- Restrict SELECT on ai_agents to owner
DROP POLICY IF EXISTS "Users can view their own ai_agents" ON public.ai_agents;
DROP POLICY IF EXISTS "Authenticated users can view ai_agents" ON public.ai_agents;
DROP POLICY IF EXISTS "ai_agents_select" ON public.ai_agents;
CREATE POLICY "Users can view their own ai_agents"
  ON public.ai_agents FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- Restrict SELECT on mobile_devices to owner
DROP POLICY IF EXISTS "Users can view their own mobile_devices" ON public.mobile_devices;
DROP POLICY IF EXISTS "Authenticated users can view mobile_devices" ON public.mobile_devices;
DROP POLICY IF EXISTS "mobile_devices_select" ON public.mobile_devices;
CREATE POLICY "Users can view their own mobile_devices"
  ON public.mobile_devices FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- Restrict SELECT on profiles to own row
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);
