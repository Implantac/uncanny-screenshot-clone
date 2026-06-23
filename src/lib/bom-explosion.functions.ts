import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type BOMLine = {
  material_name: string;
  inventory_item_id: string | null;
  inventory_item_name: string | null;
  unit: string | null;
  consumption_unit: number;
  loss_pct: number;
  qty_grade: number;
  necessidade: number;
  saldo: number | null;
  gap: number | null;
  status: "ok" | "atencao" | "falta" | "sem-saldo";
  unit_cost: number;
  total_cost: number;
};

export type BOMExplosion = {
  order: { id: string; code: string; quantity: number; product_id: string | null };
  product_name: string | null;
  tech_sheet_id: string | null;
  tech_sheet_status: string | null;
  totals: { necessidade_total: number; gap_total: number; itens_em_falta: number };
  lines: BOMLine[];
  reason?: string;
};

export const getBOMExplosion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ productionOrderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<BOMExplosion> => {
    const { supabase } = context;

    const { data: order, error: oErr } = await supabase
      .from("production_orders")
      .select("id, code, quantity, product_id, products(name)")
      .eq("id", data.productionOrderId)
      .maybeSingle();
    if (oErr) throw oErr;
    if (!order) throw new Error("OP não encontrada");

    const orderQty = Number(order.quantity ?? 0);
    const productName = (order as { products?: { name?: string | null } | null }).products?.name ?? null;

    // explode pela grade real se existir (Tam×Cor)
    const { data: gridRows } = await supabase
      .from("production_order_grid")
      .select("quantity, variant_id, product_variants(size_id, product_size_options(label))")
      .eq("production_order_id", data.productionOrderId);
    const gridTotal = (gridRows ?? []).reduce((s, r) => s + Number(r.quantity ?? 0), 0);
    const qtyTotal = gridTotal > 0 ? gridTotal : orderQty;
    // Quantidade agregada por label de tamanho (P, M, G…) — base do BOM por tamanho
    const qtyBySize = new Map<string, number>();
    for (const r of gridRows ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const label = (r as any).product_variants?.product_size_options?.label as string | undefined;
      if (!label) continue;
      qtyBySize.set(label, (qtyBySize.get(label) ?? 0) + Number(r.quantity ?? 0));
    }

    if (!order.product_id) {
      return {
        order: { id: order.id, code: order.code, quantity: qtyTotal, product_id: null },
        product_name: productName,
        tech_sheet_id: null,
        tech_sheet_status: null,
        totals: { necessidade_total: 0, gap_total: 0, itens_em_falta: 0 },
        lines: [],
        reason: "OP sem produto vinculado",
      };
    }

    const { data: sheets } = await supabase
      .from("tech_sheets")
      .select("id, status, updated_at")
      .eq("product_id", order.product_id)
      .order("updated_at", { ascending: false });
    const sheet =
      (sheets ?? []).find((s) => s.status === "aprovada") ?? (sheets ?? [])[0] ?? null;

    if (!sheet) {
      return {
        order: { id: order.id, code: order.code, quantity: qtyTotal, product_id: order.product_id },
        product_name: productName,
        tech_sheet_id: null,
        tech_sheet_status: null,
        totals: { necessidade_total: 0, gap_total: 0, itens_em_falta: 0 },
        lines: [],
        reason: "Produto sem ficha técnica",
      };
    }

    const { data: materials } = await supabase
      .from("tech_sheet_materials")
      .select("id, name, inventory_item_id, consumption, loss_pct, unit, unit_cost")
      .eq("tech_sheet_id", sheet.id);

    const matList = materials ?? [];
    const invIds = matList.map((m) => m.inventory_item_id).filter((v): v is string => !!v);
    const { data: invItems } = invIds.length
      ? await supabase
          .from("inventory_items")
          .select("id, name, balance, unit")
          .in("id", invIds)
      : { data: [] as Array<{ id: string; name: string; balance: number | null; unit: string | null }> };
    const invMap = new Map((invItems ?? []).map((i) => [i.id, i]));

    const lines: BOMLine[] = matList.map((m) => {
      const consumo = Number(m.consumption ?? 0);
      const loss = Number(m.loss_pct ?? 0);
      const necessidade = consumo * (1 + loss / 100) * qtyTotal;
      const unit_cost = Number(m.unit_cost ?? 0);
      const total_cost = necessidade * unit_cost;
      const inv = m.inventory_item_id ? invMap.get(m.inventory_item_id) : null;
      const saldo = inv ? Number(inv.balance ?? 0) : null;
      const gap = saldo !== null ? saldo - necessidade : null;
      let status: BOMLine["status"];
      if (saldo === null) status = "sem-saldo";
      else if (gap! < 0) status = "falta";
      else if (gap! < necessidade * 0.15) status = "atencao";
      else status = "ok";
      return {
        material_name: m.name,
        inventory_item_id: m.inventory_item_id,
        inventory_item_name: inv?.name ?? null,
        unit: m.unit ?? inv?.unit ?? null,
        consumption_unit: consumo,
        loss_pct: loss,
        qty_grade: qtyTotal,
        necessidade,
        saldo,
        gap,
        status,
        unit_cost,
        total_cost,
      };
    });

    const necessidade_total = lines.reduce((s, l) => s + l.total_cost, 0);
    const gap_total = lines.reduce((s, l) => (l.gap !== null && l.gap < 0 ? s + l.gap : s), 0);
    const itens_em_falta = lines.filter((l) => l.status === "falta").length;

    return {
      order: { id: order.id, code: order.code, quantity: qtyTotal, product_id: order.product_id },
      product_name: productName,
      tech_sheet_id: sheet.id,
      tech_sheet_status: sheet.status,
      totals: { necessidade_total, gap_total, itens_em_falta },
      lines,
    };
  });
