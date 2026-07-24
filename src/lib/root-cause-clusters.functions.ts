import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Wave 23 — Root-cause automático
 * Agrupa ocorrências negativas dos últimos N dias por
 * (sector, kind, supplier_id, product_id) e sugere onde abrir CAPA.
 */

const KIND_NEGATIVE = new Set([
  "negativa",
  "falta_material",
  "erro_corte",
  "defeito_costura",
  "quebra_maquina",
  "atraso_fornecedor",
  "retrabalho",
  "descarte",
]);

export type RootCauseCluster = {
  key: string;
  sector: string | null;
  kind: string;
  supplier_id: string | null;
  supplier_name: string | null;
  product_id: string | null;
  product_name: string | null;
  product_sku: string | null;
  occurrences: number;
  affected_qty: number;
  distinct_orders: number;
  first_seen: string;
  last_seen: string;
  order_ids: string[];
  occurrence_ids: string[];
  has_open_capa: boolean;
  open_capa_id: string | null;
  severity: "baixa" | "media" | "alta" | "critica";
  score: number;
};

const InputSchema = z
  .object({
    windowDays: z.number().int().min(7).max(365).default(60),
    minOccurrences: z.number().int().min(2).max(50).default(3),
  })
  .default({ windowDays: 60, minOccurrences: 3 });

export const getRootCauseClusters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => InputSchema.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<RootCauseCluster[]> => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - data.windowDays * 86400_000).toISOString();

    const { data: occs, error } = await supabase
      .from("production_occurrences")
      .select("id, sector, kind, status, affected_qty, order_id, created_at")
      .eq("owner_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(3000);
    if (error) throw new Error(error.message);

    const negs = (occs ?? []).filter((o) => KIND_NEGATIVE.has(o.kind as string));
    if (negs.length === 0) return [];

    const orderIds = Array.from(
      new Set(negs.map((o) => o.order_id).filter(Boolean) as string[]),
    );

    const [ordersRes, capasRes] = await Promise.all([
      orderIds.length
        ? supabase
            .from("production_orders")
            .select("id, supplier_id, product_id")
            .in("id", orderIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      supabase
        .from("quality_capa")
        .select("id, supplier_id, occurrence_id, order_id, status")
        .eq("owner_id", userId)
        .in("status", ["aberta", "em_andamento"]),
    ]);

    const orders = (ordersRes.data ?? []) as {
      id: string;
      supplier_id: string | null;
      product_id: string | null;
    }[];
    const orderMap = new Map(orders.map((o) => [o.id, o]));

    const supplierIds = Array.from(
      new Set(orders.map((o) => o.supplier_id).filter(Boolean) as string[]),
    );
    const productIds = Array.from(
      new Set(orders.map((o) => o.product_id).filter(Boolean) as string[]),
    );

    const [supRes, prodRes] = await Promise.all([
      supplierIds.length
        ? supabase.from("suppliers").select("id, name").in("id", supplierIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      productIds.length
        ? supabase.from("products").select("id, name, sku").in("id", productIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);

    const supMap = new Map(((supRes.data ?? []) as any[]).map((s) => [s.id, s.name as string]));
    const prodMap = new Map(
      ((prodRes.data ?? []) as any[]).map((p) => [
        p.id,
        { name: p.name as string, sku: p.sku as string | null },
      ]),
    );

    const capas = (capasRes.data ?? []) as {
      id: string;
      supplier_id: string | null;
      order_id: string | null;
      status: string;
    }[];

    type Bucket = Omit<RootCauseCluster, "severity" | "score" | "has_open_capa" | "open_capa_id"> & {
      _orders: Set<string>;
    };
    const buckets = new Map<string, Bucket>();

    for (const o of negs) {
      const ord = o.order_id ? orderMap.get(o.order_id) ?? null : null;
      const supplier_id = ord?.supplier_id ?? null;
      const product_id = ord?.product_id ?? null;
      const sector = (o.sector as string) ?? null;
      const kind = o.kind as string;
      const key = [sector ?? "-", kind, supplier_id ?? "-", product_id ?? "-"].join("|");

      let b = buckets.get(key);
      if (!b) {
        const p = product_id ? prodMap.get(product_id) : null;
        b = {
          key,
          sector,
          kind,
          supplier_id,
          supplier_name: supplier_id ? supMap.get(supplier_id) ?? null : null,
          product_id,
          product_name: p?.name ?? null,
          product_sku: p?.sku ?? null,
          occurrences: 0,
          affected_qty: 0,
          distinct_orders: 0,
          first_seen: o.created_at as string,
          last_seen: o.created_at as string,
          order_ids: [],
          occurrence_ids: [],
          _orders: new Set(),
        };
        buckets.set(key, b);
      }
      b.occurrences += 1;
      b.affected_qty += Number(o.affected_qty ?? 0);
      b.occurrence_ids.push(o.id as string);
      if (o.order_id) b._orders.add(o.order_id as string);
      const created = o.created_at as string;
      if (created < b.first_seen) b.first_seen = created;
      if (created > b.last_seen) b.last_seen = created;
    }

    const clusters: RootCauseCluster[] = [];
    for (const b of buckets.values()) {
      if (b.occurrences < data.minOccurrences) continue;
      const openCapa = capas.find(
        (c) =>
          (b.supplier_id && c.supplier_id === b.supplier_id) ||
          b._orders.has(c.order_id ?? "") ||
          b.occurrence_ids.some((oid) => c.occurrence_id === oid),
      );
      const distinct = b._orders.size;
      // score = ocorrências × (1 + qty/100) × (1 + distinct_orders/5)
      const score = Math.round(
        b.occurrences * (1 + b.affected_qty / 100) * (1 + distinct / 5) * 10,
      ) / 10;
      const severity: RootCauseCluster["severity"] =
        score >= 60 ? "critica" : score >= 30 ? "alta" : score >= 12 ? "media" : "baixa";
      clusters.push({
        key: b.key,
        sector: b.sector,
        kind: b.kind,
        supplier_id: b.supplier_id,
        supplier_name: b.supplier_name,
        product_id: b.product_id,
        product_name: b.product_name,
        product_sku: b.product_sku,
        occurrences: b.occurrences,
        affected_qty: b.affected_qty,
        distinct_orders: distinct,
        first_seen: b.first_seen,
        last_seen: b.last_seen,
        order_ids: Array.from(b._orders),
        occurrence_ids: b.occurrence_ids,
        has_open_capa: Boolean(openCapa),
        open_capa_id: openCapa?.id ?? null,
        severity,
        score,
      });
    }

    clusters.sort((a, b) => b.score - a.score);
    return clusters.slice(0, 40);
  });
