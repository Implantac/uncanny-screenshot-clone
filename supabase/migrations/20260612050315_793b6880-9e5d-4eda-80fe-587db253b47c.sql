
-- Tighten SELECT policies to owner-only across tenant tables
DROP POLICY IF EXISTS "auth read b2b_orders" ON public.b2b_orders;
CREATE POLICY "owner select b2b_orders" ON public.b2b_orders FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Authenticated users can view collections" ON public.collections;
CREATE POLICY "Owners can view their collections" ON public.collections FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "view accounts" ON public.financial_accounts;
CREATE POLICY "select own accounts" ON public.financial_accounts FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "view inventory" ON public.inventory_items;
CREATE POLICY "select own inventory" ON public.inventory_items FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "view campaigns" ON public.marketing_campaigns;
CREATE POLICY "select own campaigns" ON public.marketing_campaigns FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "auth read production_orders" ON public.production_orders;
CREATE POLICY "owner select production_orders" ON public.production_orders FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;
CREATE POLICY "Owners can view their products" ON public.products FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "auth read prototypes" ON public.prototypes;
CREATE POLICY "owner select prototypes" ON public.prototypes FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON public.suppliers;
CREATE POLICY "Owners can view their suppliers" ON public.suppliers FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "auth read tech_sheets" ON public.tech_sheets;
CREATE POLICY "owner select tech_sheets" ON public.tech_sheets FOR SELECT USING (auth.uid() = owner_id);

-- Storage: restrict SELECT to folder owner (path: <uid>/<file>)
DROP POLICY IF EXISTS "Authenticated can view collection covers" ON storage.objects;
CREATE POLICY "Owners can view their collection covers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'collection-covers' AND (storage.foldername(name))[1] = (auth.uid())::text);

DROP POLICY IF EXISTS "product-images: authenticated read" ON storage.objects;
CREATE POLICY "product-images: owner select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = (auth.uid())::text);

-- Lock down SECURITY DEFINER trigger helpers; they are only called by triggers,
-- never directly by signed-in users.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
