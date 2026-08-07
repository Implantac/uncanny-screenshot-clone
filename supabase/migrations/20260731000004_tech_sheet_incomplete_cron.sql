-- ============================================================
-- Job diário: alertar fichas técnicas incompletas há 7+ dias.
-- Estilo → o responsável (owner_id) recebe uma notificação
-- no sino de notificações (push_notifications), respeitando
-- notification_preferences (mute por categoria 'tech_sheet').
--
-- Reutiliza a infraestrutura já usada pelo sino de notificações
-- e pelo notifyTechSheetEvent (server function).
-- ============================================================

CREATE OR REPLACE FUNCTION public.alert_incomplete_tech_sheets()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_notified integer := 0;
  v_sheet record;
  v_pref_muted boolean;
  v_pref_push boolean;
BEGIN
  -- Fichas rascunho/em_revisao sem atualização há 7+ dias.
  -- Ignora fichas já aprovadas e evita duplicar notificação diária
  -- (mesmo dia, mesmo owner, mesmo sheet, mesmo tipo).
  FOR v_sheet IN
    SELECT ts.id, ts.owner_id, ts.code, ts.version
      FROM public.tech_sheets ts
     WHERE ts.status IN ('rascunho','em_revisao')
       AND ts.updated_at <= now() - INTERVAL '7 days'
       AND NOT EXISTS (
         SELECT 1
           FROM public.push_notifications pn
          WHERE pn.owner_id = ts.owner_id
            AND COALESCE(pn.payload->>'sheetId', '') = ts.id::text
            AND pn.kind = 'control_tower'
            AND pn.created_at::date = CURRENT_DATE
       )
  LOOP
    SELECT muted, push_enabled
      INTO v_pref_muted, v_pref_push
      FROM public.notification_preferences
     WHERE user_id = v_sheet.owner_id
       AND category = 'tech_sheet'
     LIMIT 1;

    IF COALESCE(v_pref_muted, false) THEN
      CONTINUE;
    END IF;
    IF NOT COALESCE(v_pref_push, true) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.push_notifications (
      owner_id, device_id, title, body, link, kind, severity, payload, delivered_at
    ) VALUES (
      v_sheet.owner_id,
      NULL,
      'Ficha técnica incompleta',
      'A ficha ' || v_sheet.code || ' (v' || v_sheet.version || ') está incompleta há mais de 7 dias. Revise os blocos pendentes.',
      '/ficha-tecnica',
      'control_tower',
      'baixa',
      jsonb_build_object(
        'event', 'incompleta',
        'sheetId', v_sheet.id,
        'sheetCode', v_sheet.code
      ),
      now()
    );

    v_notified := v_notified + 1;
  END LOOP;

  RETURN v_notified;
END;
$$;

-- Permissões: executável apenas pelo agendador (service_role).
REVOKE ALL ON FUNCTION public.alert_incomplete_tech_sheets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alert_incomplete_tech_sheets() TO service_role;

-- Agendamento diário via pg_cron (extensão já habilitada em migrações anteriores).
-- Remove schedule antigo com o mesmo nome e recria para ser idempotente.
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('alert-incomplete-tech-sheets');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'alert-incomplete-tech-sheets',
  '0 7 * * *',  -- todo dia às 07:00 (UTC)
  $$SELECT public.alert_incomplete_tech_sheets();$$
);
