/**
 * Wave 21 — Digital Twin ampliado.
 *
 * Consolida a fábrica em tempo real para UM produto: cada lote (OP) aberto
 * com posição na esteira, dwell, próxima etapa, cobertura de material e
 * ocorrências vinculadas. Componente consumidor pluga postgres_changes para
 * refletir movimentações e mudanças de estágio sem refresh.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type TwinLot = {
  id: string;
  code: string;
  stage: string;
  stage_label: string;
  stage_position: number | null;
  next_stage_label: string | null;
  quantity: number;
  status: string;
  due_date: string | null;
  dwell_days: number | null;
  sla_days: number | null;
  breach: boolean;
  late: boolean;
  material_coverage_pct: number | null;
  material_shortage_items: number;
  recent_occurrences: number;
};

export type ProductDigitalTwin = {
  product_id: string;
  generated_at: string;
  total_open: number;
  total_qty: number;
  breach_count: number;
  late_count: number;
  lots: TwinLot[];
  stage_summary: Array<{
    stage_key: string;
    stage_label: string;
    position: number;
    wip_orders: number;
    wip_qty: number;
  }>;
};

const input = z.object({ productId: z.string().uuid() });

export const getProductDigitalTwin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }): Promise<ProductDigitalTwin> => {
    const { supabase } = context;
    const productId = data.productId;

    const [{ data: stagesCfg }, { data: routing }, { data: orders }] = await Promise.all([
      supabase
        .from("pcp_stages")
        .select("key, label, position")
        .eq("active", true)
        .order("position"),
      supabase
        .from("product_routing")
        .select("stage_key, sla_days")
        .eq("product_id", productId),
      supabase
        .from("production_orders")
        .select(
          "id, code, quantity, status, stage, stage_updated_at, due_date, created_at",
        )
        .eq("product_id", productId)
        .in("status", ["aguardando", "em_producao"])
        .order("stage_updated_at", { ascending: true })
        .limit(200),
    ]);

    const stageOrder = new Map<string, { position: number; label: string }>();
    (stagesCfg ?? []).forEach((s, idx) =>
      stageOrder.set(s.key as string, {
        position: (s.position as number) ?? idx,
        label: s.label as string,
      }),
    );
    const stagesSorted = (stagesCfg ?? []).map((s) => s.key as string);
    const routingSla = new Map<string, number>();
    (routing ?? []).forEach((r) =>
      routingSla.set(r.stage_key as string, r.sla_days as number),
    );

    const openIds = (orders ?? []).map((o) => o.id);

    const [resRows, occRows] = await Promise.all([
      openIds.length
        ? supabase
            .from("material_reservations")
            .select("production_order_id, qty_required, qty_reserved")
            .in("production_order_id", openIds)
        : Promise.resolve({ data: [] as never[] }),
      openIds.length
        ? supabase
            .from("production_occurrences")
            .select("production_order_id, created_at")
            .in("production_order_id", openIds)
            .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString())
        : Promise.resolve({ data: [] as never[] }),
    ]);

    const resByOp = new Map<string, { req: number; res: number; shortage: number }>();
    ((resRows.data ?? []) as Array<{
      production_order_id: string;
      qty_required: number | null;
      qty_reserved: number | null;
    }>).forEach((r) => {
      const e = resByOp.get(r.production_order_id) ?? { req: 0, res: 0, shortage: 0 };
      const req = Number(r.qty_required ?? 0);
      const res = Number(r.qty_reserved ?? 0);
      e.req += req;
      e.res += res;
      if (res < req) e.shortage += 1;
      resByOp.set(r.production_order_id, e);
    });

    const occByOp = new Map<string, number>();
    ((occRows.data ?? []) as Array<{ production_order_id: string }>).forEach((o) => {
      occByOp.set(o.production_order_id, (occByOp.get(o.production_order_id) ?? 0) + 1);
    });

    const now = Date.now();
    const lots: TwinLot[] = (orders ?? []).map((o) => {
      const stageKey = String(o.stage ?? "compras");
      const meta = stageOrder.get(stageKey);
      const idx = stagesSorted.indexOf(stageKey);
      const nextKey = idx >= 0 && idx < stagesSorted.length - 1 ? stagesSorted[idx + 1] : null;
      const nextLabel = nextKey ? stageOrder.get(nextKey)?.label ?? null : null;
      const ref = o.stage_updated_at ?? o.created_at;
      const dwell = ref ? (now - new Date(ref).getTime()) / 86400000 : null;
      const sla = routingSla.get(stageKey) ?? null;
      const breach = dwell != null && sla != null && dwell > sla;
      const late = !!(o.due_date && new Date(o.due_date as string).getTime() < now);
      const r = resByOp.get(o.id);
      const coverage = r && r.req > 0 ? Math.min(100, (r.res / r.req) * 100) : null;
      return {
        id: o.id,
        code: (o.code as string) ?? o.id.slice(0, 8),
        stage: stageKey,
        stage_label: meta?.label ?? stageKey,
        stage_position: meta?.position ?? null,
        next_stage_label: nextLabel,
        quantity: Number(o.quantity ?? 0),
        status: o.status as string,
        due_date: (o.due_date as string | null) ?? null,
        dwell_days: dwell != null ? Number(dwell.toFixed(1)) : null,
        sla_days: sla,
        breach,
        late,
        material_coverage_pct: coverage != null ? Number(coverage.toFixed(0)) : null,
        material_shortage_items: r?.shortage ?? 0,
        recent_occurrences: occByOp.get(o.id) ?? 0,
      };
    });

    const stageSummary = (stagesCfg ?? []).map((s) => {
      const inStage = lots.filter((l) => l.stage === s.key);
      return {
        stage_key: s.key as string,
        stage_label: s.label as string,
        position: (s.position as number) ?? 0,
        wip_orders: inStage.length,
        wip_qty: inStage.reduce((sum, l) => sum + l.quantity, 0),
      };
    });

    return {
      product_id: productId,
      generated_at: new Date().toISOString(),
      total_open: lots.length,
      total_qty: lots.reduce((s, l) => s + l.quantity, 0),
      breach_count: lots.filter((l) => l.breach).length,
      late_count: lots.filter((l) => l.late).length,
      lots,
      stage_summary: stageSummary,
    };
  });
