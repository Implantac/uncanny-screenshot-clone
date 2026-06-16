import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Produção do Dia: OPs ativas em um setor, ordenadas por prioridade e atraso. */
export const listDayProduction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { stage: string }) => z.object({ stage: z.string().min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("production_orders")
      .select("id, code, quantity, priority, due_date, stage, stage_updated_at, batch_code, outsourced, product_id, supplier_id, products(name, sku), suppliers(name)")
      .eq("owner_id", userId)
      .eq("stage", data.stage)
      .neq("status", "concluida")
      .order("priority", { ascending: false, nullsFirst: false })
      .order("due_date", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
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
