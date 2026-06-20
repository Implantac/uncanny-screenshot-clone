import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { computePriority } from "@/lib/priority-score";
import type { Database } from "@/integrations/supabase/types";

type Stage = Database["public"]["Enums"] extends { production_stage: infer S } ? S : string;
type SkuQtyRow = { sku: string | null; quantity: number | null };
type StockRow = { sku: string | null; balance: number | string | null };

type DayOpRow = {
  id: string;
  code: string;
  owner_id: string;
  quantity: number | null;
  priority: number | null;
  due_date: string | null;
  stage: string;
  stage_updated_at: string | null;
  batch_code: string | null;
  outsourced: boolean | null;
  product_id: string | null;
  supplier_id: string | null;
  products: { name: string | null; sku: string | null; image_url: string | null; cost_price: number | null; sell_price: number | null } | null;
  suppliers: { name: string | null } | null;
};

/** Produção do Dia: OPs ativas em um setor, ordenadas por Score de Prioridade. */
export const listDayProduction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { stage: string }) => z.object({ stage: z.string().min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("production_orders")
      .select(
        "id, code, owner_id, quantity, priority, due_date, stage, stage_updated_at, batch_code, outsourced, product_id, supplier_id, products(name, sku, image_url, cost_price, sell_price), suppliers(name)",
      )
      .eq("owner_id", userId)
      .eq("stage", data.stage as Stage)
      .neq("status", "concluida")
      .order("priority", { ascending: false, nullsFirst: false })
      .order("due_date", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as unknown as DayOpRow[];

    const skus = Array.from(
      new Set(list.map((r) => r.products?.sku).filter((s): s is string => Boolean(s))),
    );
    if (skus.length === 0) return list;

    const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
    const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
    const since90 = new Date(Date.now() - 90 * 86400000).toISOString();

    const [s30, s7, s90, inv] = await Promise.all([
      supabase
        .from("erp_sales_mirror")
        .select("sku, quantity")
        .eq("owner_id", userId)
        .in("sku", skus)
        .gte("sold_at", since30),
      supabase
        .from("erp_sales_mirror")
        .select("sku, quantity")
        .eq("owner_id", userId)
        .in("sku", skus)
        .gte("sold_at", since7),
      supabase
        .from("erp_sales_mirror")
        .select("sku, quantity")
        .eq("owner_id", userId)
        .in("sku", skus)
        .gte("sold_at", since90),
      supabase
        .from("erp_inventory_mirror")
        .select("sku, balance")
        .eq("owner_id", userId)
        .in("sku", skus),
    ]);

    const sum = (rs: SkuQtyRow[] | null | undefined, sku: string) =>
      (rs ?? [])
        .filter((r) => r.sku === sku)
        .reduce((a, r) => a + Number(r.quantity ?? 0), 0);
    const stockRows = (inv.data ?? []) as unknown as StockRow[];
    const stockOf = (sku: string) =>
      stockRows
        .filter((r) => r.sku === sku)
        .reduce((a, r) => a + Number(r.balance ?? 0), 0);

    const scored = list.map((r) => {
      const sku = r.products?.sku;
      if (!sku) return { ...r, score: 0, score_reasons: [] as string[] };
      const res = computePriority({
        sku,
        sold7: sum((s7.data ?? []) as unknown as SkuQtyRow[], sku),
        sold30: sum((s30.data ?? []) as unknown as SkuQtyRow[], sku),
        sold90: sum((s90.data ?? []) as unknown as SkuQtyRow[], sku),
        stock: stockOf(sku),
        wip: r.quantity ?? 0,
        cost: r.products?.cost_price ?? null,
        price: r.products?.sell_price ?? null,
      });
      return { ...r, score: res.score, score_reasons: res.reasons };
    });

    scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return scored;
  });

type ServiceOrderRow = {
  id: string;
  code: string;
  supplier_id: string | null;
  production_order_id: string | null;
  quantity: number | null;
  qty_received: number | null;
  sent_at: string | null;
  due_at: string | null;
  status: string;
  from_stage: string | null;
  to_stage: string | null;
  line_type: string | null;
  variant_id: string | null;
  package_id: string | null;
  suppliers: { name: string | null } | null;
  production_orders: { code: string; batch_code: string | null } | null;
  product_variants: { sku: string | null; color: string | null; size: string | null } | null;
  production_packages: { code: string } | null;
};

type SupplierWipBucket = {
  supplier_id: string | null;
  pieces_at_supplier: number;
  supplier_name: string | null;
  second_line_count: number;
  orders: ServiceOrderRow[];
};

/** Terceirizados: WIP por fornecedor + detalhamento de OSs abertas. */
export const listOutsourcedWip = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: wip, error: e1 }, { data: open, error: e2 }] = await Promise.all([
      supabase.from("v_supplier_wip").select("*").eq("owner_id", userId),
      supabase
        .from("service_orders")
        .select(
          "id, code, supplier_id, production_order_id, quantity, qty_received, sent_at, due_at, status, from_stage, to_stage, line_type, variant_id, package_id, suppliers(name), production_orders(code, batch_code), product_variants(sku, color, size), production_packages(code)",
        )
        .eq("owner_id", userId)
        .in("status", ["enviada", "em_andamento"])
        .order("sent_at", { ascending: true, nullsFirst: false }),
    ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);

    const suppliersById: Record<string, SupplierWipBucket> = {};
    for (const w of (wip ?? []) as unknown as Array<{ supplier_id: string | null; pieces_at_supplier: number | null; [k: string]: unknown }>) {
      if (!w.supplier_id) continue;
      suppliersById[w.supplier_id] = {
        ...w,
        pieces_at_supplier: Number(w.pieces_at_supplier ?? 0),
        supplier_name: null,
        second_line_count: 0,
        orders: [],
      };
    }
    for (const o of (open ?? []) as unknown as ServiceOrderRow[]) {
      const sid = o.supplier_id;
      if (!sid || !suppliersById[sid]) continue;
      suppliersById[sid].supplier_name = o.suppliers?.name ?? null;
      suppliersById[sid].second_line_count =
        (suppliersById[sid].second_line_count ?? 0) + (o.line_type === "segunda_linha" ? 1 : 0);
      suppliersById[sid].orders.push(o);
    }
    return Object.values(suppliersById).sort(
      (a, b) => b.pieces_at_supplier - a.pieces_at_supplier,
    );
  });

/** Cria uma OP a partir da sugestão do motor de necessidade (1 clique). */
export const createOpFromSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: { productId: string; quantity: number; reason?: string; priority?: number }) =>
      z
        .object({
          productId: z.string().uuid(),
          quantity: z.number().int().positive(),
          reason: z.string().optional(),
          priority: z.number().int().min(0).max(3).optional(),
        })
        .parse(i),
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
        stage: "cad" as Stage,
        priority: data.priority ?? 2,
        notes: data.reason
          ? `Sugerida pelo motor: ${data.reason}`
          : "Sugerida pelo motor de necessidade",
      })
      .select("id, code")
      .single();
    if (error) throw new Error(error.message);
    return op;
  });
