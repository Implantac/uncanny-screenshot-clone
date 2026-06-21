import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ============================================================
// FEFO · Lotes
// ============================================================

export const getItemLots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { itemId: string }) =>
    z.object({ itemId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("inventory_lots")
      .select("id, lot_code, quantity, received_at, expires_at, status, supplier_id, notes")
      .eq("inventory_item_id", data.itemId)
      .order("expires_at", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const registerLotEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      itemId: string;
      lotCode: string;
      quantity: number;
      expiresAt?: string | null;
      supplierId?: string | null;
      notes?: string | null;
    }) =>
      z
        .object({
          itemId: z.string().uuid(),
          lotCode: z.string().trim().min(1).max(80),
          quantity: z.number().positive(),
          expiresAt: z.string().optional().nullable(),
          supplierId: z.string().uuid().optional().nullable(),
          notes: z.string().max(500).optional().nullable(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: lot, error: lotErr } = await context.supabase
      .from("inventory_lots")
      .insert({
        owner_id: context.userId,
        inventory_item_id: data.itemId,
        lot_code: data.lotCode,
        quantity: 0, // trigger somará via stock_movements
        expires_at: data.expiresAt ?? null,
        supplier_id: data.supplierId ?? null,
        notes: data.notes ?? null,
      })
      .select("id")
      .single();
    if (lotErr) throw new Error(lotErr.message);

    const { error: mvErr } = await context.supabase.from("stock_movements").insert({
      owner_id: context.userId,
      inventory_item_id: data.itemId,
      type: "entrada",
      quantity: data.quantity,
      lot_id: lot!.id,
      supplier_lot: data.lotCode,
      notes: `Entrada lote ${data.lotCode}`,
    });
    if (mvErr) throw new Error(mvErr.message);
    return { ok: true, lotId: lot!.id };
  });

// ============================================================
// Scraps (perdas)
// ============================================================

const SCRAP_REASONS = [
  "vencimento",
  "avaria",
  "qualidade",
  "sobra_corte",
  "outros",
] as const;

export const registerScrap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      itemId: string;
      quantity: number;
      reason: (typeof SCRAP_REASONS)[number];
      lotId?: string | null;
      costValue?: number | null;
      productionOrderId?: string | null;
      notes?: string | null;
    }) =>
      z
        .object({
          itemId: z.string().uuid(),
          quantity: z.number().positive(),
          reason: z.enum(SCRAP_REASONS),
          lotId: z.string().uuid().optional().nullable(),
          costValue: z.number().nonnegative().optional().nullable(),
          productionOrderId: z.string().uuid().optional().nullable(),
          notes: z.string().max(500).optional().nullable(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    // baixa o saldo
    const { error: mvErr } = await context.supabase.from("stock_movements").insert({
      owner_id: context.userId,
      inventory_item_id: data.itemId,
      type: "saida",
      quantity: data.quantity,
      lot_id: data.lotId ?? null,
      reference_kind: "scrap",
      notes: `Perda: ${data.reason}${data.notes ? " · " + data.notes : ""}`,
    });
    if (mvErr) throw new Error(mvErr.message);

    const { error: scrapErr } = await context.supabase.from("inventory_scraps").insert({
      owner_id: context.userId,
      inventory_item_id: data.itemId,
      lot_id: data.lotId ?? null,
      quantity: data.quantity,
      reason: data.reason,
      cost_value: data.costValue ?? null,
      production_order_id: data.productionOrderId ?? null,
      notes: data.notes ?? null,
      registered_by: context.userId,
    });
    if (scrapErr) throw new Error(scrapErr.message);
    return { ok: true };
  });

export const getScrapsSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { windowDays?: number }) =>
    z.object({ windowDays: z.number().int().min(1).max(365).default(30) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - data.windowDays * 86400_000).toISOString();
    const { data: rows, error } = await context.supabase
      .from("inventory_scraps")
      .select(
        "id, quantity, reason, cost_value, created_at, inventory_item_id, inventory_items(sku,name,unit)",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const list = (rows ?? []) as Array<{
      id: string;
      quantity: number;
      reason: string;
      cost_value: number | null;
      created_at: string;
      inventory_item_id: string;
      inventory_items: { sku: string; name: string; unit: string } | null;
    }>;

    const byReason = new Map<string, { count: number; qty: number; cost: number }>();
    const byItem = new Map<string, { sku: string; name: string; qty: number; cost: number }>();
    let totalCost = 0;
    let totalQty = 0;

    for (const s of list) {
      const r = byReason.get(s.reason) ?? { count: 0, qty: 0, cost: 0 };
      r.count += 1;
      r.qty += Number(s.quantity);
      r.cost += Number(s.cost_value ?? 0);
      byReason.set(s.reason, r);

      const sku = s.inventory_items?.sku ?? s.inventory_item_id.slice(0, 6);
      const name = s.inventory_items?.name ?? "—";
      const it = byItem.get(sku) ?? { sku, name, qty: 0, cost: 0 };
      it.qty += Number(s.quantity);
      it.cost += Number(s.cost_value ?? 0);
      byItem.set(sku, it);

      totalQty += Number(s.quantity);
      totalCost += Number(s.cost_value ?? 0);
    }

    return {
      windowDays: data.windowDays,
      totals: { count: list.length, qty: totalQty, cost: totalCost },
      byReason: Array.from(byReason.entries())
        .map(([reason, v]) => ({ reason, ...v }))
        .sort((a, b) => b.cost - a.cost || b.qty - a.qty),
      topItems: Array.from(byItem.values())
        .sort((a, b) => b.cost - a.cost || b.qty - a.qty)
        .slice(0, 5),
      recent: list.slice(0, 10).map((s) => ({
        id: s.id,
        sku: s.inventory_items?.sku ?? "—",
        name: s.inventory_items?.name ?? "—",
        unit: s.inventory_items?.unit ?? "",
        quantity: Number(s.quantity),
        reason: s.reason,
        cost: Number(s.cost_value ?? 0),
        createdAt: s.created_at,
      })),
    };
  });

export const getExpiringLots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { daysAhead?: number }) =>
    z.object({ daysAhead: z.number().int().min(1).max(180).default(15) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const horizon = new Date(Date.now() + data.daysAhead * 86400_000).toISOString().slice(0, 10);
    const { data: rows, error } = await context.supabase
      .from("inventory_lots")
      .select(
        "id, lot_code, quantity, expires_at, inventory_item_id, inventory_items(sku,name,unit)",
      )
      .eq("status", "ativo")
      .gt("quantity", 0)
      .not("expires_at", "is", null)
      .lte("expires_at", horizon)
      .order("expires_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id as string,
      lotCode: r.lot_code as string,
      quantity: Number(r.quantity),
      expiresAt: r.expires_at as string,
      sku: r.inventory_items?.sku ?? "—",
      name: r.inventory_items?.name ?? "—",
      unit: r.inventory_items?.unit ?? "",
      itemId: r.inventory_item_id as string,
    }));
  });
