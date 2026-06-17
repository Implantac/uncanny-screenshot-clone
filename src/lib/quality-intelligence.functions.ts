import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SupplierQuality = {
  supplierId: string;
  supplierName: string;
  occurrences: number;
  affectedQty: number;
  recurringKinds: { kind: string; count: number }[];
  recurringSectors: { sector: string; count: number }[];
  defectRate: number; // affected / total qty over period
  blockSuggested: boolean;
  reason: string;
};

export type QualityIntelligence = {
  windowDays: number;
  totalOccurrences: number;
  openOccurrences: number;
  suppliers: SupplierQuality[];
  topKinds: { kind: string; count: number }[];
};

export const getQualityIntelligence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QualityIntelligence> => {
    const sb = context.supabase;
    const WINDOW = 60;
    const since = new Date(Date.now() - WINDOW * 86400000).toISOString();

    const [{ data: occs }, { data: orders }, { data: suppliers }] = await Promise.all([
      sb.from("production_occurrences").select("kind, sector, affected_qty, status, order_id, created_at").gte("created_at", since),
      sb.from("production_orders").select("id, supplier_id, quantity"),
      sb.from("suppliers").select("id, name"),
    ]);

    const orderToSupplier = new Map<string, string | null>();
    const orderQty = new Map<string, number>();
    (orders ?? []).forEach((o: any) => {
      orderToSupplier.set(o.id, o.supplier_id);
      orderQty.set(o.id, Number(o.quantity ?? 0));
    });
    const supMap = new Map((suppliers ?? []).map((s: any) => [s.id, s.name]));

    type Agg = {
      occurrences: number;
      affectedQty: number;
      kinds: Map<string, number>;
      sectors: Map<string, number>;
      totalQty: number;
    };
    const bySup = new Map<string, Agg>();

    (occs ?? []).forEach((o: any) => {
      const sid = o.order_id ? orderToSupplier.get(o.order_id) : null;
      if (!sid) return;
      const a = bySup.get(sid) ?? { occurrences: 0, affectedQty: 0, kinds: new Map(), sectors: new Map(), totalQty: 0 };
      a.occurrences += 1;
      a.affectedQty += Number(o.affected_qty ?? 0);
      if (o.kind) a.kinds.set(o.kind, (a.kinds.get(o.kind) ?? 0) + 1);
      if (o.sector) a.sectors.set(o.sector, (a.sectors.get(o.sector) ?? 0) + 1);
      bySup.set(sid, a);
    });

    // Total qty per supplier across all OPs in window
    const qtyBySup = new Map<string, number>();
    (orders ?? []).forEach((o: any) => {
      if (!o.supplier_id) return;
      qtyBySup.set(o.supplier_id, (qtyBySup.get(o.supplier_id) ?? 0) + Number(o.quantity ?? 0));
    });

    const suppliersOut: SupplierQuality[] = [];
    bySup.forEach((a, sid) => {
      const total = qtyBySup.get(sid) ?? 0;
      const rate = total ? (a.affectedQty / total) * 100 : 0;
      const recurringKinds = [...a.kinds.entries()].map(([kind, count]) => ({ kind, count })).sort((x, y) => y.count - x.count);
      const recurringSectors = [...a.sectors.entries()].map(([sector, count]) => ({ sector, count })).sort((x, y) => y.count - x.count);
      const topKind = recurringKinds[0];
      const blockSuggested = rate > 8 || a.occurrences >= 5;
      let reason = `${a.occurrences} ocorrências em ${WINDOW}d`;
      if (topKind && topKind.count >= 3) reason += ` · ${topKind.count}× ${topKind.kind}`;
      if (rate > 0) reason += ` · taxa ${rate.toFixed(1)}%`;
      suppliersOut.push({
        supplierId: sid,
        supplierName: supMap.get(sid) ?? "—",
        occurrences: a.occurrences,
        affectedQty: a.affectedQty,
        recurringKinds: recurringKinds.slice(0, 3),
        recurringSectors: recurringSectors.slice(0, 3),
        defectRate: rate,
        blockSuggested,
        reason,
      });
    });

    suppliersOut.sort((a, b) => Number(b.blockSuggested) - Number(a.blockSuggested) || b.occurrences - a.occurrences);

    const kindAgg = new Map<string, number>();
    (occs ?? []).forEach((o: any) => o.kind && kindAgg.set(o.kind, (kindAgg.get(o.kind) ?? 0) + 1));
    const topKinds = [...kindAgg.entries()].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count).slice(0, 5);

    return {
      windowDays: WINDOW,
      totalOccurrences: (occs ?? []).length,
      openOccurrences: (occs ?? []).filter((o: any) => o.status === "aberta").length,
      suppliers: suppliersOut.slice(0, 10),
      topKinds,
    };
  });
