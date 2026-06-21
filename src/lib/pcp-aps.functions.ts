import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type OrderRow = {
  id: string;
  code: string;
  product_id: string | null;
  supplier_id: string | null;
  quantity: number | null;
  due_date: string | null;
  stage: string | null;
  status: string | null;
  priority: number | null;
  stage_updated_at: string | null;
  updated_at: string | null;
  started_at: string | null;
  notes: string | null;
};

type ProductRow = {
  id: string;
  name: string | null;
  sku: string | null;
  product_group: string | null;
  category: string | null;
};

const ACTIVE_STATUSES = ["aguardando", "em_producao", "atrasada"] as const;
const TERMINAL_STAGES = ["entregue"];
const STALL_HOURS = 4;

/**
 * APS: ordena OPs ativas por score composto:
 *   - urgência (proximidade do due_date)
 *   - prioridade (1=baixa..5=alta)
 *   - agrupamento por família (product_group/category) no mesmo estágio → reduz setup
 *   - tempo parado no estágio atual
 *
 * Retorna lista rankeada com motivo curto (explicabilidade).
 */
export const getApsSuggestion = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: orders, error } = await supabase
      .from("production_orders")
      .select(
        "id, code, product_id, supplier_id, quantity, due_date, stage, status, priority, stage_updated_at, updated_at, started_at, notes",
      )
      .eq("owner_id", userId)
      .in("status", ACTIVE_STATUSES)
      .order("due_date", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);

    const rows = (orders ?? []) as OrderRow[];
    const activeOrders = rows.filter((o) => !TERMINAL_STAGES.includes(o.stage ?? ""));

    const productIds = Array.from(
      new Set(activeOrders.map((o) => o.product_id).filter(Boolean) as string[]),
    );
    const products: Record<string, ProductRow> = {};
    if (productIds.length) {
      const { data: prods } = await supabase
        .from("products")
        .select("id, name, sku, product_group, category")
        .in("id", productIds);
      for (const p of (prods ?? []) as ProductRow[]) products[p.id] = p;
    }

    const now = Date.now();
    const familyOf = (p: ProductRow | null | undefined) =>
      p?.product_group ?? p?.category ?? "_";

    const peerCount = new Map<string, number>();
    for (const o of activeOrders) {
      const p = o.product_id ? products[o.product_id] : null;
      const key = `${o.stage}|${familyOf(p)}`;
      peerCount.set(key, (peerCount.get(key) ?? 0) + 1);
    }

    const scored = activeOrders.map((o) => {
      const product = o.product_id ? products[o.product_id] : null;
      const daysToDue = o.due_date
        ? Math.ceil((new Date(o.due_date).getTime() - now) / 86400000)
        : 30;
      const urgencyScore = daysToDue <= 0 ? 100 : Math.max(0, 60 - daysToDue * 4);
      const priorityScore = Math.max(0, ((o.priority ?? 3) - 1) * 10);
      const peers = (peerCount.get(`${o.stage}|${familyOf(product)}`) ?? 1) - 1;
      const setupScore = Math.min(15, peers * 5);
      const stallHours = o.stage_updated_at
        ? (now - new Date(o.stage_updated_at).getTime()) / 3_600_000
        : 0;
      const stallScore = Math.min(25, Math.max(0, (stallHours - 2) * 2));
      const score = urgencyScore + priorityScore + setupScore + stallScore;

      const reasons: string[] = [];
      if (daysToDue <= 0) reasons.push(`vencido há ${Math.abs(daysToDue)}d`);
      else if (daysToDue <= 3) reasons.push(`prazo em ${daysToDue}d`);
      if ((o.priority ?? 3) >= 4) reasons.push("prioridade alta");
      if (peers >= 1)
        reasons.push(`agrupar com ${peers} OP${peers > 1 ? "s" : ""} mesma família em ${o.stage}`);
      if (stallHours >= STALL_HOURS)
        reasons.push(`parado há ${Math.round(stallHours)}h no estágio`);

      return {
        id: o.id,
        code: o.code,
        product_name: product?.name ?? null,
        product_sku: product?.sku ?? null,
        stage: o.stage,
        priority: o.priority ?? 3,
        due_date: o.due_date,
        days_to_due: daysToDue,
        stall_hours: Math.round(stallHours * 10) / 10,
        score: Math.round(score),
        reason: reasons.length ? reasons.join(" · ") : "fila normal",
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 20);
  });

/**
 * Lista OPs paradas há mais de N horas no estágio atual (default 4h).
 */
export const getStalledOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const threshold = new Date(Date.now() - STALL_HOURS * 3_600_000).toISOString();

    const { data, error } = await supabase
      .from("production_orders")
      .select("id, code, product_id, stage, status, priority, stage_updated_at, due_date")
      .eq("owner_id", userId)
      .in("status", ACTIVE_STATUSES)
      .lt("stage_updated_at", threshold)
      .order("stage_updated_at", { ascending: true });
    if (error) throw new Error(error.message);

    const rows = (data ?? []).filter(
      (r) => !TERMINAL_STAGES.includes(r.stage ?? ""),
    ) as OrderRow[];

    const pids = Array.from(new Set(rows.map((r) => r.product_id).filter(Boolean) as string[]));
    const products: Record<string, ProductRow> = {};
    if (pids.length) {
      const { data: prods } = await supabase
        .from("products")
        .select("id, name, sku, product_group, category")
        .in("id", pids);
      for (const p of (prods ?? []) as ProductRow[]) products[p.id] = p;
    }

    const now = Date.now();
    return rows.map((r) => {
      const hours = r.stage_updated_at
        ? (now - new Date(r.stage_updated_at).getTime()) / 3_600_000
        : 0;
      const product = r.product_id ? products[r.product_id] : null;
      return {
        id: r.id,
        code: r.code,
        product_name: product?.name ?? null,
        product_sku: product?.sku ?? null,
        stage: r.stage,
        priority: r.priority ?? 3,
        due_date: r.due_date,
        stage_updated_at: r.stage_updated_at,
        stall_hours: Math.round(hours * 10) / 10,
        severity: hours >= 24 ? "critica" : hours >= 8 ? "alta" : "media",
      };
    });
  });
