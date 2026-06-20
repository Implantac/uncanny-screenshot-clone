import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AnchorProduct = {
  sku: string;
  name: string;
  units: number;
  revenue: number;
  avgPrice: number;
};

export type CollectionRisk = {
  id: string;
  name: string;
  season: string | null;
  launchDate: string | null;
  daysToLaunch: number | null;
  productCount: number;
  approvedSheets: number;
  approvedSheetsPct: number;
  activeOps: number;
  risk: "high" | "medium" | "low";
  reason: string;
};

export type CollectionIntelligence = {
  anchorProducts: AnchorProduct[];
  risks: CollectionRisk[];
  suggestions: string[];
};

export const getCollectionIntelligence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CollectionIntelligence> => {
    const sb = context.supabase;
    const iso90 = new Date(Date.now() - 90 * 86400000).toISOString();

    const [
      { data: sales },
      { data: collections },
      { data: products },
      { data: sheets },
      { data: ops },
    ] = await Promise.all([
      sb
        .from("erp_sales_mirror")
        .select("sku, product_ref, quantity, total_value")
        .gte("sold_at", iso90)
        .limit(3000),
      sb.from("collections").select("id, name, season, launch_date, status"),
      sb.from("products").select("id, name, sku, collection_id, status"),
      sb.from("tech_sheets").select("product_id, status"),
      sb
        .from("production_orders")
        .select("id, product_id, status")
        .neq("status", "cancelada")
        .neq("status", "concluida"),
    ]);

    type SaleRow = { sku: string | null; product_ref: string | null; quantity: number | null; total_value: number | null };
    type CollectionRow = { id: string; name: string; season: string | null; launch_date: string | null; status: string | null };
    type ProductRow = { id: string; name: string | null; sku: string | null; collection_id: string | null; status: string | null };
    type SheetRow = { product_id: string | null; status: string | null };
    type OpRow = { id: string; product_id: string | null; status: string | null };

    // Anchor products: top by revenue with > 1 unit/day
    const byProd = new Map<string, AnchorProduct>();
    ((sales ?? []) as SaleRow[]).forEach((s) => {
      const k = s.sku ?? s.product_ref ?? "—";
      const cur = byProd.get(k) ?? {
        sku: k,
        name: s.product_ref ?? k,
        units: 0,
        revenue: 0,
        avgPrice: 0,
      };
      cur.units += Number(s.quantity ?? 0);
      cur.revenue += Number(s.total_value ?? 0);
      byProd.set(k, cur);
    });
    const anchorProducts = [...byProd.values()]
      .map((p) => ({ ...p, avgPrice: p.units ? p.revenue / p.units : 0 }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    // Risk per active collection
    const approvedSheetByProd = new Set(
      ((sheets ?? []) as SheetRow[]).filter((s) => s.status === "aprovada").map((s) => s.product_id),
    );
    const opsByProd = new Map<string, number>();
    ((ops ?? []) as OpRow[]).forEach(
      (o) =>
        o.product_id && opsByProd.set(o.product_id, (opsByProd.get(o.product_id) ?? 0) + 1),
    );

    const now = Date.now();
    const risks: CollectionRisk[] = ((collections ?? []) as CollectionRow[])
      .filter((c) => c.status !== "entregue")
      .map((c) => {
        const items = ((products ?? []) as ProductRow[]).filter((p) => p.collection_id === c.id);
        const approved = items.filter((p) => approvedSheetByProd.has(p.id)).length;
        const pct = items.length ? Math.round((approved / items.length) * 100) : 0;
        const activeOps = items.reduce((s, p) => s + (opsByProd.get(p.id) ?? 0), 0);

        const days = c.launch_date
          ? Math.ceil((new Date(c.launch_date).getTime() - now) / 86400000)
          : null;

        let risk: CollectionRisk["risk"] = "low";
        let reason = "Dentro do ritmo esperado.";
        if (days !== null && days < 30 && pct < 50) {
          risk = "high";
          reason = `Faltam ${days}d e só ${pct}% das fichas aprovadas.`;
        } else if (days !== null && days < 60 && pct < 70) {
          risk = "medium";
          reason = `${pct}% das fichas aprovadas a ${days}d do lançamento.`;
        } else if (items.length > 0 && activeOps === 0 && (days ?? 999) < 60) {
          risk = "medium";
          reason = "Sem OPs ativas próximo do lançamento.";
        } else if (items.length === 0) {
          risk = "medium";
          reason = "Coleção sem produtos vinculados.";
        }

        return {
          id: c.id,
          name: c.name,
          season: c.season,
          launchDate: c.launch_date,
          daysToLaunch: days,
          productCount: items.length,
          approvedSheets: approved,
          approvedSheetsPct: pct,
          activeOps,
          risk,
          reason,
        };
      })
      .sort((a, b) => {
        const w = { high: 0, medium: 1, low: 2 } as const;
        return w[a.risk] - w[b.risk] || (a.daysToLaunch ?? 999) - (b.daysToLaunch ?? 999);
      });

    const suggestions: string[] = [];
    if (anchorProducts.length) {
      const top = anchorProducts[0];
      suggestions.push(
        `**Repor âncora** \`${top.sku}\` — ${top.units} un · R$ ${Math.round(top.revenue).toLocaleString("pt-BR")} em 90d.`,
      );
    }
    const highRisk = risks.find((r) => r.risk === "high");
    if (highRisk)
      suggestions.push(`**Acelerar fichas** da coleção *${highRisk.name}* — ${highRisk.reason}`);
    if (anchorProducts.length >= 3) {
      suggestions.push(
        `**Próxima coleção** deve manter o ticket médio em torno de R$ ${Math.round(anchorProducts.slice(0, 3).reduce((a, b) => a + b.avgPrice, 0) / 3).toLocaleString("pt-BR")}.`,
      );
    }

    return { anchorProducts, risks: risks.slice(0, 8), suggestions };
  });
