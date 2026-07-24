import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CapaRiskProduct = {
  productId: string;
  productName: string | null;
  productSku: string | null;
  capaCount: number;
  openCapaCount: number;
  suppliers: Array<{ id: string; name: string | null; capaCount: number; avgScore: number | null }>;
  topCategory: string | null;
  recurrent: boolean;
};

export type CapaRiskCollection = {
  id: string;
  name: string;
  season: string | null;
  launchDate: string | null;
  daysToLaunch: number | null;
  status: string | null;
  totalCapas: number;
  openCapas: number;
  recurrentCapas: number;
  products: CapaRiskProduct[];
  riskScore: number; // 0-100
  riskLabel: "critico" | "atencao" | "ok";
  recommendation: string;
};

export type CollectionCapaRisks = {
  rows: CapaRiskCollection[];
  summary: { collectionsAtRisk: number; totalOpenCapas: number; totalRecurrent: number };
  insight: string;
};

const ACTIVE_STATUS = new Set(["briefing", "design", "aprovacao", "desenvolvimento", "producao"]);

export const getCollectionCapaRisks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CollectionCapaRisks> => {
    const sb = context.supabase;
    const iso180 = new Date(Date.now() - 180 * 86400000).toISOString();

    const [{ data: capas }, { data: collections }, { data: cps }, { data: products }, { data: orders }, { data: suppliers }, { data: scorecards }] =
      await Promise.all([
        sb
          .from("quality_capa")
          .select("id, order_id, supplier_id, status, severity, created_at, closed_at, problem")
          .gte("created_at", iso180)
          .limit(2000),
        sb.from("collections").select("id, name, season, launch_date, status"),
        sb.from("collection_products").select("collection_id, product_id"),
        sb.from("products").select("id, name, sku"),
        sb.from("production_orders").select("id, product_id"),
        sb.from("suppliers").select("id, name, category"),
        sb
          .from("supplier_scorecards")
          .select("supplier_id, score, computed_at")
          .order("computed_at", { ascending: false })
          .limit(2000),
      ]);

    type CapaRow = { id: string; order_id: string | null; supplier_id: string | null; status: string | null; severity: string | null; created_at: string; closed_at: string | null; problem: string | null };
    type CollectionRow = { id: string; name: string; season: string | null; launch_date: string | null; status: string | null };
    type CpRow = { collection_id: string | null; product_id: string | null };
    type ProductRow = { id: string; name: string | null; sku: string | null };
    type OrderRow = { id: string; product_id: string | null };
    type SupplierRow = { id: string; name: string | null; category: string | null };
    type ScRow = { supplier_id: string | null; score: number | null; computed_at: string };

    const orderToProduct = new Map<string, string>();
    ((orders ?? []) as OrderRow[]).forEach((o) => o.product_id && orderToProduct.set(o.id, o.product_id));

    const productMap = new Map<string, ProductRow>();
    ((products ?? []) as ProductRow[]).forEach((p) => productMap.set(p.id, p));

    const supplierMap = new Map<string, SupplierRow>();
    ((suppliers ?? []) as SupplierRow[]).forEach((s) => supplierMap.set(s.id, s));

    const latestScore = new Map<string, number>();
    ((scorecards ?? []) as ScRow[]).forEach((s) => {
      if (s.supplier_id && !latestScore.has(s.supplier_id) && s.score != null) {
        latestScore.set(s.supplier_id, Number(s.score));
      }
    });

    // productId -> capa list with supplier
    type EnrichedCapa = { capa: CapaRow; productId: string };
    const capasByProduct = new Map<string, EnrichedCapa[]>();
    ((capas ?? []) as CapaRow[]).forEach((c) => {
      if (!c.order_id) return;
      const pid = orderToProduct.get(c.order_id);
      if (!pid) return;
      const arr = capasByProduct.get(pid) ?? [];
      arr.push({ capa: c, productId: pid });
      capasByProduct.set(pid, arr);
    });

    const collectionProducts = new Map<string, Set<string>>();
    ((cps ?? []) as CpRow[]).forEach((cp) => {
      if (!cp.collection_id || !cp.product_id) return;
      const s = collectionProducts.get(cp.collection_id) ?? new Set();
      s.add(cp.product_id);
      collectionProducts.set(cp.collection_id, s);
    });

    const now = Date.now();
    const rows: CapaRiskCollection[] = [];

    for (const col of ((collections ?? []) as CollectionRow[])) {
      if (col.status && !ACTIVE_STATUS.has(col.status)) continue;
      const pset = collectionProducts.get(col.id);
      if (!pset || pset.size === 0) continue;

      const products: CapaRiskProduct[] = [];
      let totalCapas = 0;
      let openCapas = 0;
      let recurrentCapas = 0;

      for (const pid of pset) {
        const enriched = capasByProduct.get(pid) ?? [];
        if (enriched.length === 0) continue;
        const supplierAgg = new Map<string, { name: string | null; capaCount: number; scores: number[] }>();
        let openCount = 0;
        const categoryCount = new Map<string, number>();
        for (const e of enriched) {
          const s = e.capa.status;
          if (s !== "concluida" && s !== "fechada" && s !== "closed" && e.capa.closed_at == null) openCount++;
          if (e.capa.supplier_id) {
            const sup = supplierMap.get(e.capa.supplier_id);
            const cur = supplierAgg.get(e.capa.supplier_id) ?? { name: sup?.name ?? null, capaCount: 0, scores: [] };
            cur.capaCount++;
            const sc = latestScore.get(e.capa.supplier_id);
            if (sc != null) cur.scores.push(sc);
            supplierAgg.set(e.capa.supplier_id, cur);
            if (sup?.category) categoryCount.set(sup.category, (categoryCount.get(sup.category) ?? 0) + 1);
          }
        }
        const recurrent = enriched.length >= 2;
        if (recurrent) recurrentCapas++;
        totalCapas += enriched.length;
        openCapas += openCount;
        const prod = productMap.get(pid);
        const topCategory =
          [...categoryCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
        products.push({
          productId: pid,
          productName: prod?.name ?? null,
          productSku: prod?.sku ?? null,
          capaCount: enriched.length,
          openCapaCount: openCount,
          suppliers: [...supplierAgg.entries()].map(([id, v]) => ({
            id,
            name: v.name,
            capaCount: v.capaCount,
            avgScore: v.scores.length ? v.scores.reduce((a, b) => a + b, 0) / v.scores.length : null,
          })).sort((a, b) => b.capaCount - a.capaCount),
          topCategory,
          recurrent,
        });
      }

      if (products.length === 0) continue;

      const days = col.launch_date
        ? Math.ceil((new Date(col.launch_date).getTime() - now) / 86400000)
        : null;

      // Score: open capas (peso 5), recurrent (10), proximity (0-40)
      const proximityPenalty =
        days == null ? 10 : days < 15 ? 40 : days < 30 ? 30 : days < 60 ? 20 : days < 120 ? 10 : 5;
      const raw = openCapas * 5 + recurrentCapas * 10 + proximityPenalty;
      const riskScore = Math.min(100, Math.round(raw));
      const riskLabel: CapaRiskCollection["riskLabel"] =
        riskScore >= 50 ? "critico" : riskScore >= 25 ? "atencao" : "ok";

      // Recommendation
      const worstProduct = products.slice().sort((a, b) => b.capaCount - a.capaCount)[0];
      const worstSupplier = worstProduct?.suppliers[0];
      const worstScore = worstSupplier?.avgScore;
      let recommendation: string;
      if (recurrentCapas > 0 && worstSupplier && worstScore != null && worstScore < 60) {
        recommendation = `Substituir fornecedor **${worstSupplier.name ?? worstSupplier.id.slice(0, 6)}** (score ${Math.round(worstScore)}) em *${worstProduct.productName ?? worstProduct.productSku ?? "produto"}* — ${worstProduct.capaCount} CAPAs em 180d.`;
      } else if (recurrentCapas > 0) {
        recommendation = `Revisar material/fornecedor de *${worstProduct?.productName ?? worstProduct?.productSku ?? "produto"}* antes do lançamento (${worstProduct?.capaCount ?? 0} CAPAs recorrentes).`;
      } else if (openCapas > 0 && days != null && days < 30) {
        recommendation = `Fechar ${openCapas} CAPA(s) em aberto antes do lançamento (${days}d).`;
      } else if (openCapas > 0) {
        recommendation = `Monitorar ${openCapas} CAPA(s) em aberto — sem impacto imediato no lançamento.`;
      } else {
        recommendation = "Sem ação urgente — qualidade sob controle.";
      }

      rows.push({
        id: col.id,
        name: col.name,
        season: col.season,
        launchDate: col.launch_date,
        daysToLaunch: days,
        status: col.status,
        totalCapas,
        openCapas,
        recurrentCapas,
        products: products.sort((a, b) => b.capaCount - a.capaCount).slice(0, 5),
        riskScore,
        riskLabel,
        recommendation,
      });
    }

    rows.sort((a, b) => b.riskScore - a.riskScore);

    const collectionsAtRisk = rows.filter((r) => r.riskLabel !== "ok").length;
    const totalOpenCapas = rows.reduce((s, r) => s + r.openCapas, 0);
    const totalRecurrent = rows.reduce((s, r) => s + r.recurrentCapas, 0);
    const worst = rows[0];
    const insight =
      !worst || worst.riskLabel === "ok"
        ? "✅ Nenhuma coleção ativa com CAPA recorrente. Qualidade sob controle."
        : worst.riskLabel === "critico"
          ? `🚨 *${worst.name}* concentra ${worst.openCapas} CAPA(s) em aberto e ${worst.recurrentCapas} recorrente(s)${worst.daysToLaunch != null ? ` — lança em ${worst.daysToLaunch}d` : ""}. ${worst.recommendation}`
          : `⚠️ *${worst.name}* com sinais de risco — ${worst.recommendation}`;

    return {
      rows: rows.slice(0, 8),
      summary: { collectionsAtRisk, totalOpenCapas, totalRecurrent },
      insight,
    };
  });
