import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { generateText } from "ai";
import { z } from "zod";

const SuggestInput = z.object({
  collection_id: z.string().uuid(),
});

export type ShipmentSuggestion = {
  product_id: string;
  product_name: string;
  product_sku: string | null;
  influencer_id: string;
  influencer_name: string;
  region: string | null;
  score: number;
  reason: string;
};

const SYSTEM = `Você é estrategista de marketing de moda. Receberá:
1) produtos de uma nova coleção
2) influenciadores cadastrados (com cidade/estado e segmento)
3) histórico de vendas por região (espelho ERP)
4) histórico de envios anteriores com uplift (vendas_antes vs vendas_depois)

Sua tarefa: recomendar pares (produto × influenciador) com maior chance de uplift.
Use apenas os dados fornecidos. Responda EXCLUSIVAMENTE com JSON válido no formato:
{"suggestions":[{"product_id":"...","influencer_id":"...","score":0-100,"reason":"texto curto"}]}
Máximo 8 sugestões. Score reflete aderência do produto à região/segmento do influenciador e histórico de uplift.`;

export const suggestShipments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SuggestInput.parse(d))
  .handler(async ({ data, context }): Promise<{ suggestions: ShipmentSuggestion[] }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");
    const supabase = context.supabase;

    type ProductRow = { id: string; name: string; sku: string | null; category: string | null };
    type InfluencerRow = { id: string; nome: string; cidade: string | null; estado: string | null; segmento: string | null; seguidores: number | null; engajamento: number | string | null };
    type SaleRow = { product_ref: string | null; region: string | null; quantity: number | null; total_value: number | string | null };
    type HistoryRow = { influencer_id: string; product_id: string; sales_before: number | string | null; sales_after: number | string | null; region: string | null };

    const [
      { data: collection },
      { data: products },
      { data: influencers },
      { data: sales },
      { data: history },
    ] = await Promise.all([
      supabase
        .from("collections")
        .select("id, name, season, year")
        .eq("id", data.collection_id)
        .maybeSingle(),
      supabase
        .from("products")
        .select("id, name, sku, category")
        .eq("collection_id", data.collection_id)
        .limit(60),
      supabase
        .from("influencers")
        .select("id, nome, cidade, estado, segmento, seguidores, engajamento")
        .limit(80),
      supabase
        .from("erp_sales_mirror")
        .select("product_ref, region, quantity, total_value")
        .gte("sold_at", new Date(Date.now() - 90 * 86400000).toISOString())
        .limit(2000),
      supabase
        .from("influencer_shipments")
        .select("influencer_id, product_id, sales_before, sales_after, region")
        .limit(500),
    ]);

    if (!collection) throw new Error("Coleção não encontrada");
    const productsT = (products ?? []) as unknown as ProductRow[];
    const influencersT = (influencers ?? []) as unknown as InfluencerRow[];
    if (!productsT.length) return { suggestions: [] };
    if (!influencersT.length) return { suggestions: [] };

    const salesByRegion = new Map<string, number>();
    ((sales ?? []) as unknown as SaleRow[]).forEach((s) => {
      const k = (s.region ?? "—") as string;
      salesByRegion.set(k, (salesByRegion.get(k) ?? 0) + Number(s.total_value ?? 0));
    });

    const ctx = `# Coleção
${collection.name} · ${collection.season ?? ""} ${collection.year ?? ""}

# Produtos da coleção (id · sku · nome · categoria)
${productsT.map((p) => `- ${p.id} · \`${p.sku ?? "—"}\` · ${p.name} · ${p.category ?? "—"}`).join("\n")}

# Influenciadores (id · nome · cidade/UF · segmento · seguidores · engaj%)
${influencersT.map((i) => `- ${i.id} · ${i.nome} · ${i.cidade ?? "—"}/${i.estado ?? "—"} · ${i.segmento ?? "—"} · ${i.seguidores ?? 0} · ${Number(i.engajamento ?? 0).toFixed(1)}`).join("\n")}

# Receita por região últimos 90 dias
${
  [...salesByRegion.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([r, v]) => `- ${r}: R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`)
    .join("\n") || "- sem dados"
}

# Histórico de envios anteriores (uplift = depois - antes)
${
  ((history ?? []) as unknown as HistoryRow[])
    .slice(0, 60)
    .map(
      (h) =>
        `- inf=${h.influencer_id} prod=${h.product_id} região=${h.region ?? "—"} uplift=${(Number(h.sales_after ?? 0) - Number(h.sales_before ?? 0)).toFixed(0)}`,
    )
    .join("\n") || "- nenhum"
}`;

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");
    const res = await generateText({
      model,
      system: SYSTEM,
      prompt: ctx,
      temperature: 0.3,
    });

    let parsed: {
      suggestions: { product_id: string; influencer_id: string; score: number; reason: string }[];
    } = { suggestions: [] };
    try {
      const m = res.text.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    } catch {
      /* ignore */
    }

    const pMap = new Map<string, ProductRow>(productsT.map((p) => [p.id, p]));
    const iMap = new Map<string, InfluencerRow>(influencersT.map((i) => [i.id, i]));

    const suggestions: ShipmentSuggestion[] = (parsed.suggestions ?? [])
      .filter((s) => pMap.has(s.product_id) && iMap.has(s.influencer_id))
      .slice(0, 8)
      .map((s) => {
        const p = pMap.get(s.product_id)!;
        const i = iMap.get(s.influencer_id)!;
        return {
          product_id: s.product_id,
          product_name: p.name,
          product_sku: p.sku ?? null,
          influencer_id: s.influencer_id,
          influencer_name: i.nome,
          region: i.estado ?? null,
          score: Math.max(0, Math.min(100, Number(s.score) || 0)),
          reason: String(s.reason ?? "").slice(0, 240),
        };
      });

    return { suggestions };
  });
