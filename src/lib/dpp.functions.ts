import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const IdInput = z.object({ id: z.string().uuid() });

// Public read of a passport by dpp_record id (preferred) or product id (fallback)
export const getPublicPassport = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Try as dpp_record id first
    const { data: rec } = await supabaseAdmin
      .from("dpp_records")
      .select(
        "id, product_id, version, status, snapshot, hash, composition, origin, care_instructions, repairability_score, certifications, published_at",
      )
      .eq("id", data.id)
      .eq("status", "publicado")
      .maybeSingle();

    let recordId = rec?.id ?? null;
    let productId = rec?.product_id ?? data.id;
    const snap = (rec?.snapshot as Record<string, unknown> | undefined) ?? {};

    // If no record matched, attempt by product id (latest published)
    if (!rec) {
      const { data: latest } = await supabaseAdmin
        .from("dpp_records")
        .select(
          "id, product_id, snapshot, composition, origin, care_instructions, certifications, version, published_at",
        )
        .eq("product_id", data.id)
        .eq("status", "publicado")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest) {
        recordId = latest.id;
        productId = latest.product_id;
        Object.assign(snap, latest.snapshot ?? {});
      }
    }

    const { data: product, error } = await supabaseAdmin
      .from("products")
      .select("id, sku, name, category, image_url, collection_id, collections(name, season, year)")
      .eq("id", productId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!product) return null;

    let h = 0;
    for (let i = 0; i < product.id.length; i++) h = (h * 31 + product.id.charCodeAt(i)) | 0;
    h = Math.abs(h);
    const CERTS = ["GOTS · OEKO-TEX", "OEKO-TEX", "BCI · OEKO-TEX", "GOTS", "European Flax"];
    const ORIGINS = ["Brasil · SP", "Brasil · MG", "Brasil · SC", "Portugal", "Itália"];
    const STAGES = ["Fiação", "Tecelagem", "Tinturaria", "Confecção", "Acabamento", "Distribuição"];

    // Fire and forget view log
    if (recordId) {
      await supabaseAdmin
        .from("dpp_views")
        .insert({ dpp_record_id: recordId, product_id: productId });
    }

    return {
      id: product.id,
      record_id: recordId,
      version: rec?.version ?? 1,
      sku: product.sku,
      name: product.name,
      category: product.category,
      image_url: product.image_url,
      collection:
        (product as { collections?: { name: string; season: string; year: number } | null })
          .collections ?? null,
      lote: `L-${String(h % 9999).padStart(4, "0")}`,
      emitidos: 100 + (h % 500),
      co2: (snap.co2 as string) ?? (2 + (h % 70) / 10).toFixed(1),
      cert: (rec?.certifications?.[0] as string) ?? CERTS[h % CERTS.length],
      origem: rec?.origin ?? ORIGINS[h % ORIGINS.length],
      composition: rec?.composition ?? null,
      care: rec?.care_instructions ?? null,
      repairability: rec?.repairability_score ?? null,
      published_at: rec?.published_at ?? null,
      stages: STAGES,
    };
  });

const PublishInput = z.object({
  product_id: z.string().uuid(),
  composition: z.string().max(1000).optional(),
  origin: z.string().max(255).optional(),
  care_instructions: z.string().max(1000).optional(),
  repairability_score: z.number().int().min(0).max(10).optional(),
  certifications: z.array(z.string().min(1).max(100)).max(20).optional(),
});

export const publishPassport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PublishInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prod, error: pe } = await supabase
      .from("products")
      .select("id, sku, name, owner_id")
      .eq("id", data.product_id)
      .maybeSingle();
    if (pe) throw new Error(pe.message);
    if (!prod || prod.owner_id !== userId) throw new Error("Produto não encontrado");

    const { data: prev } = await supabase
      .from("dpp_records")
      .select("version")
      .eq("product_id", data.product_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = (prev?.version ?? 0) + 1;

    const snapshot = {
      sku: prod.sku,
      name: prod.name,
      composition: data.composition ?? null,
      origin: data.origin ?? null,
      care_instructions: data.care_instructions ?? null,
      repairability_score: data.repairability_score ?? null,
      certifications: data.certifications ?? [],
      published_at: new Date().toISOString(),
    };

    const payload = JSON.stringify(snapshot);
    const { createHash } = await import("crypto");
    const hash = createHash("sha256").update(payload).digest("hex");

    const { data: rec, error } = await supabase
      .from("dpp_records")
      .insert({
        owner_id: userId,
        product_id: data.product_id,
        version: nextVersion,
        status: "publicado",
        snapshot,
        hash,
        composition: data.composition,
        origin: data.origin,
        care_instructions: data.care_instructions,
        repairability_score: data.repairability_score,
        certifications: data.certifications,
        published_at: new Date().toISOString(),
      })
      .select("id, version, hash")
      .single();
    if (error) throw new Error(error.message);
    return rec;
  });

export const revokePassport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("dpp_records")
      .update({ status: "revogado", revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
