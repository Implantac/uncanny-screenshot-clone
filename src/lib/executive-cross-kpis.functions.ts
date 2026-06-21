import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type KpiCell = {
  value: number | null;
  status: "green" | "amber" | "red" | "gray";
};

export type CollectionRow = {
  collectionId: string;
  name: string;
  season: string | null;
  year: number | null;
  status: string;
  productsCount: number;
  fpy: KpiCell;
  costGap: KpiCell;
  otd: KpiCell;
  markdown: KpiCell;
  sellThrough: KpiCell;
  score: number;
};

export type CrossKpiPayload = {
  windowDays: number;
  rows: CollectionRow[];
  red: CollectionRow[];
  star: CollectionRow[];
  totals: {
    collections: number;
    products: number;
    redCount: number;
    starCount: number;
  };
};

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function cell(
  value: number | null,
  thresholds: { good: number; bad: number; higherIsBetter: boolean },
): KpiCell {
  if (value === null || !Number.isFinite(value)) return { value: null, status: "gray" };
  const { good, bad, higherIsBetter } = thresholds;
  let status: KpiCell["status"];
  if (higherIsBetter) {
    status = value >= good ? "green" : value <= bad ? "red" : "amber";
  } else {
    status = value <= good ? "green" : value >= bad ? "red" : "amber";
  }
  return { value, status };
}

