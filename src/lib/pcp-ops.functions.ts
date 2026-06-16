import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { computePriority } from "@/lib/priority-score";

/** Produção do Dia: OPs ativas em um setor, ordenadas por Score de Prioridade. */
export const listDayProduction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { stage: string }) => z.object({ stage: z.string().min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("production_orders")
      .select("id, code, quantity, priority, due_date, stage, stage_updated_at, batch_code, outsourced, product_id, supplier_id, products(name, sku, cost_price, sell_price), suppliers(name)")
      .eq("owner_id", userId)
      .eq("stage", data.stage as any)
      .neq("status", "concluida")
      .order("priority", { ascending: false, nullsFirst: false })
      .order("due_date", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    const list = rows ?? [];

    const productIds = Array.from(new Set(list.map((r: any) => r.product_id).filter(Boolean)));
    if (productIds.length === 0) return list;

    const since30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const since7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const since90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);

    const [s30, s7, s90, inv] = await Promise.all([
      supabase.from("erp_sales_mirror").select("product_id, qty, sell_price").eq("owner_id", userId).in("product_id", productIds).gte("sold_at", since30),
      supabase.from("erp_sales_mirror").select("product_id, qty").eq("owner_id", userId).in("product_id", productIds).gte("sold_at", since7),
      supabase.from("erp_sales_mirror").select("product_id, qty").eq("owner_id", userId).in("product_id", productIds).gte("sold_at", since90),
      supabase.from("erp_inventory_mirror").select("product_id, on_hand").eq("owner_id", userId).in("product_id", productIds),
    ]);

    const sum = (rs: any[] | null, pid: string) => (rs ?? []).filter(r => r.product_id === pid).reduce((a, r) => a + Number(r.qty ?? 0), 0);
    const stockOf = (pid: string) => (inv.data ?? []).filter(r => r.product_id === pid).reduce((a, r) => a + Number(r.on_hand ?? 0), 0);

    const scored = list.map((r: any) => {
      const pid = r.product_id;
      if (!pid) return { ...r, score: 0, score_reasons: [] };
      const res = computePriority({
        sku: r.products?.sku ?? r.code,
        sold7: sum(s7.data, pid),
        sold30: sum(s30.data, pid),
        sold90: sum(s90.data, pid),
        stock: stockOf(pid),
        wip: r.quantity,
        cost: r.products?.cost_price ?? null,
        price: r.products?.sell_price ?? null,
      });
      return { ...r, score: res.score, score_reasons: res.reasons };
    });

    scored.sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0));
    return scored;
  });

/** Terceirizados: WIP por fornecedor + detalhamento de OSs abertas. */
export const listOutsourcedWip = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: wip, error: e1 }, { data: open, error: e2 }] = await Promise.all([
      supabase.from("v_supplier_wip").select("*").eq("owner_id", userId),
      supabase
        .from("service_orders")
        .select("id, code, supplier_id, production_order_id, quantity, qty_received, sent_at, due_at, status, from_stage, to_stage, variant_id, package_id, suppliers(name), production_orders(code, batch_code), product_variants(sku, color, size), production_packages(code)")
        .eq("owner_id", userId)
        .in("status", ["enviada", "em_andamento"])
        .order("sent_at", { ascending: true, nullsFirst: false }),
    ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);

    const suppliersById: Record<string, any> = {};
    for (const w of wip ?? []) {
      suppliersById[w.supplier_id!] = { ...w, supplier_name: null as string | null, orders: [] as any[] };
    }
    for (const o of open ?? []) {
      const sid = o.supplier_id!;
      if (!suppliersById[sid]) continue;
      suppliersById[sid].supplier_name = (o as any).suppliers?.name ?? null;
      suppliersById[sid].orders.push(o);
    }
    return Object.values(suppliersById).sort((a: any, b: any) => b.pieces_at_supplier - a.pieces_at_supplier);
  });
