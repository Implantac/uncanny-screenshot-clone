
CREATE TABLE public.marketing_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  ref_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_notifications TO authenticated;
GRANT ALL ON public.marketing_notifications TO service_role;

ALTER TABLE public.marketing_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own select" ON public.marketing_notifications FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own insert" ON public.marketing_notifications FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "own update" ON public.marketing_notifications FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "own delete" ON public.marketing_notifications FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE INDEX idx_mkt_notif_owner_created ON public.marketing_notifications(owner_id, created_at DESC);

-- Trigger: nova coleção criada
CREATE OR REPLACE FUNCTION public.notify_marketing_new_collection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.marketing_notifications(owner_id, kind, title, body, link, ref_id)
  SELECT us.user_id, 'collection', 'Nova coleção: ' || NEW.name,
         COALESCE(NEW.season, '') || ' ' || COALESCE(NEW.year::text, ''),
         '/colecoes', NEW.id
    FROM public.user_sectors us
   WHERE us.sector = 'marketing' AND us.user_id = NEW.owner_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_marketing_new_collection
AFTER INSERT ON public.collections
FOR EACH ROW EXECUTE FUNCTION public.notify_marketing_new_collection();

-- Trigger: protótipo aprovado pelo desenvolvimento
CREATE OR REPLACE FUNCTION public.notify_marketing_prototype_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stage = 'aprovado' AND (TG_OP = 'INSERT' OR OLD.stage IS DISTINCT FROM 'aprovado') THEN
    INSERT INTO public.marketing_notifications(owner_id, kind, title, body, link, ref_id)
    SELECT us.user_id, 'prototype_approved', 'Lançamento liberado: ' || NEW.code,
           COALESCE(NEW.name, ''), '/prototipos', NEW.id
      FROM public.user_sectors us
     WHERE us.sector = 'marketing' AND us.user_id = NEW.owner_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_marketing_prototype_approved
AFTER INSERT OR UPDATE OF stage ON public.prototypes
FOR EACH ROW EXECUTE FUNCTION public.notify_marketing_prototype_approved();
