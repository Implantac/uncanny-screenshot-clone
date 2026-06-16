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
      .select("id, code, owner_id, quantity, priority, due_date, stage, stage_updated_at, batch_code, outsourced, product_id, supplier_id, products(name, sku, image_url, cost_price, sell_price), suppliers(name)")
      .eq("owner_id", userId)
      .eq("stage", data.stage as any)
      .neq("status", "concluida")
      .order("priority", { ascending: false, nullsFirst: false })
      .order("due_date", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    const list = rows ?? [];

    const skus = Array.from(new Set(list.map((r: any) => r.products?.sku).filter(Boolean))) as string[];
    if (skus.length === 0) return list;

    const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
    const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
    const since90 = new Date(Date.now() - 90 * 86400000).toISOString();

    const [s30, s7, s90, inv] = await Promise.all([
      supabase.from("erp_sales_mirror").select("sku, quantity").eq("owner_id", userId).in("sku", skus).gte("sold_at", since30),
      supabase.from("erp_sales_mirror").select("sku, quantity").eq("owner_id", userId).in("sku", skus).gte("sold_at", since7),
      supabase.from("erp_sales_mirror").select("sku, quantity").eq("owner_id", userId).in("sku", skus).gte("sold_at", since90),
      supabase.from("erp_inventory_mirror").select("sku, balance").eq("owner_id", userId).in("sku", skus),
    ]);

    const sum = (rs: any[] | null | undefined, sku: string) =>
      (rs ?? []).filter((r: any) => r.sku === sku).reduce((a: number, r: any) => a + Number(r.quantity ?? 0), 0);
    const stockOf = (sku: string) =>
      (inv.data ?? []).filter((r: any) => r.sku === sku).reduce((a: number, r: any) => a + Number(r.balance ?? 0), 0);

    const scored = list.map((r: any) => {
      const sku = r.products?.sku;
      if (!sku) return { ...r, score: 0, score_reasons: [] };
      const res = computePriority({
        sku,
        sold7: sum(s7.data, sku),
        sold30: sum(s30.data, sku),
        sold90: sum(s90.data, sku),
        stock: stockOf(sku),
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
        .select("id, code, supplier_id, production_order_id, quantity, qty_received, sent_at, due_at, status, from_stage, to_stage, line_type, variant_id, package_id, suppliers(name), production_orders(code, batch_code), product_variants(sku, color, size), production_packages(code)")
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
      suppliersById[sid].second_line_count = (suppliersById[sid].second_line_count ?? 0) + ((o as any).line_type === "segunda_linha" ? 1 : 0);
      suppliersById[sid].orders.push(o);
    }
    return Object.values(suppliersById).sort((a: any, b: any) => b.pieces_at_supplier - a.pieces_at_supplier);
  });

/** Cria uma OP a partir da sugestão do motor de necessidade (1 clique). */
export const createOpFromSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { productId: string; quantity: number; reason?: string; priority?: number }) =>
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().positive(),
      reason: z.string().optional(),
      priority: z.number().int().min(0).max(3).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: product, error: pErr } = await supabase
      .from("products")
      .select("id, sku, name")
      .eq("id", data.productId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!product) throw new Error("Produto não encontrado.");

    const code = `OP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${product.sku.slice(0, 6).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    const { data: op, error } = await supabase
      .from("production_orders")
      .insert({
        owner_id: userId,
        product_id: data.productId,
        code,
        quantity: data.quantity,
        status: "aguardando",
        stage: "cad",
        priority: data.priority ?? 2,
        notes: data.reason ? `Sugerida pelo motor: ${data.reason}` : "Sugerida pelo motor de necessidade",
      } as any)
      .select("id, code")
      .single();
    if (error) throw new Error(error.message);
    return op;
  });
