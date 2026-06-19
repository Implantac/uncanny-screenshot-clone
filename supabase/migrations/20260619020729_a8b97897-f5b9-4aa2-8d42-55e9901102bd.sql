
-- AUDIT LOGS: stop users from forging actor_email / ip_address by removing client INSERT policy
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'audit_logs' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.audit_logs', pol.policyname);
  END LOOP;
END $$;

-- Secure logger: callers cannot set actor_email / ip_address / user_agent
CREATE OR REPLACE FUNCTION public.log_audit(
  _entity text,
  _entity_id uuid,
  _action text,
  _payload jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _ip text;
  _ua text;
  _id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'log_audit: authentication required';
  END IF;

  BEGIN
    _email := (auth.jwt() ->> 'email');
  EXCEPTION WHEN OTHERS THEN _email := NULL;
  END;

  BEGIN
    _ip := COALESCE(
      split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1),
      current_setting('request.headers', true)::json ->> 'x-real-ip'
    );
    _ua := current_setting('request.headers', true)::json ->> 'user-agent';
  EXCEPTION WHEN OTHERS THEN
    _ip := NULL; _ua := NULL;
  END;

  INSERT INTO public.audit_logs(user_id, actor_email, entity, entity_id, action, payload, ip_address, user_agent)
  VALUES (_uid, _email, _entity, _entity_id, _action, _payload, _ip, _ua)
  RETURNING id INTO _id;

  RETURN _id;
END $$;

REVOKE ALL ON FUNCTION public.log_audit(text, uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_audit(text, uuid, text, jsonb) TO authenticated, service_role;
