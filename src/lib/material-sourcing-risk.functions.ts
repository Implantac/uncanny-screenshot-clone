import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MaterialSourcingRisk = {
  key: string; // normalized name
  displayName: string;
  productsAffected: number;
  capaCount: number;
  openCapaCount: number;
  occurrenceCount: number;
  suppliers: Array<{ id: string; name: string | null; capaCount: number; avgScore: number | null }>;
  alternateSuppliers: Array<{ id: string; name: string | null; score: number }>;
  materialLibraryIds: string[];
  products: Array<{ id: string; name: string | null; sku: string | null; capaCount: number }>;
  activeCollections: Array<{ id: string; name: string; launchDate: string | null; daysToLaunch: number | null }>;
  recommendation: string;
  riskScore: number;
  riskLabel: "critico" | "atencao" | "ok";
};

export type MaterialSourcingRisks = {
  rows: MaterialSourcingRisk[];
  summary: { materialsAtRisk: number; totalOpenCapas: number; totalProducts: number };
  insight: string;
};

const ACTIVE_STATUS = new Set(["briefing", "design", "aprovacao", "desenvolvimento", "producao"]);
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export const getMaterialSourcingRisks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MaterialSourcingRisks> => {
    const sb = context.supabase;
    const iso180 = new Date(Date.now() - 180 * 86400000).toISOString();

    const [
      { data: capas },
      { data: occs },
      { data: orders },
      { data: sheets },
      { data: tsm },
      { data: products },
      { data: suppliers },
      { data: scorecards },
      { data: cps },
      { data: collections },
      { data: matLib },
    ] = await Promise.all([
      sb
        .from("quality_capa")
        .select("id, order_id, supplier_id, status, closed_at, created_at")
        .gte("created_at", iso180)
        .limit(3000),
      sb
        .from("production_occurrences")
        .select("id, order_id, kind, status, created_at")
        .gte("created_at", iso180)
        .limit(5000),
      sb.from("production_orders").select("id, product_id"),
      sb.from("tech_sheets").select("id, product_id, status").eq("status", "aprovada"),
      sb.from("tech_sheet_materials").select("tech_sheet_id, name, unit_cost"),
      sb.from("products").select("id, name, sku"),
      sb.from("suppliers").select("id, name"),
      sb
        .from("supplier_scorecards")
        .select("supplier_id, score, computed_at")
        .order("computed_at", { ascending: false })
        .limit(2000),
      sb.from("collection_products").select("collection_id, product_id"),
      sb.from("collections").select("id, name, launch_date, status"),
      sb.from("material_library").select("id, name, preferred_supplier_id").eq("active", true),

    ]);

    type CapaRow = { id: string; order_id: string | null; supplier_id: string | null; status: string | null; closed_at: string | null };
    type OccRow = { id: string; order_id: string | null };
    type OrderRow = { id: string; product_id: string | null };
    type SheetRow = { id: string; product_id: string | null };
    type TsmRow = { tech_sheet_id: string | null; name: string | null; unit_cost: number | null };
    type ProdRow = { id: string; name: string | null; sku: string | null };
    type SupRow = { id: string; name: string | null };
    type ScRow = { supplier_id: string | null; score: number | null };
    type CpRow = { collection_id: string | null; product_id: string | null };
    type ColRow = { id: string; name: string; launch_date: string | null; status: string | null };

    const orderToProduct = new Map<string, string>();
    ((orders ?? []) as OrderRow[]).forEach((o) => o.product_id && orderToProduct.set(o.id, o.product_id));

    // product -> approved tech sheets
    const productToSheets = new Map<string, string[]>();
    ((sheets ?? []) as SheetRow[]).forEach((s) => {
      if (!s.product_id) return;
      const a = productToSheets.get(s.product_id) ?? [];
      a.push(s.id);
      productToSheets.set(s.product_id, a);
    });

    // product -> Set<materialKey>
    const productToMats = new Map<string, Map<string, string>>();
    const sheetToMats = new Map<string, TsmRow[]>();
    ((tsm ?? []) as TsmRow[]).forEach((m) => {
      if (!m.tech_sheet_id || !m.name) return;
      const a = sheetToMats.get(m.tech_sheet_id) ?? [];
      a.push(m);
      sheetToMats.set(m.tech_sheet_id, a);
    });
    for (const [pid, sheetIds] of productToSheets) {
      const mmap = new Map<string, string>();
      for (const sid of sheetIds) {
        for (const m of sheetToMats.get(sid) ?? []) {
          if (m.name) mmap.set(norm(m.name), m.name);
        }
      }
      if (mmap.size) productToMats.set(pid, mmap);
    }

    const productMap = new Map<string, ProdRow>();
    ((products ?? []) as ProdRow[]).forEach((p) => productMap.set(p.id, p));

    const supplierMap = new Map<string, SupRow>();
    ((suppliers ?? []) as SupRow[]).forEach((s) => supplierMap.set(s.id, s));

    const latestScore = new Map<string, number>();
    ((scorecards ?? []) as ScRow[]).forEach((s) => {
      if (s.supplier_id && !latestScore.has(s.supplier_id) && s.score != null) {
        latestScore.set(s.supplier_id, Number(s.score));
      }
    });

    // productId -> collections
    const productToCols = new Map<string, string[]>();
    ((cps ?? []) as CpRow[]).forEach((cp) => {
      if (!cp.collection_id || !cp.product_id) return;
      const a = productToCols.get(cp.product_id) ?? [];
      a.push(cp.collection_id);
      productToCols.set(cp.product_id, a);
    });
    const collectionMap = new Map<string, ColRow>();
    ((collections ?? []) as ColRow[]).forEach((c) => collectionMap.set(c.id, c));

    // Aggregate CAPAs & occurrences by material key
    type MatAgg = {
      displayName: string;
      products: Map<string, number>; // productId -> capaCount
      suppliers: Map<string, number>; // supplierId -> capaCount
      capas: Set<string>;
      openCapas: number;
      occs: number;
    };
    const matAgg = new Map<string, MatAgg>();

    const registerCapa = (pid: string, capa: CapaRow) => {
      const mats = productToMats.get(pid);
      if (!mats) return;
      for (const [key, display] of mats) {
        const agg = matAgg.get(key) ?? {
          displayName: display,
          products: new Map(),
          suppliers: new Map(),
          capas: new Set(),
          openCapas: 0,
          occs: 0,
        };
        agg.products.set(pid, (agg.products.get(pid) ?? 0) + 1);
        agg.capas.add(capa.id);
        const isOpen = !capa.closed_at && capa.status !== "concluida" && capa.status !== "fechada";
        if (isOpen) agg.openCapas++;
        if (capa.supplier_id) agg.suppliers.set(capa.supplier_id, (agg.suppliers.get(capa.supplier_id) ?? 0) + 1);
        matAgg.set(key, agg);
      }
    };

    ((capas ?? []) as CapaRow[]).forEach((c) => {
      if (!c.order_id) return;
      const pid = orderToProduct.get(c.order_id);
      if (pid) registerCapa(pid, c);
    });

    ((occs ?? []) as OccRow[]).forEach((o) => {
      if (!o.order_id) return;
      const pid = orderToProduct.get(o.order_id);
      if (!pid) return;
      const mats = productToMats.get(pid);
      if (!mats) return;
      for (const [key, display] of mats) {
        const agg = matAgg.get(key) ?? {
          displayName: display,
          products: new Map(),
          suppliers: new Map(),
          capas: new Set(),
          openCapas: 0,
          occs: 0,
        };
        agg.occs++;
        matAgg.set(key, agg);
      }
    });

    const now = Date.now();
    const rows: MaterialSourcingRisk[] = [];
    for (const [key, agg] of matAgg) {
      if (agg.products.size < 2 && agg.capas.size < 2) continue; // must be systemic

      const productsList = [...agg.products.entries()]
        .map(([id, capaCount]) => {
          const p = productMap.get(id);
          return { id, name: p?.name ?? null, sku: p?.sku ?? null, capaCount };
        })
        .sort((a, b) => b.capaCount - a.capaCount);

      const suppliersList = [...agg.suppliers.entries()]
        .map(([id, capaCount]) => {
          const s = supplierMap.get(id);
          const sc = latestScore.get(id);
          return { id, name: s?.name ?? null, capaCount, avgScore: sc ?? null };
        })
        .sort((a, b) => b.capaCount - a.capaCount);

      const colSet = new Set<string>();
      for (const [pid] of agg.products) {
        for (const cid of productToCols.get(pid) ?? []) colSet.add(cid);
      }
      const activeCollections = [...colSet]
        .map((cid) => collectionMap.get(cid))
        .filter((c): c is ColRow => !!c && (c.status ? ACTIVE_STATUS.has(c.status) : true))
        .map((c) => {
          const days = c.launch_date
            ? Math.ceil((new Date(c.launch_date).getTime() - now) / 86400000)
            : null;
          return { id: c.id, name: c.name, launchDate: c.launch_date, daysToLaunch: days };
        })
        .sort((a, b) => (a.daysToLaunch ?? 9999) - (b.daysToLaunch ?? 9999));

      const nearestDays = activeCollections[0]?.daysToLaunch ?? null;
      const proxPenalty =
        nearestDays == null ? 5 : nearestDays < 15 ? 40 : nearestDays < 30 ? 30 : nearestDays < 60 ? 20 : 10;
      const raw = agg.openCapas * 6 + agg.products.size * 5 + Math.min(agg.occs, 30) + proxPenalty;
      const riskScore = Math.min(100, Math.round(raw));
      const riskLabel: MaterialSourcingRisk["riskLabel"] =
        riskScore >= 55 ? "critico" : riskScore >= 30 ? "atencao" : "ok";

      const worstSup = suppliersList[0];
      let recommendation: string;
      if (worstSup && worstSup.avgScore != null && worstSup.avgScore < 60) {
        recommendation = `Substituir fornecedor **${worstSup.name ?? worstSup.id.slice(0, 6)}** (score ${Math.round(worstSup.avgScore)}) — atinge ${agg.products.size} produto(s) via *${agg.displayName}*.`;
      } else if (agg.products.size >= 3) {
        recommendation = `Revisar especificação do material *${agg.displayName}* no BOM — falha sistêmica em ${agg.products.size} produtos.`;
      } else if (nearestDays != null && nearestDays < 30) {
        recommendation = `Trocar *${agg.displayName}* na coleção *${activeCollections[0].name}* antes do lançamento (${nearestDays}d).`;
      } else {
        recommendation = `Monitorar *${agg.displayName}* — ${agg.capas.size} CAPAs / ${agg.occs} ocorrências em 180d.`;
      }

      rows.push({
        key,
        displayName: agg.displayName,
        productsAffected: agg.products.size,
        capaCount: agg.capas.size,
        openCapaCount: agg.openCapas,
        occurrenceCount: agg.occs,
        suppliers: suppliersList.slice(0, 4),
        products: productsList.slice(0, 6),
        activeCollections: activeCollections.slice(0, 4),
        recommendation,
        riskScore,
        riskLabel,
      });
    }

    rows.sort((a, b) => b.riskScore - a.riskScore);

    const materialsAtRisk = rows.filter((r) => r.riskLabel !== "ok").length;
    const totalOpenCapas = rows.reduce((s, r) => s + r.openCapaCount, 0);
    const totalProducts = new Set(rows.flatMap((r) => r.products.map((p) => p.id))).size;
    const worst = rows[0];
    const insight =
      !worst || worst.riskLabel === "ok"
        ? "✅ Nenhum material com falha sistêmica identificada nos últimos 180 dias."
        : `🚨 *${worst.displayName}* concentra ${worst.capaCount} CAPAs em ${worst.productsAffected} produto(s). ${worst.recommendation}`;

    return {
      rows: rows.slice(0, 10),
      summary: { materialsAtRisk, totalOpenCapas, totalProducts },
      insight,
    };
  });
