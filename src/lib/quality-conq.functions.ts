import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ConqProductRow = {
  productId: string;
  productName: string;
  sku: string;
  reworkQty: number;
  scrapQty: number;
  rejectQty: number;
  unitCost: number;
  reworkCost: number;
  scrapCost: number;
  rejectCost: number;
  totalConq: number;
};

export type ConqAnalysis = {
  windowDays: number;
  reworkCost: number;
  scrapCost: number;
  rejectCost: number;
  totalConq: number;
  productionValue: number;
  conqPct: number; // %
  topOffenders: ConqProductRow[];
  insight: string;
};

const REWORK_KINDS = new Set(["rework", "retrabalho", "reparo"]);
const SCRAP_KINDS = new Set(["scrap", "refugo", "perda", "descarte"]);

export const getConqAnalysis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConqAnalysis> => {
    const sb = context.supabase;
    const WINDOW = 90;
    const since = new Date(Date.now() - WINDOW * 86400000).toISOString();

    const [{ data: occs }, { data: insps }, { data: orders }, { data: products }] =
      await Promise.all([
        sb
          .from("production_occurrences")
          .select("kind, affected_qty, order_id, created_at")
          .gte("created_at", since),
        sb
          .from("quality_inspections")
          .select(
            "production_order_id, result, critical_defects, major_defects, minor_defects, inspected_at",
          )
          .gte("inspected_at", since),
        sb.from("production_orders").select("id, product_id, quantity, started_at, created_at"),
        sb.from("products").select("id, sku, name, cost_price"),
      ]);

    type Prod = { id: string; sku: string; name: string; cost_price: number | null };
    const prodMap = new Map<string, Prod>(
      ((products ?? []) as Prod[]).map((p) => [p.id, p]),
    );
    const orderToProduct = new Map<string, string>();
    const orderQtyInWindow = new Map<string, number>();
    for (const o of (orders ?? []) as {
      id: string;
      product_id: string | null;
      quantity: number | null;
      started_at: string | null;
      created_at: string;
    }[]) {
      if (o.product_id) orderToProduct.set(o.id, o.product_id);
      const ref = o.started_at ?? o.created_at;
      if (ref && ref >= since && o.product_id) {
        orderQtyInWindow.set(o.id, (o.quantity ?? 0));
      }
    }

    const agg = new Map<
      string,
      { rework: number; scrap: number; reject: number }
    >();
    const bump = (pid: string, key: "rework" | "scrap" | "reject", qty: number) => {
      const a = agg.get(pid) ?? { rework: 0, scrap: 0, reject: 0 };
      a[key] += qty;
      agg.set(pid, a);
    };

    for (const o of (occs ?? []) as {
      kind: string;
      affected_qty: number | null;
      order_id: string | null;
    }[]) {
      if (!o.order_id) continue;
      const pid = orderToProduct.get(o.order_id);
      if (!pid) continue;
      const qty = Number(o.affected_qty ?? 0);
      if (qty <= 0) continue;
      const k = (o.kind ?? "").toLowerCase();
      if (REWORK_KINDS.has(k)) bump(pid, "rework", qty);
      else if (SCRAP_KINDS.has(k)) bump(pid, "scrap", qty);
    }

    for (const i of (insps ?? []) as {
      production_order_id: string | null;
      result: string;
      critical_defects: number | null;
      major_defects: number | null;
    }[]) {
      if (!i.production_order_id) continue;
      const isReject = i.result === "reprovado" || i.result === "reprovada";
      if (!isReject) continue;
      const pid = orderToProduct.get(i.production_order_id);
      if (!pid) continue;
      const defects = Number(i.critical_defects ?? 0) + Number(i.major_defects ?? 0);
      if (defects > 0) bump(pid, "reject", defects);
    }

    let reworkTotal = 0;
    let scrapTotal = 0;
    let rejectTotal = 0;
    const rows: ConqProductRow[] = [];
    agg.forEach((a, pid) => {
      const p = prodMap.get(pid);
      const unit = Number(p?.cost_price ?? 0);
      const reworkCost = a.rework * unit * 0.5; // retrabalho ~ 50% do custo unitário
      const scrapCost = a.scrap * unit;
      const rejectCost = a.reject * unit * 0.3; // unidade rejeitada por defeito ~ 30% custo (selo/reparo)
      reworkTotal += reworkCost;
      scrapTotal += scrapCost;
      rejectTotal += rejectCost;
      rows.push({
        productId: pid,
        productName: p?.name ?? "—",
        sku: p?.sku ?? "—",
        reworkQty: a.rework,
        scrapQty: a.scrap,
        rejectQty: a.reject,
        unitCost: unit,
        reworkCost,
        scrapCost,
        rejectCost,
        totalConq: reworkCost + scrapCost + rejectCost,
      });
    });
    rows.sort((a, b) => b.totalConq - a.totalConq);

    let productionValue = 0;
    orderQtyInWindow.forEach((qty, oid) => {
      const pid = orderToProduct.get(oid);
      if (!pid) return;
      const unit = Number(prodMap.get(pid)?.cost_price ?? 0);
      productionValue += qty * unit;
    });

    const totalConq = reworkTotal + scrapTotal + rejectTotal;
    const conqPct = productionValue > 0 ? (totalConq / productionValue) * 100 : 0;

    const top = rows[0];
    let insight: string;
    if (totalConq === 0) {
      insight = "Sem custos de não-qualidade registrados na janela — mantenha o monitoramento.";
    } else if (conqPct > 5) {
      insight = `CoNQ em ${conqPct.toFixed(1)}% da produção — acima do benchmark (3-5%). Priorizar CAPA em ${top?.productName ?? "produtos críticos"}.`;
    } else if (conqPct > 3) {
      insight = `CoNQ em ${conqPct.toFixed(1)}% — dentro da faixa típica do setor (3-5%). Foco preventivo em ${top?.productName ?? "top ofensores"}.`;
    } else {
      insight = `CoNQ em ${conqPct.toFixed(1)}% — abaixo de 3%, operação enxuta. Continue auditando lotes-piloto.`;
    }

    return {
      windowDays: WINDOW,
      reworkCost: reworkTotal,
      scrapCost: scrapTotal,
      rejectCost: rejectTotal,
      totalConq,
      productionValue,
      conqPct,
      topOffenders: rows.slice(0, 8),
      insight,
    };
  });
