import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { generateText } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Persona = "development" | "pcp" | "marketing" | "command";
type DB = SupabaseClient<Database>;

const PERSONAS: Record<Persona, { label: string; system: string }> = {
  development: {
    label: "Coordenador de Desenvolvimento",
    system: `Você é um coordenador de desenvolvimento de coleções de moda, sênior.
Use APENAS os dados do contexto fornecido. Nunca invente números.
Responda em português, em markdown enxuto (máx. 12 linhas), com bullets curtos.
Quando citar um item, inclua o código entre crases. Termine com **Ação sugerida:** uma linha.`,
  },
  pcp: {
    label: "PCP Sênior",
    system: `Você é um PCP sênior de confecção. Use APENAS os dados do contexto.
Identifique gargalos, fila excessiva, lotes parados, OPs atrasadas e prioridades.
Responda em português, em markdown enxuto (máx. 12 linhas), bullets curtos.
Cite códigos entre crases. Termine com **Prioridade do dia:** uma linha.`,
  },
  marketing: {
    label: "Marketing Intelligence",
    system: `Você é um analista de marketing de produto de moda. Use APENAS os dados do contexto (espelho do ERP).
Recomende onde investir, qual coleção/canal/influencer está performando e qual produto ganhar tração.
Responda em português, markdown enxuto (máx. 12 linhas), bullets curtos.
Cite SKUs/canais entre crases. Termine com **Onde investir agora:** uma linha.`,
  },
  command: {
    label: "Comando",
    system: `Você é um copiloto operacional que transforma pedidos em **planos de ação** prontos para o usuário confirmar.
Use os dados do contexto quando úteis. Nunca execute — apenas proponha.
Responda em português, em markdown curto neste formato:

**Plano:** uma frase resumindo a intenção.

**Passos:**
- passo 1
- passo 2

**Tela sugerida:** caminho (ex.: \`/pedidos-compra\`, \`/pcp-kanban\`, \`/colecoes\`).

**Confirmação:** uma frase pedindo "Confirmar" ao usuário antes de executar.

Quando o pedido couber em uma destas ações executáveis, **adicione ao FIM** um bloco de código JSON exatamente neste formato (sem texto após):

\`\`\`json
{"action":{"kind":"create_rfq","title":"...","quantity":500,"unit":"m","needed_by":"2026-07-01","notes":"..."}}
\`\`\`

Tipos suportados:
- \`create_rfq\`: { title, quantity, unit?, needed_by? (YYYY-MM-DD), notes? }
- \`create_op\`: { sku, quantity, supplier_name?, due_date? (YYYY-MM-DD), notes? }
- \`block_supplier\`: { supplier_name, reason? }

Se faltar dado essencial (ex.: SKU, fornecedor), NÃO inclua o bloco JSON — apenas peça o dado em "Confirmação:". Nunca invente SKUs, fornecedores, IDs ou datas — use apenas o que o usuário escreveu.`,
  },
};

const Input = z.object({
  persona: z.enum(["development", "pcp", "marketing", "command"]),
  question: z.string().trim().min(3).max(500),
});

