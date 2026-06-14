import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({ id: z.string().uuid() });

export const getPublicPassport = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: product, error } = await supabaseAdmin
      .from("products")
      .select("id, sku, name, category, image_url, collection_id, collections(name, season, year)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!product) return null;
    // Build a deterministic passport from the product id
    let h = 0;
    for (let i = 0; i < product.id.length; i++) h = (h * 31 + product.id.charCodeAt(i)) | 0;
    h = Math.abs(h);
    const CERTS = ["GOTS · OEKO-TEX", "OEKO-TEX", "BCI · OEKO-TEX", "GOTS", "European Flax"];
    const ORIGINS = ["Brasil · SP", "Brasil · MG", "Brasil · SC", "Portugal", "Itália"];
    const STAGES = ["Fiação", "Tecelagem", "Tinturaria", "Confecção", "Acabamento", "Distribuição"];
    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      image_url: product.image_url,
      collection: (product as { collections?: { name: string; season: string; year: number } | null }).collections ?? null,
      lote: `L-${String(h % 9999).padStart(4, "0")}`,
      emitidos: 100 + (h % 500),
      co2: (2 + ((h % 70) / 10)).toFixed(1),
      cert: CERTS[h % CERTS.length],
      origem: ORIGINS[h % ORIGINS.length],
      stages: STAGES,
    };
  });
