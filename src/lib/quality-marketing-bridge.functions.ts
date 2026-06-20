import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MarketingQualityRow = {
  productId: string;
  productName: string;
  sku: string | null;
  investment: number; // soma de campaigns + briefs.budget alocados ao produto
  shipments: number;
  influencers: number;
  fpyPct: number;
  occurrences: number;
  conqEstimate: number;
  exposureScore: number; // proxy de exposição (investimento + envios*peso)
  riskScore: number; // 0-100 — alta exposição + baixa qualidade
  riskLabel: "ok" | "atencao" | "critico";
  reason: string;
};

export type MarketingBridgeAnalysis = {
  rows: MarketingQualityRow[];
  summary: {
    productsTracked: number;
    criticos: number;
    totalInvestment: number;
    totalShipments: number;
    avgFpy: number;
    wastedInvestment: number; // investimento em produtos críticos
  };
  insight: string;
};

const DAYS = 90;

export const getMarketingBridgeAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MarketingBridgeAnalysis> => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - DAYS * 86400_000).toISOString();

    const [
      { data: products },
      { data: orders },
      { data: insps },
      { data: occs },
      { data: briefs },
      { data: campaigns },
      { data: shipments },
    ] = await Promise.all([
      supabase.from("products").select("id, name, sku, cost_price").eq("owner_id", userId),
      supabase
        .from("production_orders")
        .select("id, product_id")
        .eq("owner_id", userId)
        .gte("created_at", since),
      supabase
        .from("quality_inspections")
        .select("production_order_id, result, created_at")
        .eq("owner_id", userId)
        .gte("created_at", since),
      supabase
        .from("production_occurrences")
        .select("production_order_id, type, quantity_affected, created_at")
        .eq("owner_id", userId)
        .gte("created_at", since),
      supabase
        .from("marketing_briefs")
        .select("product_id, campaign_id, budget, created_at")
        .eq("owner_id", userId)
        .gte("created_at", since),
      supabase
        .from("marketing_campaigns")
        .select("id, investment, start_date")
        .eq("owner_id", userId)
        .gte("start_date", since.slice(0, 10)),
      supabase
        .from("influencer_shipments")
        .select("product_id, influencer_id, shipped_at")
        .eq("owner_id", userId)
        .gte("shipped_at", since.slice(0, 10)),
    ]);

    const prodMap = new Map<string, any>();
    (products ?? []).forEach((p: any) => prodMap.set(p.id, p));

    const orderToProduct = new Map<string, string>();
    (orders ?? []).forEach((o: any) => {
      if (o.product_id) orderToProduct.set(o.id, o.product_id);
    });

    const campaignInvest = new Map<string, number>();
    (campaigns ?? []).forEach((c: any) => {
      campaignInvest.set(c.id, Number(c.investment ?? 0));
    });

    type Agg = {
      investment: number;
      shipments: number;
      influencers: Set<string>;
      inspTotal: number;
      inspApproved: number;
      occCount: number;
      conq: number;
    };
    const agg = new Map<string, Agg>();
    const get = (pid: string): Agg => {
      let a = agg.get(pid);
      if (!a) {
        a = {
          investment: 0,
          shipments: 0,
          influencers: new Set(),
          inspTotal: 0,
          inspApproved: 0,
          occCount: 0,
          conq: 0,
        };
        agg.set(pid, a);
      }
      return a;
    };

    (briefs ?? []).forEach((b: any) => {
      if (!b.product_id) return;
      const a = get(b.product_id);
      a.investment += Number(b.budget ?? 0);
      if (b.campaign_id) a.investment += campaignInvest.get(b.campaign_id) ?? 0;
    });

    (shipments ?? []).forEach((s: any) => {
      if (!s.product_id) return;
      const a = get(s.product_id);
      a.shipments++;
      if (s.influencer_id) a.influencers.add(s.influencer_id);
    });

    (insps ?? []).forEach((i: any) => {
      const pid = orderToProduct.get(i.production_order_id);
      if (!pid) return;
      const a = get(pid);
      a.inspTotal++;
      if (i.result === "aprovado" || i.result === "aprovada") a.inspApproved++;
    });

    (occs ?? []).forEach((o: any) => {
      const pid = orderToProduct.get(o.production_order_id);
      if (!pid) return;
      const a = get(pid);
      const cost = Number(prodMap.get(pid)?.cost_price ?? 0);
      a.occCount++;
      const qty = Number(o.quantity_affected ?? 1);
      const factor = o.type === "refugo" ? 1.0 : o.type === "retrabalho" ? 0.5 : 0.3;
      a.conq += qty * cost * factor;
    });

    const rows: MarketingQualityRow[] = [];
    for (const [pid, a] of agg.entries()) {
      const p = prodMap.get(pid);
      if (!p) continue;
      // só interessa produtos com alguma exposição de marketing
      if (a.investment <= 0 && a.shipments <= 0) continue;

      const fpyPct = a.inspTotal ? (a.inspApproved / a.inspTotal) * 100 : 100;
      const exposureScore = a.investment / 100 + a.shipments * 5;
      const qualityGap = Math.max(0, 100 - fpyPct) + Math.min(a.occCount * 3, 60);
      // risco = exposição × gap normalizado
      const riskScore = Math.min(
        100,
        Math.round((Math.min(exposureScore, 100) / 100) * qualityGap),
      );
      const riskLabel: MarketingQualityRow["riskLabel"] =
        riskScore >= 35 ? "critico" : riskScore >= 15 ? "atencao" : "ok";

      let reason = "Exposição alinhada à qualidade";
      if (riskLabel === "critico") {
        reason =
          fpyPct < 80
            ? `FPY ${fpyPct.toFixed(0)}% com R$ ${a.investment.toFixed(0)} investidos`
            : `${a.occCount} ocorrências com ${a.shipments} envios a influencers`;
      } else if (riskLabel === "atencao") {
        reason = `${a.occCount} ocorrências · FPY ${fpyPct.toFixed(0)}%`;
      }

      rows.push({
        productId: pid,
        productName: p.name,
        sku: p.sku,
        investment: Math.round(a.investment),
        shipments: a.shipments,
        influencers: a.influencers.size,
        fpyPct,
        occurrences: a.occCount,
        conqEstimate: Math.round(a.conq),
        exposureScore: Math.round(exposureScore),
        riskScore,
        riskLabel,
        reason,
      });
    }

    rows.sort((a, b) => b.riskScore - a.riskScore);

    const criticos = rows.filter((r) => r.riskLabel === "critico");
    const totalInvestment = rows.reduce((s, r) => s + r.investment, 0);
    const totalShipments = rows.reduce((s, r) => s + r.shipments, 0);
    const tracked = rows.filter((r) => r.occurrences > 0 || r.fpyPct < 100);
    const avgFpy = tracked.length
      ? tracked.reduce((s, r) => s + r.fpyPct, 0) / tracked.length
      : 100;
    const wasted = criticos.reduce((s, r) => s + r.investment, 0);

    const worst = rows[0];
    const insight =
      !worst || worst.riskLabel === "ok"
        ? "✅ Marketing e qualidade alinhados — investimentos estão em produtos saudáveis."
        : worst.riskLabel === "critico"
          ? `🚨 ${worst.productName} recebeu R$ ${worst.investment} e ${worst.shipments} envios, mas tem FPY ${worst.fpyPct.toFixed(0)}% e ${worst.occurrences} ocorrências. Pause a divulgação até resolver a causa raiz.`
          : `⚠️ ${worst.productName} merece atenção: ${worst.reason}. Revise antes de aumentar exposição.`;

    return {
      rows: rows.slice(0, 30),
      summary: {
        productsTracked: rows.length,
        criticos: criticos.length,
        totalInvestment,
        totalShipments,
        avgFpy,
        wastedInvestment: wasted,
      },
      insight,
    };
  });