async function buildContext(supabase: DB, persona: Persona): Promise<string> {
  if (persona === "command") {
    const [{ count: opsAtivas }, { count: rfqsAbertas }, { count: protosPend }] = await Promise.all(
      [
        supabase
          .from("production_orders")
          .select("id", { count: "exact", head: true })
          .neq("status", "concluida")
          .neq("status", "cancelada"),
        supabase
          .from("rfq_requests")
          .select("id", { count: "exact", head: true })
          .in("status", ["aberta", "cotando"]),
        supabase
          .from("prototypes")
          .select("id", { count: "exact", head: true })
          .neq("stage", "aprovado")
          .neq("stage", "reprovado"),
      ],
    );
    return `# Contexto operacional
- OPs ativas: ${opsAtivas ?? 0}
- RFQs abertas/cotando: ${rfqsAbertas ?? 0}
- Pilotos pendentes: ${protosPend ?? 0}`;
  }

  const today = new Date();
  const iso30 = new Date(today.getTime() - 30 * 86400000).toISOString();
  const iso7 = new Date(today.getTime() - 7 * 86400000).toISOString();
  const todayISO = today.toISOString();

  if (persona === "development") {
    type Proto = { code: string; name: string | null; stage: string; updated_at: string };
    type Product = { id: string; name: string; sku: string; status: string; created_at: string };
    type Sheet = { product_id: string | null; status: string };
    const [{ data: protos }, { data: products }, { data: sheets }] = await Promise.all([
      supabase.from("prototypes").select("code, name, stage, updated_at").limit(80),
      supabase.from("products").select("id, name, sku, status, created_at").limit(120),
      supabase.from("tech_sheets").select("product_id, status").limit(200),
    ]);
    const protosT = (protos ?? []) as unknown as Proto[];
    const productsT = (products ?? []) as unknown as Product[];
    const sheetsT = (sheets ?? []) as unknown as Sheet[];
    const productsWithSheet = new Set(
      sheetsT.filter((s) => s.status === "aprovada").map((s) => s.product_id),
    );
    const semFicha = productsT.filter(
      (p) => p.status === "aprovado" && !productsWithSheet.has(p.id),
    );
    const pilotosPendentes = protosT.filter(
      (p) => p.stage !== "aprovado" && p.stage !== "reprovado",
    );
    const aprovadosRecentes = protosT.filter(
      (p) => p.stage === "aprovado" && p.updated_at > iso30,
    );
    return `# Contexto · Desenvolvimento (atualizado ${todayISO})
- Total de protótipos: ${protosT.length}
- Pilotos pendentes (não aprovados/reprovados): ${pilotosPendentes.length}
- Pilotos aprovados nos últimos 30 dias: ${aprovadosRecentes.length}
- Produtos aprovados SEM ficha técnica aprovada: ${semFicha.length}

## Top 10 pilotos pendentes (código · nome · etapa · atualizado)
${
  pilotosPendentes
    .slice(0, 10)
    .map(
      (p) => `- \`${p.code}\` · ${p.name ?? "—"} · ${p.stage} · ${p.updated_at?.slice(0, 10)}`,
    )
    .join("\n") || "- nenhum"
}

## Top 10 produtos sem ficha
${
  semFicha
    .slice(0, 10)
    .map((p) => `- \`${p.sku}\` · ${p.name}`)
    .join("\n") || "- nenhum"
}`;
  }

  if (persona === "pcp") {
    type Order = {
      code: string;
      stage: string;
      status: string;
      quantity: number | null;
      due_date: string | null;
      stage_updated_at: string | null;
      products: { name: string | null; sku: string | null } | null;
    };
    type Batch = { code: string; status: string; planned_quantity: number | null; produced_quantity: number | null; updated_at: string };
    const [{ data: orders }, { data: batches }] = await Promise.all([
      supabase
        .from("production_orders")
        .select("code, stage, status, quantity, due_date, stage_updated_at, products(name, sku)")
        .neq("status", "cancelada")
        .limit(300),
      supabase
        .from("production_batches")
        .select("code, status, planned_quantity, produced_quantity, updated_at")
        .limit(80),
    ]);
    const ordersT = (orders ?? []) as unknown as Order[];
    const batchesT = (batches ?? []) as unknown as Batch[];
    const now = Date.now();
    const atrasadas = ordersT.filter(
      (o) => o.stage !== "entregue" && o.due_date && new Date(o.due_date).getTime() < now,
    );
    const paradas = ordersT.filter(
      (o) =>
        o.stage !== "entregue" && o.stage_updated_at != null && now - new Date(o.stage_updated_at).getTime() > 5 * 86400000,
    );
    const stageMap = new Map<string, number>();
    ordersT
      .filter((o) => o.stage !== "entregue")
      .forEach((o) => stageMap.set(o.stage, (stageMap.get(o.stage) ?? 0) + (o.quantity ?? 0)));
    const filas = [...stageMap.entries()].sort((a, b) => b[1] - a[1]);

    return `# Contexto · PCP (atualizado ${todayISO})
- OPs ativas: ${ordersT.filter((o) => o.stage !== "entregue").length}
- OPs atrasadas: ${atrasadas.length}
- OPs paradas há mais de 5 dias: ${paradas.length}
- Lotes em produção: ${batchesT.filter((b) => b.status === "em_producao").length}

## Fila por setor (peças)
${filas.map(([s, q]) => `- ${s}: ${q}`).join("\n") || "- sem dados"}

## Top OPs atrasadas
${
  atrasadas
    .slice(0, 10)
    .map(
      (o) =>
        `- \`${o.code}\` · ${o.products?.name ?? "—"} · setor ${o.stage} · vence ${o.due_date}`,
    )
    .join("\n") || "- nenhuma"
}

