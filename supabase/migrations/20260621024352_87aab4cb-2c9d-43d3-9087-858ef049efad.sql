-- Enum dos gates do protótipo
DO $$ BEGIN
  CREATE TYPE public.prototype_gate_key AS ENUM ('conceito','modelagem','ficha','piloto','aprovacao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.prototype_gate_status AS ENUM ('pendente','aprovado','reprovado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) GATES
CREATE TABLE IF NOT EXISTS public.prototype_gates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  prototype_id uuid NOT NULL REFERENCES public.prototypes(id) ON DELETE CASCADE,
  gate public.prototype_gate_key NOT NULL,
  status public.prototype_gate_status NOT NULL DEFAULT 'pendente',
  approver_id uuid,
  decided_at timestamptz,
  due_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prototype_id, gate)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prototype_gates TO authenticated;
GRANT ALL ON public.prototype_gates TO service_role;

ALTER TABLE public.prototype_gates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prototype_gates_select_owner" ON public.prototype_gates
  FOR SELECT USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "prototype_gates_insert_owner" ON public.prototype_gates
  FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "prototype_gates_update_owner" ON public.prototype_gates
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "prototype_gates_delete_owner" ON public.prototype_gates
  FOR DELETE USING (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_prototype_gates_proto ON public.prototype_gates(prototype_id);

CREATE TRIGGER trg_prototype_gates_updated
  BEFORE UPDATE ON public.prototype_gates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) HANDOFF EVENTS
CREATE TABLE IF NOT EXISTS public.prototype_handoff_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  prototype_id uuid NOT NULL REFERENCES public.prototypes(id) ON DELETE CASCADE,
  from_sector text,
  to_sector text NOT NULL,
  event text NOT NULL DEFAULT 'entrega', -- entrega | devolucao
  actor_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prototype_handoff_events TO authenticated;
GRANT ALL ON public.prototype_handoff_events TO service_role;

ALTER TABLE public.prototype_handoff_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prototype_handoff_select_owner" ON public.prototype_handoff_events
  FOR SELECT USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "prototype_handoff_insert_owner" ON public.prototype_handoff_events
  FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "prototype_handoff_update_owner" ON public.prototype_handoff_events
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "prototype_handoff_delete_owner" ON public.prototype_handoff_events
  FOR DELETE USING (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_prototype_handoff_proto ON public.prototype_handoff_events(prototype_id, created_at);

-- 3) Trigger: gate "aprovacao" aprovado => protótipo vai a stage 'aprovado'
CREATE OR REPLACE FUNCTION public.prototype_gates_promote_stage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.gate = 'aprovacao' AND NEW.status = 'aprovado'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'aprovado') THEN
    UPDATE public.prototypes
       SET stage = 'aprovado'
     WHERE id = NEW.prototype_id
       AND owner_id = NEW.owner_id
       AND stage <> 'aprovado';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_prototype_gates_promote ON public.prototype_gates;
CREATE TRIGGER trg_prototype_gates_promote
  AFTER INSERT OR UPDATE ON public.prototype_gates
  FOR EACH ROW EXECUTE FUNCTION public.prototype_gates_promote_stage();