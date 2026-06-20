/**
 * Cost Watch — Engenharia
 * Cruza custo aprovado (tech_sheets.cost_price status='aprovada')
 * com custo-meta (product_target_costs.target_cost) e identifica produtos
 * que estouram a meta. IA aponta causa provável (material × MOD × overhead).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CostWatchItem = {
  productId: string;
  sku: string | null;
  name: string;
  imageUrl: string | null;
  targetCost: number;
  approvedCost: number;
  materialsCost: number;
  laborCost: number;
  gapAbs: number;
  gapPct: number;
  status: "ok" | "atencao" | "estouro" | "sem_meta" | "sem_ficha";
  driver: "material" | "mod" | "overhead" | "indefinido";
  hint: string;
};

export type CostWatchReport = {
  items: CostWatchItem[];
  summary: {
    total: number;
    estouro: number;
    atencao: number;
    sem_meta: number;
    avgGapPct: number;
  };
  insights: string[];
};

export const getCostWatch = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CostWatchReport> => {
    const sb = context.supabase;

    const [{ data: products }, { data: sheets }, { data: targets }] = await Promise.all([
      sb.from("products").select("id, sku, name, image_url").limit(500),
      sb
        .from("tech_sheets")
        .select("product_id, cost_price, materials_cost, labor_cost, status, updated_at")
        .eq("status", "aprovada"),
      sb.from("product_target_costs").select("product_id, target_cost"),
    ]);

    type SheetRow = {
      product_id: string | null;
      cost_price: number | null;
      materials_cost: number | null;
      labor_cost: number | null;
      status: string;
      updated_at: string;
    };
    type TargetRow = { product_id: string; target_cost: number | null };
    type ProductRow = { id: string; sku: string | null; name: string; image_url: string | null };

    // pega ficha mais recente por produto
    const sheetBy = new Map<string, SheetRow>();
    ((sheets ?? []) as SheetRow[]).forEach((s) => {
      if (!s.product_id) return;
      const cur = sheetBy.get(s.product_id);
      if (!cur || new Date(s.updated_at) > new Date(cur.updated_at)) {
        sheetBy.set(s.product_id, s);
      }
    });
    const targetBy = new Map<string, number>(
      ((targets ?? []) as TargetRow[]).map((t) => [t.product_id, Number(t.target_cost ?? 0)]),
    );

    const items: CostWatchItem[] = [];
    ((products ?? []) as ProductRow[]).forEach((p) => {
      const target = Number(targetBy.get(p.id) ?? 0);
      const sheet = sheetBy.get(p.id);
      const approved = Number(sheet?.cost_price ?? 0);
      const mat = Number(sheet?.materials_cost ?? 0);
      const lab = Number(sheet?.labor_cost ?? 0);

      let status: CostWatchItem["status"];
      let hint: string;
      let driver: CostWatchItem["driver"] = "indefinido";

      if (!sheet) {
        status = "sem_ficha";
        hint = "Sem ficha técnica aprovada — engenharia precisa fechar custo.";
      } else if (target <= 0) {
        status = "sem_meta";
        hint = "Sem custo-meta cadastrado — definir em Target Costing.";
      } else {
        const gapPct = ((approved - target) / target) * 100;
        // driver = maior peso relativo ao custo total
        const overhead = approved - mat - lab;
        const parts = { material: mat, mod: lab, overhead };
        driver = (Object.entries(parts).sort((a, b) => b[1] - a[1])[0]?.[0] ??
          "indefinido") as CostWatchItem["driver"];

        if (gapPct <= 0) {
          status = "ok";
          hint = `Dentro da meta (${gapPct.toFixed(1)}%). Margem preservada.`;
        } else if (gapPct < 10) {
          status = "atencao";
          hint = `+${gapPct.toFixed(1)}% acima da meta. Maior peso: ${driver}. Renegociar antes do lote.`;
        } else {
          status = "estouro";
          hint = `+${gapPct.toFixed(1)}% acima da meta — comprometendo margem. Revisar ${driver} ou renegociar preço de venda.`;
        }
      }

      const gapAbs = approved - target;
      const gapPct = target > 0 ? (gapAbs / target) * 100 : 0;

      items.push({
        productId: p.id,
        sku: p.sku,
        name: p.name,
        imageUrl: p.image_url,
        targetCost: target,
        approvedCost: approved,
        materialsCost: mat,
        laborCost: lab,
        gapAbs,
        gapPct,
        status,
        driver,
        hint,
      });
    });

    // ordena pelos piores primeiro
    items.sort((a, b) => {
      const rank = { estouro: 0, atencao: 1, sem_meta: 2, sem_ficha: 3, ok: 4 } as const;
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
      return b.gapPct - a.gapPct;
    });

    const tracked = items.filter((i) => i.status === "ok" || i.status === "atencao" || i.status === "estouro");
    const estouro = items.filter((i) => i.status === "estouro").length;
    const atencao = items.filter((i) => i.status === "atencao").length;
    const sem_meta = items.filter((i) => i.status === "sem_meta").length;
    const avgGapPct =
      tracked.length > 0
        ? tracked.reduce((s, i) => s + i.gapPct, 0) / tracked.length
        : 0;

    const insights: string[] = [];
    if (estouro > 0)
      insights.push(
        `${estouro} produto(s) estourando a meta (+10% ou mais). Acionar comprador e PCP antes de abrir OP.`,
      );
    if (atencao > 0)
      insights.push(`${atencao} produto(s) em zona de atenção — pequena negociação ainda recupera margem.`);
    if (sem_meta > 0)
      insights.push(`${sem_meta} produto(s) sem custo-meta — cadastrar em Target Costing para diagnóstico.`);

    // driver dominante nos estouros
    const drivers = items
      .filter((i) => i.status === "estouro")
      .reduce<Record<string, number>>((acc, i) => {
        acc[i.driver] = (acc[i.driver] ?? 0) + 1;
        return acc;
      }, {});
    const topDriver = Object.entries(drivers).sort((a, b) => b[1] - a[1])[0];
    if (topDriver) {
      insights.push(
        `Causa raiz mais comum: ${topDriver[0]} (${topDriver[1]} produto(s)). Priorizar revisão neste eixo.`,
      );
    }
    if (insights.length === 0 && items.length > 0)
      insights.push("Custos sob controle. Nenhum produto exige ação imediata.");

    return {
      items,
      summary: {
        total: items.length,
        estouro,
        atencao,
        sem_meta,
        avgGapPct: Math.round(avgGapPct * 10) / 10,
      },
      insights,
    };
  });
