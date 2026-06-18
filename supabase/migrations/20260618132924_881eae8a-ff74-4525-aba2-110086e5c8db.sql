CREATE TABLE public.sector_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  sector app_sector NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT,
  body TEXT NOT NULL,
  reply_to UUID REFERENCES public.sector_messages(id) ON DELETE SET NULL,
  ref_kind TEXT,
  ref_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sector_messages TO authenticated;
GRANT ALL ON public.sector_messages TO service_role;

ALTER TABLE public.sector_messages ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário do owner que pertença ao setor pode ler
CREATE POLICY "members read sector messages"
  ON public.sector_messages FOR SELECT
  TO authenticated
  USING (
    public.has_sector(auth.uid(), sector)
  );

-- Apenas autor pode inserir, e precisa pertencer ao setor
CREATE POLICY "members post in their sector"
  ON public.sector_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.has_sector(auth.uid(), sector)
  );

-- Autor pode editar/apagar suas próprias mensagens
CREATE POLICY "author updates own message"
  ON public.sector_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "author deletes own message"
  ON public.sector_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX sector_messages_sector_created_idx ON public.sector_messages(sector, created_at DESC);
CREATE INDEX sector_messages_owner_idx ON public.sector_messages(owner_id);

CREATE TRIGGER update_sector_messages_updated_at
  BEFORE UPDATE ON public.sector_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.sector_messages;