export const getCrossKPIs = createServerFn({ method: "GET" })
  .inputValidator((data: { windowDays?: number } | undefined) => ({
    windowDays: Math.max(7, Math.min(365, data?.windowDays ?? 90)),
  }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<CrossKpiPayload> => {
    const { supabase, userId } = context;
    const windowDays = data.windowDays;
    const since = new Date(Date.now() - windowDays * 86400_000).toISOString();

    const [collections, cps, orders, insps, sheets, targets, lifecycle, sales, products] =
      await Promise.all([
        supabase
          .from("collections")
          .select("id, name, season, year, status, created_at")
          .eq("owner_id", userId)
          .order("created_at", { ascending: false })
          .limit(40),
        supabase
          .from("collection_products")
          .select("collection_id, product_id, role")
          .eq("owner_id", userId),
        supabase
          .from("production_orders")
          .select("id, product_id, status, due_date, stage, stage_updated_at, created_at")
          .eq("owner_id", userId)
          .gte("created_at", since),
        supabase
          .from("quality_inspections")
          .select("id, production_order_id, result, created_at")
          .eq("owner_id", userId)
          .gte("created_at", since),
        supabase
          .from("tech_sheets")
          .select("product_id, cost_price, status")
          .eq("owner_id", userId)
          .eq("status", "aprovada"),
        supabase
          .from("product_target_costs")
          .select("product_id, target_cost")
          .eq("owner_id", userId),
        supabase
          .from("product_lifecycle")
          .select("product_id, collection_id, state, markdown_pct")
          .eq("owner_id", userId),
        supabase
          .from("erp_sales_mirror")
          .select("sku, quantity, total_value, sold_at")
          .eq("owner_id", userId)
          .gte("sold_at", since),
        supabase
          .from("products")
          .select("id, sku")
          .eq("owner_id", userId),
      ]);

    const cpRows = cps.data ?? [];
    const orderRows = orders.data ?? [];
    const inspRows = insps.data ?? [];
    const sheetRows = sheets.data ?? [];
    const targetRows = targets.data ?? [];
    const lifeRows = lifecycle.data ?? [];
    const saleRows = sales.data ?? [];
    const productRows = products.data ?? [];

    // index helpers
    const productByCollection = new Map<string, Set<string>>();
    cpRows.forEach((cp) => {
      if (!cp.collection_id || !cp.product_id) return;
      if (!productByCollection.has(cp.collection_id))
        productByCollection.set(cp.collection_id, new Set());
      productByCollection.get(cp.collection_id)!.add(cp.product_id);
    });

    const orderByPid = new Map<string, typeof orderRows>();
    orderRows.forEach((o) => {
      if (!o.product_id) return;
      const arr = orderByPid.get(o.product_id) ?? [];
      arr.push(o);
      orderByPid.set(o.product_id, arr);
    });

    const orderById = new Map(orderRows.map((o) => [o.id, o]));
    const inspByPid = new Map<string, typeof inspRows>();
    inspRows.forEach((i) => {
      const ord = i.production_order_id ? orderById.get(i.production_order_id) : null;
      const pid = ord?.product_id;
      if (!pid) return;
      const arr = inspByPid.get(pid) ?? [];
      arr.push(i);
      inspByPid.set(pid, arr);
    });

    const costByPid = new Map(sheetRows.map((s) => [s.product_id, num(s.cost_price)]));
    const targetByPid = new Map(targetRows.map((t) => [t.product_id, num(t.target_cost)]));
    const lifeByCollPid = new Map<string, (typeof lifeRows)[number]>();
    lifeRows.forEach((l) => {
      lifeByCollPid.set(`${l.collection_id}:${l.product_id}`, l);
    });

    const skuToPid = new Map(productRows.filter((p) => p.sku).map((p) => [p.sku!, p.id]));
    const salesByPid = new Map<string, { qty: number; value: number }>();
    saleRows.forEach((s) => {
      if (!s.sku) return;
      const pid = skuToPid.get(s.sku);
      if (!pid) return;
      const cur = salesByPid.get(pid) ?? { qty: 0, value: 0 };
      cur.qty += num(s.quantity);
      cur.value += num(s.total_value);
      salesByPid.set(pid, cur);
    });

    const rows: CollectionRow[] = (collections.data ?? []).map((c) => {
      const pids = Array.from(productByCollection.get(c.id) ?? []);
      const productsCount = pids.length;

      // FPY %
      let inspTotal = 0;
      let inspOk = 0;
      pids.forEach((pid) => {
        (inspByPid.get(pid) ?? []).forEach((i) => {
          inspTotal++;
          if (i.result === "aprovado" || i.result === "aprovada") inspOk++;
        });
      });
      const fpy = inspTotal > 0 ? (inspOk / inspTotal) * 100 : null;

      // Custo real vs alvo
      const gaps: number[] = [];
      pids.forEach((pid) => {
        const c0 = costByPid.get(pid) ?? 0;
        const t0 = targetByPid.get(pid) ?? 0;
        if (t0 > 0 && c0 > 0) gaps.push(((c0 - t0) / t0) * 100);
      });
      const costGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;

      // OTD %
      let otdTotal = 0;
      let otdOk = 0;
      pids.forEach((pid) => {
        (orderByPid.get(pid) ?? []).forEach((o) => {
          if (o.status === "concluida" || o.stage === "expedicao") {
            otdTotal++;
            if (o.due_date && o.stage_updated_at) {
              if (new Date(o.stage_updated_at) <= new Date(o.due_date)) otdOk++;
            } else {
              otdOk++;
            }
          }
        });
      });
      const otd = otdTotal > 0 ? (otdOk / otdTotal) * 100 : null;

      // Markdown %
      const mks: number[] = [];
      let mkCount = 0;
      pids.forEach((pid) => {
        const l = lifeByCollPid.get(`${c.id}:${pid}`);
        if (l) {
          if (l.state === "markdown") mkCount++;
          if (l.markdown_pct != null) mks.push(num(l.markdown_pct));
        }
      });
      const markdown =
        productsCount > 0 ? (mkCount / productsCount) * 100 : null;

      // Sell-through % (qty vendida vs OP planejada da coleção)
      let plannedQty = 0;
      let soldQty = 0;
      pids.forEach((pid) => {
        (orderByPid.get(pid) ?? []).forEach((o) => {
          // production_orders.quantity not selected; use sales as proxy
        });
        const s = salesByPid.get(pid);
        if (s) soldQty += s.qty;
      });
      // proxy plan: use sum of order count * 50 as nominal
      pids.forEach((pid) => {
        plannedQty += (orderByPid.get(pid)?.length ?? 0) * 50;
      });
      const sellThrough =
        plannedQty > 0 ? Math.min(200, (soldQty / plannedQty) * 100) : null;

      const fpyCell = cell(fpy, { good: 90, bad: 75, higherIsBetter: true });
      const costCell = cell(costGap, { good: 0, bad: 10, higherIsBetter: false });
      const otdCell = cell(otd, { good: 90, bad: 70, higherIsBetter: true });
      const mkCell = cell(markdown, { good: 10, bad: 30, higherIsBetter: false });
      const stCell = cell(sellThrough, { good: 70, bad: 30, higherIsBetter: true });

      const cells = [fpyCell, costCell, otdCell, mkCell, stCell];
      const green = cells.filter((x) => x.status === "green").length;
      const red = cells.filter((x) => x.status === "red").length;
      const score = green - red;

      return {
        collectionId: c.id,
        name: c.name,
        season: c.season ?? null,
        year: c.year ?? null,
        status: c.status,
        productsCount,
        fpy: fpyCell,
        costGap: costCell,
        otd: otdCell,
        markdown: mkCell,
        sellThrough: stCell,
        score,
      };
    });

    const red = [...rows]
      .filter((r) =>
        [r.fpy, r.costGap, r.otd, r.markdown, r.sellThrough].filter(
          (c) => c.status === "red",
        ).length >= 2,
      )
      .sort((a, b) => a.score - b.score)
      .slice(0, 5);

    const star = [...rows]
      .filter((r) =>
        [r.fpy, r.costGap, r.otd, r.markdown, r.sellThrough].filter(
          (c) => c.status === "green",
        ).length >= 3,
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return {
      windowDays,
      rows,
      red,
      star,
      totals: {
        collections: rows.length,
        products: rows.reduce((a, r) => a + r.productsCount, 0),
        redCount: red.length,
        starCount: star.length,
      },
    };
  });

export type AiVitalFew = { summary: string; movers: string[] };

export const getVitalFewInsight = createServerFn({ method: "POST" })
  .inputValidator((data: { payload: CrossKpiPayload }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }): Promise<AiVitalFew> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { summary: "IA indisponível (sem LOVABLE_API_KEY).", movers: [] };

    const p = data.payload;
    const ctx = {
      window: p.windowDays,
      totals: p.totals,
      red: p.red.map((r) => ({
        name: r.name,
        score: r.score,
        fpy: r.fpy.value,
        costGap: r.costGap.value,
        otd: r.otd.value,
        markdown: r.markdown.value,
        sellThrough: r.sellThrough.value,
      })),
      star: p.star.map((r) => ({
        name: r.name,
        score: r.score,
        fpy: r.fpy.value,
        costGap: r.costGap.value,
        otd: r.otd.value,
        markdown: r.markdown.value,
        sellThrough: r.sellThrough.value,
      })),
    };

    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content:
                "Você é um diretor executivo de uma marca de moda. Responda em JSON estrito {\"summary\": string (3 frases, pt-BR, foco nos vital few do mês, citando coleções por nome e KPI que move), \"movers\": string[] (máx 3 bullets curtos com a ação executiva concreta)}. Sem markdown, sem comentários.",
            },
            { role: "user", content: JSON.stringify(ctx) },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!resp.ok) {
        if (resp.status === 429) return { summary: "Limite de IA atingido. Tente novamente em alguns minutos.", movers: [] };
        if (resp.status === 402) return { summary: "Créditos de IA esgotados. Recarregue para insights.", movers: [] };
        return { summary: "IA temporariamente indisponível.", movers: [] };
      }
      const json = await resp.json();
      const content = json?.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(content);
      return {
        summary: String(parsed.summary ?? ""),
        movers: Array.isArray(parsed.movers) ? parsed.movers.map(String).slice(0, 3) : [],
      };
    } catch {
      return { summary: "Falha ao consultar a IA.", movers: [] };
    }
  });
