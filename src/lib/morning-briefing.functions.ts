import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { generateText } from "ai";

const SYSTEM = `Você é o Chefe de Gabinete de uma marca de moda. Receba um snapshot operacional e produza o **briefing matinal** do CEO/Diretor.
Responda em **português brasileiro**, em **markdown puro**, no formato exato:

**🌅 Resumo do dia** (2 linhas — humor geral da operação)
**🔥 Top 3 ações de hoje** (numerado; cada item: ação + impacto esperado + quem aciona)
**⚠️ Riscos a monitorar** (lista curta — gargalos, atrasos críticos)
**🎯 Oportunidade** (1 linha — algo positivo a explorar hoje)

Sem disclaimers. Máximo 14 linhas. Seja específico — use nomes, números, prazos do snapshot.`;

export type MorningBriefing = {
  generatedAt: string;
  markdown: string;
  snapshot: {
    productionOpen: number;
    productionLate: number;
    prototypesPending: number;
    capaOpen: number;
    launchingCollections: number;
    costAlerts: number;
    lowStock: number;
  };
};

export const getMorningBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MorningBriefing> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");
    const { supabase, userId } = context;

    const sevenAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const twentyOneAgo = new Date(Date.now() - 21 * 86400000).toISOString();
    const today = new Date().toISOString().slice(0, 10);

    const [po, protos, capa, cols, ts, targets, inv] = await Promise.all([
      supabase
        .from("production_orders")
        .select("id, code, status, due_date, stage_updated_at")
        .eq("owner_id", userId)
        .in("status", ["aguardando", "em_producao"]),
      supabase
        .from("prototypes")
        .select("id, code, name, stage, updated_at")
        .eq("owner_id", userId)
        .neq("stage", "aprovado")
        .lt("updated_at", twentyOneAgo),
      supabase
        .from("quality_capa")
        .select("id, title, severity, due_date")
        .eq("owner_id", userId)
        .eq("status", "aberta"),
      supabase
        .from("collections")
        .select("id, name, status_changed_at")
        .eq("owner_id", userId)
        .eq("status", "lancamento")
        .gte("status_changed_at", sevenAgo),
      supabase
        .from("tech_sheets")
        .select("id, product_id, cost_price")
        .eq("owner_id", userId)
        .eq("status", "aprovada")
        .not("product_id", "is", null),
      supabase
        .from("product_target_costs")
        .select("product_id, target_cost")
        .eq("owner_id", userId),
      supabase
        .from("inventory_items")
        .select("name, balance, minimum")
        .eq("owner_id", userId),
    ]);

    const targetMap = new Map((targets.data ?? []).map((t: any) => [t.product_id, Number(t.target_cost ?? 0)]));
    const costAlerts = (ts.data ?? []).filter((t: any) => {
      const tg = targetMap.get(t.product_id);
      if (!tg || tg <= 0) return false;
      return Number(t.cost_price ?? 0) > tg * 1.1;
    }).length;

    const productionLate = (po.data ?? []).filter(
      (o: any) => o.due_date && o.due_date < today,
    ).length;

    const lowStock = (inv.data ?? []).filter(
      (i: any) => Number(i.balance ?? 0) <= Number(i.minimum ?? 0),
    ).length;

    const snapshot = {
      productionOpen: po.data?.length ?? 0,
      productionLate,
      prototypesPending: protos.data?.length ?? 0,
      capaOpen: capa.data?.length ?? 0,
      launchingCollections: cols.data?.length ?? 0,
      costAlerts,
      lowStock,
    };

    const topLatePo = (po.data ?? [])
      .filter((o: any) => o.due_date && o.due_date < today)
      .slice(0, 3)
      .map((o: any) => `${o.code} (vence ${o.due_date})`)
      .join(", ");

    const topCapa = (capa.data ?? [])
      .slice(0, 3)
      .map((c: any) => `${c.title} [${c.severity}]`)
      .join(", ");

    const userPrompt = `Snapshot operacional de hoje:
- Ordens de produção abertas: ${snapshot.productionOpen} (atrasadas: ${snapshot.productionLate}) ${topLatePo ? `· top atrasos: ${topLatePo}` : ""}
- Protótipos parados >21d: ${snapshot.prototypesPending}
- CAPAs abertas: ${snapshot.capaOpen} ${topCapa ? `· ${topCapa}` : ""}
- Coleções em lançamento esta semana: ${snapshot.launchingCollections}
- Produtos com custo >10% acima do alvo: ${snapshot.costAlerts}
- Itens de estoque abaixo do mínimo: ${snapshot.lowStock}

Gere o briefing matinal.`;

    const provider = createLovableAiGatewayProvider(apiKey);
    const { text } = await generateText({
      model: provider("google/gemini-2.5-flash"),
      system: SYSTEM,
      prompt: userPrompt,
    });

    return {
      generatedAt: new Date().toISOString(),
      markdown: text,
      snapshot,
    };
  });