## Top OPs paradas
${
  paradas
    .slice(0, 10)
    .map(
      (o) =>
        `- \`${o.code}\` · ${o.products?.name ?? "—"} · ${o.stage} · sem mover desde ${o.stage_updated_at?.slice(0, 10)}`,
    )
    .join("\n") || "- nenhuma"
}`;
  }

  // marketing
  type Sale30 = {
    sku: string | null;
    product_ref: string | null;
    channel: string | null;
    region: string | null;
    quantity: number | null;
    total_value: number | string | null;
    influencer_code: string | null;
    campaign_code: string | null;
    sold_at: string;
  };
  type Sale7 = { sku: string | null; quantity: number | null; total_value: number | string | null; channel: string | null };
  const [{ data: sales30Raw }, { data: sales7Raw }] = await Promise.all([
    supabase
      .from("erp_sales_mirror")
      .select(
        "sku, product_ref, channel, region, quantity, total_value, influencer_code, campaign_code, sold_at",
      )
      .gte("sold_at", iso30)
      .limit(2000),
    supabase
      .from("erp_sales_mirror")
      .select("sku, quantity, total_value, channel")
      .gte("sold_at", iso7)
      .limit(2000),
  ]);
  const sales30 = (sales30Raw ?? []) as unknown as Sale30[];
  const sales7 = (sales7Raw ?? []) as unknown as Sale7[];

  const byProduct = new Map<string, { units: number; revenue: number; name: string }>();
  sales30.forEach((s) => {
    const k = s.sku ?? s.product_ref ?? "—";
    const prev = byProduct.get(k) ?? { units: 0, revenue: 0, name: s.product_ref ?? k };
    prev.units += s.quantity ?? 0;
    prev.revenue += Number(s.total_value ?? 0);
    byProduct.set(k, prev);
  });
  const topProducts = [...byProduct.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 10);

  const byChannel = new Map<string, number>();
  sales30.forEach((s) =>
    byChannel.set(
      s.channel ?? "—",
      (byChannel.get(s.channel ?? "—") ?? 0) + Number(s.total_value ?? 0),
    ),
  );
  const byInfluencer = new Map<string, number>();
  sales30
    .filter((s): s is Sale30 & { influencer_code: string } => Boolean(s.influencer_code))
    .forEach((s) =>
      byInfluencer.set(
        s.influencer_code,
        (byInfluencer.get(s.influencer_code) ?? 0) + Number(s.total_value ?? 0),
      ),
    );
  const byRegion = new Map<string, number>();
  sales30.forEach((s) =>
    byRegion.set(
      s.region ?? "—",
      (byRegion.get(s.region ?? "—") ?? 0) + Number(s.total_value ?? 0),
    ),
  );

  const rev30 = sales30.reduce((s, x) => s + Number(x.total_value ?? 0), 0);
  const rev7 = sales7.reduce((s, x) => s + Number(x.total_value ?? 0), 0);

  const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

  return `# Contexto · Marketing (espelho ERP, atualizado ${todayISO})
- Receita últimos 7 dias: ${fmt(rev7)}
- Receita últimos 30 dias: ${fmt(rev30)}
- Pedidos no período: ${sales30.length}

## Top 10 produtos por receita (30d)
${topProducts.map(([sku, v]) => `- \`${sku}\` · ${v.units} un · ${fmt(v.revenue)}`).join("\n") || "- sem vendas"}

## Canais (30d)
${
  [...byChannel.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([c, v]) => `- \`${c}\`: ${fmt(v)}`)
    .join("\n") || "- sem dados"
}

## Influencers (30d)
${
  [...byInfluencer.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([i, v]) => `- \`${i}\`: ${fmt(v)}`)
    .join("\n") || "- sem dados"
}

## Regiões (30d)
${
  [...byRegion.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([r, v]) => `- ${r}: ${fmt(v)}`)
    .join("\n") || "- sem dados"
}`;
}

export const askInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const persona = PERSONAS[data.persona as Persona];
    const ctx = await buildContext(context.supabase, data.persona as Persona);

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    try {
      const res = await generateText({
        model,
        system: persona.system,
        prompt: `${ctx}\n\n---\n\n## Pergunta\n${data.question}\n\nResponda usando somente os dados acima.`,
        temperature: 0.3,
      });
      return { text: res.text, persona: persona.label };
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      const status = err?.statusCode ?? err?.lastError?.statusCode;
      if (status === 429 || /Too Many Requests/i.test(msg)) {
        return {
          text: "**Limite de requisições atingido.** A IA está recebendo muitas chamadas no momento. Aguarde alguns segundos e tente novamente.",
          persona: persona.label,
          error: "rate_limited" as const,
        };
      }
      if (status === 402 || /Payment Required/i.test(msg)) {
        return {
          text: "**Créditos de IA esgotados.** Adicione créditos no workspace para continuar usando o assistente.",
          persona: persona.label,
          error: "credits_exhausted" as const,
        };
      }
      throw err;
    }
  });
