-- Sectors / setores: controle de acesso por área
CREATE TYPE public.app_sector AS ENUM ('marketing', 'pcp', 'desenvolvimento');

CREATE TABLE public.user_sectors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sector public.app_sector NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, sector)
);

GRANT SELECT ON public.user_sectors TO authenticated;
GRANT ALL ON public.user_sectors TO service_role;

ALTER TABLE public.user_sectors ENABLE ROW LEVEL SECURITY;

-- Usuário lê seus próprios setores
CREATE POLICY "Users read own sectors" ON public.user_sectors
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admin lê todos
CREATE POLICY "Admins read all sectors" ON public.user_sectors
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Função has_sector (security definer, evita recursão)
CREATE OR REPLACE FUNCTION public.has_sector(_user_id uuid, _sector public.app_sector)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_sectors
    WHERE user_id = _user_id AND sector = _sector
  ) OR public.has_role(_user_id, 'admin');
$$;

-- Default permissivo: todos os usuários existentes recebem os 3 setores
INSERT INTO public.user_sectors (user_id, sector)
SELECT p.id, s.sector
FROM public.profiles p
CROSS JOIN (VALUES ('marketing'::public.app_sector), ('pcp'), ('desenvolvimento')) AS s(sector)
ON CONFLICT (user_id, sector) DO NOTHING;

-- Novos usuários ganham os 3 setores por padrão (mantém comportamento atual até admin restringir)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
    (NEW.id, 'modelagem',   'Modelagem',   1, '#8b5cf6', true),
    (NEW.id, 'corte',       'Corte',       2, '#3b82f6', true),
    (NEW.id, 'costura',     'Costura',     3, '#10b981', true),
    (NEW.id, 'acabamento',  'Acabamento',  4, '#f59e0b', true),
    (NEW.id, 'expedicao',   'Expedição',   5, '#ef4444', true)
  ON CONFLICT (owner_id, key) DO NOTHING;

  RETURN NEW;
END;
$$;