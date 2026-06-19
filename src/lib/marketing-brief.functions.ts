import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { generateText } from "ai";
import { z } from "zod";

const SYSTEM = `Você é um Diretor de Marketing de moda. Receba um brief + contexto de coleção/produto/lifecycle e gere um plano de campanha **acionável**.
Responda em **português brasileiro**, em **markdown puro**, no formato exato:

**Resumo executivo** (2 linhas)
**Big idea** (1 linha)
**Mix de canais** (lista — canal: % do budget, formato sugerido)
**Cronograma** (3 fases: teaser / lançamento / sustentação — com datas relativas)
**Conteúdo prioritário** (3 peças concretas)
**KPI alvo (30d)** (ROAS, CPA, alcance, conversão)
**Riscos & mitigação** (1 linha)

Sem disclaimers. Máximo 18 linhas.`;

const Input = z.object({
  briefId: z.string().uuid(),
});

export const generateBriefPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const { supabase, userId } = context;

    const { data: brief, error } = await supabase
      .from("marketing_briefs")
      .select("*")
      .eq("id", data.briefId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!brief) throw new Error("Brief não encontrado");

    let collectionCtx = "";
    if (brief.collection_id) {
      const { data: col } = await supabase
        .from("collections")
        .select("name, season, year, status, status_changed_at")
        .eq("id", brief.collection_id)
        .maybeSingle();
      if (col) {
        collectionCtx = `\n## Coleção\n- Nome: ${col.name}\n- Temporada: ${col.season ?? "n/d"} ${col.year ?? ""}\n- Status lifecycle: ${col.status}\n- Mudou em: ${col.status_changed_at ?? "n/d"}`;
      }
    }

    let productCtx = "";
    if (brief.product_id) {
      const { data: prod } = await supabase
        .from("products")
        .select("sku, name, cost_price")
        .eq("id", brief.product_id)
        .maybeSingle();
      if (prod) {
        productCtx = `\n## Produto âncora\n- SKU: ${prod.sku}\n- Nome: ${prod.name}\n- Custo: R$ ${prod.cost_price ?? 0}`;
      }
    }

    const prompt = `## Brief
- Título: ${brief.title}
- Objetivo: ${brief.objective}
- Público-alvo: ${brief.target_audience ?? "n/d"}
- Mensagem-chave: ${brief.key_message ?? "n/d"}
- Tom: ${brief.tone ?? "n/d"}
- Canais sugeridos: ${(brief.channels ?? []).join(", ") || "n/d"}
- Budget: R$ ${brief.budget ?? 0}
- KPI alvo: ${brief.kpi_target ?? "n/d"}
- Gatilho lifecycle: ${brief.lifecycle_trigger ?? "n/d"}
${collectionCtx}${productCtx}

Gere o plano agora.`;

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");
    const res = await generateText({ model, system: SYSTEM, prompt, temperature: 0.6 });

    const ai_plan = { text: res.text, generated_at: new Date().toISOString() };
    await supabase
      .from("marketing_briefs")
      .update({ ai_plan, status: "plano_gerado" })
      .eq("id", data.briefId)
      .eq("owner_id", userId);

    return { text: res.text };
  });

const PromoteInput = z.object({ briefId: z.string().uuid() });

export const promoteBriefToCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => PromoteInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: brief, error } = await supabase
      .from("marketing_briefs")
      .select("*")
      .eq("id", data.briefId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!brief) throw new Error("Brief não encontrado");
    if (brief.campaign_id) return { campaignId: brief.campaign_id, reused: true };

    const channel = (brief.channels?.[0] ?? "instagram") as string;
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + 30);

    const { data: camp, error: cErr } = await supabase
      .from("marketing_campaigns")
      .insert({
        owner_id: userId,
        name: brief.title,
        channel,
        start_date: today.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
        investment: brief.budget ?? 0,
        status: "programada",
        notes: `Gerada do brief ${brief.id}`,
        product_id: brief.product_id,
        collection_id: brief.collection_id,
      })
      .select("id")
      .single();
    if (cErr) throw cErr;

    await supabase
      .from("marketing_briefs")
      .update({ campaign_id: camp.id, status: "campanha_criada" })
      .eq("id", data.briefId)
      .eq("owner_id", userId);

    return { campaignId: camp.id, reused: false };
  });

export const suggestLifecycleBriefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: collections } = await supabase
      .from("collections")
      .select("id, name, status, season, year, status_changed_at")
      .eq("owner_id", userId)
      .in("status", ["lancamento", "entregue", "markdown"])
      .order("status_changed_at", { ascending: false })
      .limit(20);

    const { data: existing } = await supabase
      .from("marketing_briefs")
      .select("collection_id, lifecycle_trigger")
      .eq("owner_id", userId);

    const taken = new Set(
      (existing ?? [])
        .filter((b) => b.collection_id && b.lifecycle_trigger)
        .map((b) => `${b.collection_id}:${b.lifecycle_trigger}`),
    );

    const suggestions = (collections ?? [])
      .map((c) => {
        const trigger = c.status;
        if (taken.has(`${c.id}:${trigger}`)) return null;
        let objective = "";
        let title = "";
        if (trigger === "lancamento") {
          objective = "Maximizar buzz e sell-in nos primeiros 14 dias";
          title = `Lançamento ${c.name}`;
        } else if (trigger === "entregue") {
          objective = "Acelerar sell-out full-price antes do markdown";
          title = `Sustentação ${c.name}`;
        } else {
          objective = "Liquidar estoque com margem mínima protegida";
          title = `Markdown ${c.name}`;
        }
        return {
          collectionId: c.id,
          collectionName: c.name,
          trigger,
          title,
          objective,
          changedAt: c.status_changed_at,
        };
      })
      .filter(Boolean);

    return { suggestions };
  });
