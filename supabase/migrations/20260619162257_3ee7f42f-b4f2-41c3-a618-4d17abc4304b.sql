CREATE OR REPLACE FUNCTION public.collections_lifecycle_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  prod RECORD;
  marker text;
  next_code text;
  brief_marker text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  NEW.status_changed_at := now();

  IF NEW.status = 'producao' THEN
    FOR prod IN
      SELECT cp.product_id, p.sku, p.name
        FROM public.collection_products cp
        JOIN public.products p ON p.id = cp.product_id
       WHERE cp.collection_id = NEW.id
         AND cp.owner_id = NEW.owner_id
         AND cp.role <> 'nos'
    LOOP
      marker := '[col:' || NEW.id::text || ':' || prod.product_id::text || ']';
      IF NOT EXISTS (
        SELECT 1 FROM public.production_orders
         WHERE owner_id = NEW.owner_id
           AND notes LIKE '%' || marker || '%'
      ) THEN
        next_code := 'OP-' || to_char(now(), 'YYYYMMDD') || '-' ||
                     substr(replace(prod.product_id::text,'-',''),1,6);
        INSERT INTO public.production_orders(
          owner_id, product_id, code, quantity, status, stage, notes
        ) VALUES (
          NEW.owner_id, prod.product_id, next_code, 0,
          'aguardando', 'cad',
          'Gerada automaticamente da coleção ' || NEW.name || ' ' || marker
        );
      END IF;
    END LOOP;
  END IF;

  -- Closed-Loop Coleção → Marketing: auto-criar brief ao entrar em lancamento
  IF NEW.status = 'lancamento' THEN
    brief_marker := '[col-launch:' || NEW.id::text || ']';
    IF NOT EXISTS (
      SELECT 1 FROM public.marketing_briefs
       WHERE owner_id = NEW.owner_id
         AND collection_id = NEW.id
         AND lifecycle_trigger = brief_marker
    ) THEN
      INSERT INTO public.marketing_briefs(
        owner_id, collection_id, title, objective, target_audience,
        key_message, tone, channels, status, lifecycle_trigger
      ) VALUES (
        NEW.owner_id, NEW.id,
        'Lançamento: ' || NEW.name,
        'Lançar coleção ' || COALESCE(NEW.season,'') || ' ' || COALESCE(NEW.year::text,'') || ' com awareness e conversão',
        'Público-alvo da coleção ' || NEW.name,
        'Apresentar a nova coleção com identidade da temporada',
        'aspiracional',
        ARRAY['instagram','tiktok','email','site']::text[],
        'rascunho',
        brief_marker
      );

      INSERT INTO public.marketing_notifications(owner_id, kind, title, body, link, ref_id)
      SELECT us.user_id, 'collection_launch_brief',
             'Brief auto-criado: ' || NEW.name,
             'Coleção entrou em lançamento — revise o brief gerado',
             '/marketing', NEW.id
        FROM public.user_sectors us
       WHERE us.sector = 'marketing' AND us.user_id = NEW.owner_id;
    END IF;
  END IF;

  IF NEW.status IN ('lancamento', 'entregue') THEN
    UPDATE public.product_lifecycle
       SET state = 'active'
     WHERE collection_id = NEW.id
       AND state IN ('planned', 'markdown')
       AND owner_id = NEW.owner_id;
  END IF;

  IF NEW.status = 'markdown' THEN
    UPDATE public.product_lifecycle pl
       SET state = 'markdown'
      FROM public.collection_products cp
     WHERE pl.collection_id = NEW.id
       AND pl.product_id = cp.product_id
       AND cp.collection_id = NEW.id
       AND cp.role <> 'nos'
       AND pl.state <> 'nos_permanent'
       AND pl.owner_id = NEW.owner_id;
  END IF;

  IF NEW.status = 'descontinuada' THEN
    UPDATE public.product_lifecycle pl
       SET state = 'discontinued'
      FROM public.collection_products cp
     WHERE pl.collection_id = NEW.id
       AND pl.product_id = cp.product_id
       AND cp.collection_id = NEW.id
       AND cp.role <> 'nos'
       AND pl.state <> 'nos_permanent'
       AND pl.owner_id = NEW.owner_id;

    DELETE FROM public.collection_products
     WHERE collection_id = NEW.id
       AND role <> 'nos'
       AND owner_id = NEW.owner_id;
  END IF;

  RETURN NEW;
END $function$;