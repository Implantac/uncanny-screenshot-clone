import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type CostVarianceRow = {
  order_id: string;
  code: string;
  product_id: string | null;
  product_name: string | null;
  product_sku: string | null;
  quantity: number;
  produced_qty: number;
  stage: string;
  status: string;
  /** Custos teóricos (da ficha técnica aprovada). */
  theoretical_unit: number;
  theoretical_materials: number;
  theoretical_labor: number;
  theoretical_total: number;
  /** Custo real estimado (consumo de estoque + mão de obra teórica + perdas por ocorrência). */
  real_materials: number;
  real_labor: number;
  real_loss: number;
  real_total: number;
  /** Variação. */
  variance: number;
  variance_pct: number;
  /** Sinais. */
  occurrences: {
    refugo: number;
    retrabalho: number;
    parada: number;
    outras: number;
    total: number;
  };
  has_tech_sheet: boolean;
  has_real_consumption: boolean;
};

export const listCostVariance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        collectionId: z.string().uuid().optional(),
        sinceDays: z.number().int().min(1).max(720).default(180),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const since = new Date(Date.now() - data.sinceDays * 86400000).toISOString();

    type OrderRow = {
      id: string;
      code: string;
      product_id: string | null;
      quantity: number | null;
      stage: string;
      status: string;
      started_at: string | null;
      created_at: string;
      progress: number | null;
      products: { name: string | null; sku: string | null; collection_id: string | null } | null;
    };
    type SheetRow = { product_id: string | null; cost_price: number | string | null; materials_cost: number | string | null; labor_cost: number | string | null; status: string };
    type MoveRow = { reference_id: string | null; type: string; quantity: number | string | null };
    type OccRow = { order_id: string | null; kind: string | null; affected_qty: number | string | null };

    const { data: orders, error } = await supabase
      .from("production_orders")
      .select(
        "id, code, product_id, quantity, stage, status, started_at, created_at, progress, products(name, sku, collection_id)",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;

    const ops = ((orders ?? []) as unknown as OrderRow[]).filter(
      (o) => !data.collectionId || o.products?.collection_id === data.collectionId,
    );
    if (ops.length === 0) return [] as CostVarianceRow[];

    const productIds = Array.from(new Set(ops.map((o) => o.product_id).filter((id): id is string => Boolean(id))));
    const orderIds = ops.map((o) => o.id);

    const [{ data: sheets }, { data: moves }, { data: occs }] = await Promise.all([
      productIds.length
        ? supabase
            .from("tech_sheets")
            .select("product_id, cost_price, materials_cost, labor_cost, status")
            .in("product_id", productIds)
            .eq("status", "aprovada")
        : Promise.resolve({ data: [] as SheetRow[] }),
      supabase
        .from("stock_movements")
        .select("reference_id, type, quantity")
        .eq("reference_kind", "production_order")
        .in("reference_id", orderIds),
      supabase
        .from("production_occurrences")
        .select("order_id, kind, affected_qty")
        .in("order_id", orderIds),
    ]);

    const sheetByProduct = new Map<string, SheetRow>();
    ((sheets ?? []) as unknown as SheetRow[]).forEach((s) => {
      if (!s.product_id) return;
      if (!sheetByProduct.has(s.product_id)) sheetByProduct.set(s.product_id, s);
    });

    const consumedByOp = new Map<string, number>();
    ((moves ?? []) as unknown as MoveRow[]).forEach((m) => {
      if (m.type !== "saida" || !m.reference_id) return;
      consumedByOp.set(
        m.reference_id,
        (consumedByOp.get(m.reference_id) ?? 0) + Number(m.quantity ?? 0),
      );
    });

    const occByOp = new Map<string, CostVarianceRow["occurrences"]>();
    ((occs ?? []) as unknown as OccRow[]).forEach((o) => {
      if (!o.order_id) return;
      const cur = occByOp.get(o.order_id) ?? {
        refugo: 0,
        retrabalho: 0,
        parada: 0,
        outras: 0,
        total: 0,
      };
      const qty = Number(o.affected_qty ?? 0);
      const k = String(o.kind ?? "").toLowerCase();
      if (k.includes("refugo")) cur.refugo += qty;
      else if (k.includes("retrabalho")) cur.retrabalho += qty;
      else if (k.includes("parada")) cur.parada += qty;
      else cur.outras += qty;
      cur.total += 1;
      occByOp.set(o.order_id, cur);
    });

    const rows: CostVarianceRow[] = ops.map((o) => {
      const sheet = o.product_id ? sheetByProduct.get(o.product_id) ?? null : null;
      const qty = Number(o.quantity ?? 0);
      const produced = Math.round((Number(o.progress ?? 0) / 100) * qty);
      const matU = Number(sheet?.materials_cost ?? 0);
      const labU = Number(sheet?.labor_cost ?? 0);
      const costU = Number(sheet?.cost_price ?? matU + labU);

      const theoreticalMaterials = matU * qty;
      const theoreticalLabor = labU * qty;
      const theoreticalTotal = costU * qty;

      // Real materiais: consumo medido / planejado * custo materiais teórico, fallback teórico
      const consumed = consumedByOp.get(o.id) ?? 0;
      const occ = occByOp.get(o.id) ?? { refugo: 0, retrabalho: 0, parada: 0, outras: 0, total: 0 };
      const hasReal = consumed > 0;
      const realMaterials =
        hasReal && qty > 0 ? matU * Math.max(consumed, qty) : theoreticalMaterials;
      // Mão de obra: produção real (ou planejada) × custo unitário; retrabalho amplia
      const baseLaborQty = produced > 0 ? produced + occ.retrabalho : qty;
      const realLabor = labU * baseLaborQty;
      // Perda: refugo gera custo perdido (mat+lab unitário do refugado)
      const realLoss = (matU + labU) * occ.refugo;
      const realTotal = realMaterials + realLabor + realLoss;
      const variance = realTotal - theoreticalTotal;
      const variancePct = theoreticalTotal > 0 ? (variance / theoreticalTotal) * 100 : 0;

      return {
        order_id: o.id,
        code: o.code,
        product_id: o.product_id ?? null,
        product_name: o.products?.name ?? null,
        product_sku: o.products?.sku ?? null,
        quantity: qty,
        produced_qty: produced,
        stage: o.stage,
        status: o.status,
        theoretical_unit: costU,
        theoretical_materials: theoreticalMaterials,
        theoretical_labor: theoreticalLabor,
        theoretical_total: theoreticalTotal,
        real_materials: realMaterials,
        real_labor: realLabor,
        real_loss: realLoss,
        real_total: realTotal,
        variance,
        variance_pct: variancePct,
        occurrences: occ,
        has_tech_sheet: Boolean(sheet),
        has_real_consumption: hasReal,
      };
    });

    return rows;
  });
