
CREATE OR REPLACE FUNCTION public.enqueue_mention_pushes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mentioned uuid;
  product_name text;
  actor_email text;
BEGIN
  IF NEW.mentioned_user_ids IS NULL OR array_length(NEW.mentioned_user_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO product_name FROM public.products WHERE id = NEW.product_id;
  SELECT email INTO actor_email FROM auth.users WHERE id = NEW.author_id;

  FOREACH mentioned IN ARRAY NEW.mentioned_user_ids LOOP
    IF mentioned = NEW.author_id THEN CONTINUE; END IF;
    INSERT INTO public.push_notifications (
      owner_id, device_id, title, body, link, kind, severity, payload
    ) VALUES (
      mentioned,
      NULL,
      'Você foi mencionado' || COALESCE(' por ' || actor_email, ''),
      LEFT(NEW.body, 240),
      '/produto/' || NEW.product_id::text,
      'mention',
      'media',
      jsonb_build_object(
        'product_id', NEW.product_id,
        'comment_id', NEW.id,
        'product_name', product_name
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_mention_pushes ON public.product_timeline_comments;
CREATE TRIGGER trg_enqueue_mention_pushes
AFTER INSERT ON public.product_timeline_comments
FOR EACH ROW EXECUTE FUNCTION public.enqueue_mention_pushes();
