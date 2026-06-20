import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * MRP — Explode BOM (tech_sheet_materials) sobre as OPs ativas,
 * subtrai estoque atual e quantidade já em PO em aberto,
 * retorna lista de necessidade de compra consolidada.
 *
 * Horizonte = OPs com status != concluida (+ filtro opcional por dias até due_date).
 */
export const computeMaterialNeeds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { horizonDays?: number }) =>
    z.object({ horizonDays: z.number().int().positive().max(365).optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1) OPs ativas
    let opsQuery = supabase
      .from("production_orders")
      .select("id, product_id, quantity, due_date, code")
      .eq("owner_id", userId)
      .neq("status", "concluida")
      .not("product_id", "is", null)
      .gt("quantity", 0);
    if (data.horizonDays) {
      const cutoff = new Date(Date.now() + data.horizonDays * 86400000)
        .toISOString()
        .slice(0, 10);
      opsQuery = opsQuery.lte("due_date", cutoff);
    }
    const { data: ops, error: opsErr } = await opsQuery;
    if (opsErr) throw new Error(opsErr.message);
    const opsList = ops ?? [];
    if (opsList.length === 0) return { items: [], totalSkus: 0, totalOps: 0 };

    // 2) Tech sheets aprovadas dos produtos das OPs (1 por produto, a mais recente aprovada)
    const productIds = Array.from(
      new Set(opsList.map((o) => o.product_id).filter((p): p is string => Boolean(p))),
    );
    const { data: sheets, error: sErr } = await supabase
      .from("tech_sheets")
      .select("id, product_id, updated_at")
      .eq("owner_id", userId)
      .eq("status", "aprovada")
      .in("product_id", productIds)
      .order("updated_at", { ascending: false });
    if (sErr) throw new Error(sErr.message);
    const sheetByProduct = new Map<string, string>();
    for (const s of sheets ?? []) {
      if (s.product_id && !sheetByProduct.has(s.product_id)) sheetByProduct.set(s.product_id, s.id);
    }
    const sheetIds = Array.from(sheetByProduct.values());
    if (sheetIds.length === 0) return { items: [], totalSkus: 0, totalOps: opsList.length };

    // 3) Materiais das fichas (apenas com inventory_item_id — só planejamos o que está cadastrado)
    const { data: mats, error: mErr } = await supabase
      .from("tech_sheet_materials")
      .select("tech_sheet_id, inventory_item_id, consumption, loss_pct, unit, name")
      .eq("owner_id", userId)
      .in("tech_sheet_id", sheetIds)
      .not("inventory_item_id", "is", null);
    if (mErr) throw new Error(mErr.message);
    const matsBySheet = new Map<string, typeof mats>();
    for (const m of mats ?? []) {
      const arr = matsBySheet.get(m.tech_sheet_id) ?? [];
      arr.push(m);
      matsBySheet.set(m.tech_sheet_id, arr);
    }

    // 4) Explode: para cada OP, multiplica consumo × (1+perda) × quantidade
    type Need = {
      inventoryItemId: string;
      required: number;
      unit: string;
      name: string;
      contributingOps: { code: string; qty: number }[];
    };
    const needs = new Map<string, Need>();
    for (const op of opsList) {
      if (!op.product_id || !op.quantity) continue;
      const sheetId = sheetByProduct.get(op.product_id);
      if (!sheetId) continue;
      const matsList = matsBySheet.get(sheetId) ?? [];
      for (const m of matsList) {
        if (!m.inventory_item_id) continue;
        const perPiece = Number(m.consumption ?? 0) * (1 + Number(m.loss_pct ?? 0) / 100);
        const reqQty = perPiece * Number(op.quantity);
        if (reqQty <= 0) continue;
        const cur = needs.get(m.inventory_item_id) ?? {
          inventoryItemId: m.inventory_item_id,
          required: 0,
          unit: m.unit ?? "un",
          name: m.name,
          contributingOps: [],
        };
        cur.required += reqQty;
        cur.contributingOps.push({ code: op.code, qty: reqQty });
        needs.set(m.inventory_item_id, cur);
      }
    }
    if (needs.size === 0) return { items: [], totalSkus: 0, totalOps: opsList.length };

    // 5) Estoque atual
    const itemIds = Array.from(needs.keys());
    const { data: inv, error: iErr } = await supabase
      .from("inventory_items")
      .select("id, sku, name, balance, unit, minimum")
      .eq("owner_id", userId)
      .in("id", itemIds);
    if (iErr) throw new Error(iErr.message);
    const invById = new Map((inv ?? []).map((i) => [i.id, i]));

    // 6) Em pedido (purchase_order_items de POs ainda não recebidos)
    const { data: poItems, error: poErr } = await supabase
      .from("purchase_order_items")
      .select(
        "inventory_item_id, quantity, purchase_orders!inner(status, owner_id, code, expected_date)",
      )
      .eq("owner_id", userId)
      .in("inventory_item_id", itemIds);
    if (poErr) throw new Error(poErr.message);
    const onOrder = new Map<string, number>();
    for (const it of poItems ?? []) {
      const po = (it as unknown as { purchase_orders: { status: string } }).purchase_orders;
      if (!po || po.status === "recebido" || po.status === "cancelado") continue;
      if (!it.inventory_item_id) continue;
      onOrder.set(
        it.inventory_item_id,
        (onOrder.get(it.inventory_item_id) ?? 0) + Number(it.quantity ?? 0),
      );
    }

    // 7) Consolida deficit
    const items = Array.from(needs.values())
      .map((n) => {
        const inv = invById.get(n.inventoryItemId);
        const balance = Number(inv?.balance ?? 0);
        const ordered = onOrder.get(n.inventoryItemId) ?? 0;
        const deficit = Math.max(0, n.required - balance - ordered);
        return {
          inventoryItemId: n.inventoryItemId,
          sku: inv?.sku ?? "—",
          name: inv?.name ?? n.name,
          unit: inv?.unit ?? n.unit,
          required: Number(n.required.toFixed(3)),
          balance,
          onOrder: ordered,
          deficit: Number(deficit.toFixed(3)),
          coveragePct: n.required > 0
            ? Math.min(100, Math.round(((balance + ordered) / n.required) * 100))
            : 100,
          contributingOps: n.contributingOps
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 5)
            .map((o) => ({ code: o.code, qty: Number(o.qty.toFixed(2)) })),
        };
      })
      .sort((a, b) => b.deficit - a.deficit);

    return {
      items,
      totalSkus: items.length,
      totalOps: opsList.length,
      criticalCount: items.filter((i) => i.deficit > 0).length,
    };
  });
