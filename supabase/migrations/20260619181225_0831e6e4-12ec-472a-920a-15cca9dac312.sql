-- 1. Ensure pgcrypto for digest()
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. Add token_hash column
ALTER TABLE public.supplier_portal_tokens
  ADD COLUMN IF NOT EXISTS token_hash text;

-- 3. Backfill from existing raw token so live portal links keep working
UPDATE public.supplier_portal_tokens
   SET token_hash = encode(extensions.digest(token, 'sha256'), 'hex')
 WHERE token_hash IS NULL AND token IS NOT NULL;

-- 4. Constraints + index
ALTER TABLE public.supplier_portal_tokens
  ALTER COLUMN token_hash SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS supplier_portal_tokens_token_hash_uidx
  ON public.supplier_portal_tokens(token_hash);

-- 5. Replace the immutable-fields trigger to guard token_hash instead of token
CREATE OR REPLACE FUNCTION public.supplier_portal_tokens_protect_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.token_hash IS DISTINCT FROM OLD.token_hash
     OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
     OR NEW.supplier_id IS DISTINCT FROM OLD.supplier_id THEN
    RAISE EXCEPTION 'token_hash, owner_id and supplier_id are immutable on supplier_portal_tokens';
  END IF;
  RETURN NEW;
END $$;

-- 6. Drop the raw token column — no longer stored anywhere
ALTER TABLE public.supplier_portal_tokens
  DROP COLUMN IF EXISTS token;