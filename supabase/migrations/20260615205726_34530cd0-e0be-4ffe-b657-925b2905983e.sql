CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'designer');

  INSERT INTO public.pcp_stages (owner_id, key, label, position, color, active) VALUES
    (NEW.id, 'modelagem',   'Modelagem',   1, '#8b5cf6', true),
    (NEW.id, 'corte',       'Corte',       2, '#3b82f6', true),
    (NEW.id, 'costura',     'Costura',     3, '#10b981', true),
    (NEW.id, 'acabamento',  'Acabamento',  4, '#f59e0b', true),
    (NEW.id, 'expedicao',   'Expedição',   5, '#ef4444', true)
  ON CONFLICT (owner_id, key) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Backfill: seed default stages for existing users that have none
INSERT INTO public.pcp_stages (owner_id, key, label, position, color, active)
SELECT u.id, v.key, v.label, v.position, v.color, true
FROM auth.users u
CROSS JOIN (VALUES
  ('modelagem',  'Modelagem',  1, '#8b5cf6'),
  ('corte',      'Corte',      2, '#3b82f6'),
  ('costura',    'Costura',    3, '#10b981'),
  ('acabamento', 'Acabamento', 4, '#f59e0b'),
  ('expedicao',  'Expedição',  5, '#ef4444')
) AS v(key, label, position, color)
WHERE NOT EXISTS (SELECT 1 FROM public.pcp_stages s WHERE s.owner_id = u.id)
ON CONFLICT (owner_id, key) DO NOTHING;