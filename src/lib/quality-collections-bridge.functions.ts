import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CollectionQualityRow = {
  id: string;
  name: string;
  season: string | null;
  year: number | null;
  status: string | null;
  products: number;
  ordersTotal: number;
  ordersLate: number;
  onTimePct: number;
  inspectionsTotal: number;
  inspectionsApproved: number;
  fpyPct: number;
  occurrences: number;
  conqEstimate: number;
  ftrPct: number;
  riskScore: number; // 0-100, higher = worse
  riskLabel: "ok" | "atencao" | "critico";
};

export type CollectionsBridgeAnalysis = {
  rows: CollectionQualityRow[];
  summary: {
    collections: number;
    criticos: number;
    avgFpy: number;
    avgOnTime: number;
    totalConq: number;
  };
  insight: string;
};

export const getCollectionsBridgeAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CollectionsBridgeAnalysis> => {
    const { supabase, userId } = context;

    const [
      { data: collections },
      { data: cps },
      { data: products },
      { data: orders },
      { data: insps },
      { data: occs },
      { data: protos },
      { data: protoAdj },
    ] = await Promise.all([
      supabase
        .from("collections")
        .select("id, name, season, year, status")
        .eq("owner_id", userId),
      supabase.from("collection_products").select("collection_id, product_id").eq("owner_id", userId),
      supabase.from("products").select("id, cost_price").eq("owner_id", userId),
      supabase
        .from("production_orders")
        .select("id, product_id, quantity, status, due_date, stage, created_at")
        .eq("owner_id", userId),
      supabase
        .from("quality_inspections")
        .select("id, production_order_id, result")
        .eq("owner_id", userId),
      supabase
        .from("production_occurrences")
        .select("id, production_order_id, type, quantity_affected")
        .eq("owner_id", userId),
      supabase
        .from("prototypes")
        .select("id, product_id, stage, created_at, updated_at")
        .eq("owner_id", userId),
      supabase.from("prototype_adjustments").select("prototype_id").eq("owner_id", userId),
    ]);

    const prodCost = new Map<string, number>();
    (products ?? []).forEach((p: any) => prodCost.set(p.id, Number(p.cost_price ?? 0)));

    // collection -> products
    const colToProds = new Map<string, Set<string>>();
    (cps ?? []).forEach((cp: any) => {
      if (!cp.collection_id || !cp.product_id) return;
      const s = colToProds.get(cp.collection_id) ?? new Set();
      s.add(cp.product_id);
      colToProds.set(cp.collection_id, s);
    });

    // product -> orders
    const prodToOrders = new Map<string, any[]>();
    (orders ?? []).forEach((o: any) => {
      if (!o.product_id) return;
      const a = prodToOrders.get(o.product_id) ?? [];
      a.push(o);
      prodToOrders.set(o.product_id, a);
    });

    const orderToInsps = new Map<string, any[]>();
    (insps ?? []).forEach((i: any) => {
      if (!i.production_order_id) return;
      const a = orderToInsps.get(i.production_order_id) ?? [];
      a.push(i);
      orderToInsps.set(i.production_order_id, a);
    });

    const orderToOccs = new Map<string, any[]>();
    (occs ?? []).forEach((o: any) => {
      if (!o.production_order_id) return;
      const a = orderToOccs.get(o.production_order_id) ?? [];
      a.push(o);
      orderToOccs.set(o.production_order_id, a);
    });

    // product -> prototypes
    const prodToProtos = new Map<string, any[]>();
    (protos ?? []).forEach((p: any) => {
      if (!p.product_id) return;
      const a = prodToProtos.get(p.product_id) ?? [];
      a.push(p);
      prodToProtos.set(p.product_id, a);
    });
    const protoAdjCount = new Map<string, number>();
    (protoAdj ?? []).forEach((a: any) => {
      protoAdjCount.set(a.prototype_id, (protoAdjCount.get(a.prototype_id) ?? 0) + 1);
    });

    const now = Date.now();
    const rows: CollectionQualityRow[] = [];

    for (const col of collections ?? []) {
      const pset = colToProds.get(col.id) ?? new Set();
      let ordersTotal = 0,
        ordersLate = 0,
        inspTotal = 0,
        inspApproved = 0,
        occCount = 0,
        conq = 0,
        ftrApproved = 0,
        ftrCount = 0;

      for (const pid of pset) {
        const cost = prodCost.get(pid) ?? 0;
        const ords = prodToOrders.get(pid) ?? [];
        for (const o of ords) {
          ordersTotal++;
          if (
            o.due_date &&
            new Date(o.due_date).getTime() < now &&
            o.status !== "concluida" &&
            o.stage !== "expedicao"
          ) {
            ordersLate++;
          }
          const ois = orderToInsps.get(o.id) ?? [];
          for (const i of ois) {
            inspTotal++;
            if (i.result === "aprovado" || i.result === "aprovada") inspApproved++;
          }
          const oos = orderToOccs.get(o.id) ?? [];
          for (const oc of oos) {
            occCount++;
            const qty = Number(oc.quantity_affected ?? 1);
            const factor =
              oc.type === "refugo" ? 1.0 : oc.type === "retrabalho" ? 0.5 : 0.3;
            conq += qty * cost * factor;
          }
        }
        const pps = prodToProtos.get(pid) ?? [];
        for (const pp of pps) {
          if (pp.stage === "aprovado") {
            ftrCount++;
            if ((protoAdjCount.get(pp.id) ?? 0) === 0) ftrApproved++;
          }
        }
      }

      const onTimePct = ordersTotal ? ((ordersTotal - ordersLate) / ordersTotal) * 100 : 100;
      const fpyPct = inspTotal ? (inspApproved / inspTotal) * 100 : 100;
      const ftrPct = ftrCount ? (ftrApproved / ftrCount) * 100 : 100;

      // risco: peso fpy (40), onTime (30), ftr (20), occurrences (10)
      const riskScore = Math.round(
        (100 - fpyPct) * 0.4 +
          (100 - onTimePct) * 0.3 +
          (100 - ftrPct) * 0.2 +
          Math.min(occCount * 2, 100) * 0.1,
      );
      const riskLabel: CollectionQualityRow["riskLabel"] =
        riskScore >= 40 ? "critico" : riskScore >= 20 ? "atencao" : "ok";

      rows.push({
        id: col.id,
        name: col.name,
        season: col.season,
        year: col.year,
        status: col.status,
        products: pset.size,
        ordersTotal,
        ordersLate,
        onTimePct,
        inspectionsTotal: inspTotal,
        inspectionsApproved: inspApproved,
        fpyPct,
        occurrences: occCount,
        conqEstimate: Math.round(conq),
        ftrPct,
        riskScore,
        riskLabel,
      });
    }

    rows.sort((a, b) => b.riskScore - a.riskScore);

    const active = rows.filter((r) => r.ordersTotal + r.inspectionsTotal > 0);
    const criticos = rows.filter((r) => r.riskLabel === "critico").length;
    const avgFpy = active.length
      ? active.reduce((s, r) => s + r.fpyPct, 0) / active.length
      : 0;
    const avgOnTime = active.length
      ? active.reduce((s, r) => s + r.onTimePct, 0) / active.length
      : 0;
    const totalConq = rows.reduce((s, r) => s + r.conqEstimate, 0);

    const worst = rows[0];
    const insight =
      !worst || worst.riskScore < 20
        ? "✅ Qualidade saudável em todas as coleções. Continue monitorando inspeções e ocorrências."
        : worst.riskLabel === "critico"
          ? `🚨 ${worst.name} é a coleção mais crítica (risco ${worst.riskScore}). FPY ${worst.fpyPct.toFixed(0)}%, on-time ${worst.onTimePct.toFixed(0)}%. Priorize CAPA e revisão de fornecedores.`
          : `⚠️ ${worst.name} requer atenção (risco ${worst.riskScore}). Verifique inspeções reprovadas e atrasos antes do próximo lote.`;

    return {
      rows,
      summary: {
        collections: rows.length,
        criticos,
        avgFpy,
        avgOnTime,
        totalConq,
      },
      insight,
    };
  });
