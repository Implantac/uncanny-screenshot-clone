
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

  INSERT INTO public.user_sectors (user_id, sector) VALUES
    (NEW.id, 'marketing'),
    (NEW.id, 'pcp'),
    (NEW.id, 'desenvolvimento')
  ON CONFLICT (user_id, sector) DO NOTHING;

  INSERT INTO public.pcp_stages (owner_id, key, label, position, color, active) VALUES
    (NEW.id, 'compras',      'Compras',              1, '#6366f1', true),
    (NEW.id, 'corte',        'Corte',                2, '#3b82f6', true),
    (NEW.id, 'bordado',      'Bordado',              3, '#8b5cf6', true),
    (NEW.id, 'bordado_terc', 'Bordado Terceirizado', 4, '#a78bfa', true),
    (NEW.id, 'silk',         'Silk',                 5, '#ec4899', true),
    (NEW.id, 'silk_terc',    'Silk Terceirizado',    6, '#f472b6', true),
    (NEW.id, 'costura',      'Costura',              7, '#10b981', true),
    (NEW.id, 'costura_terc', 'Costura Terceirizado', 8, '#34d399', true),
    (NEW.id, 'acabamento',   'Acabamento',           9, '#f59e0b', true)
  ON CONFLICT (owner_id, key) DO NOTHING;

  RETURN NEW;
END;
$function$;
