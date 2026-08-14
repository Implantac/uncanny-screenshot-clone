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
  activeCollections: Array<{
    id: string;
    name: string;
    launchDate: string | null;
    daysToLaunch: number | null;
  }>;
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

    type CapaRow = {
      id: string;
      order_id: string | null;
      supplier_id: string | null;
      status: string | null;
      closed_at: string | null;
    };
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
    ((orders ?? []) as OrderRow[]).forEach(
      (o) => o.product_id && orderToProduct.set(o.id, o.product_id),
    );

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

    // material_library index by normalized name
    type MatLibRow = { id: string; name: string | null; preferred_supplier_id: string | null };
    const matLibByKey = new Map<string, MatLibRow[]>();
    ((matLib ?? []) as MatLibRow[]).forEach((m) => {
      if (!m.name) return;
      const k = norm(m.name);
      const a = matLibByKey.get(k) ?? [];
      a.push(m);
      matLibByKey.set(k, a);
    });

    // Ranked alternate suppliers pool (score desc, score >= 60)
    const rankedSuppliers = [...latestScore.entries()]
      .filter(([, sc]) => sc >= 60)
      .sort((a, b) => b[1] - a[1])
      .map(([id, score]) => ({
        id,
        name: supplierMap.get(id)?.name ?? null,
        score: Math.round(score),
      }));

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
        if (capa.supplier_id)
          agg.suppliers.set(capa.supplier_id, (agg.suppliers.get(capa.supplier_id) ?? 0) + 1);
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
        nearestDays == null
          ? 5
          : nearestDays < 15
            ? 40
            : nearestDays < 30
              ? 30
              : nearestDays < 60
                ? 20
                : 10;
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

      const excluded = new Set(suppliersList.map((s) => s.id));
      const alternateSuppliers = rankedSuppliers.filter((s) => !excluded.has(s.id)).slice(0, 5);
      const materialLibraryIds = (matLibByKey.get(key) ?? []).map((m) => m.id);

      rows.push({
        key,
        displayName: agg.displayName,
        productsAffected: agg.products.size,
        capaCount: agg.capas.size,
        openCapaCount: agg.openCapas,
        occurrenceCount: agg.occs,
        suppliers: suppliersList.slice(0, 4),
        alternateSuppliers,
        materialLibraryIds,
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

export type MaterialSupplierSwapResult =
  | {
      blocked: true;
      worstPct: number;
      worstProductName: string | null;
      worstSku: string | null;
      threshold: number;
      affectedActive: number;
    }
  | {
      blocked: false;
      updated: number;
      ids: string[];
      worstPct: number | null;
      overridden: boolean;
    };

const GUARDRAIL_PCT = 10;
const ACTIVE_PRODUCT_STATUS = new Set(["desenvolvimento", "aprovado", "producao"]);

export const applyMaterialSupplierSwap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      materialKey: string;
      newSupplierId: string;
      materialLibraryIds?: string[];
      override?: { reason: string };
    }) => data,
  )
  .handler(async ({ data, context }): Promise<MaterialSupplierSwapResult> => {
    const sb = context.supabase;
    const key = data.materialKey.trim().toLowerCase().replace(/\s+/g, " ");
    const nk = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

    // --- Guardrail: simulate impact on ACTIVE product tech sheets before applying ---
    const { data: tsmAll } = await sb
      .from("tech_sheet_materials")
      .select("tech_sheet_id, name, total_cost, consumption, loss_pct");
    type TsmLite = {
      tech_sheet_id: string;
      name: string | null;
      total_cost: number | null;
      consumption: number | null;
      loss_pct: number | null;
    };
    const matching = ((tsmAll ?? []) as TsmLite[]).filter((m) => m.name && nk(m.name) === key);
    const sheetIds = [...new Set(matching.map((m) => m.tech_sheet_id))];

    let worstPct: number | null = null;
    let worstName: string | null = null;
    let worstSku: string | null = null;
    let affectedActive = 0;

    if (sheetIds.length > 0) {
      const { data: matLib } = await sb
        .from("material_library")
        .select("id, name, preferred_supplier_id, reference_cost")
        .eq("active", true);
      type MLR = {
        id: string;
        name: string | null;
        preferred_supplier_id: string | null;
        reference_cost: number | null;
      };
      const sameName = ((matLib ?? []) as MLR[]).filter((m) => m.name && nk(m.name) === key);
      let estUnit: number | null = null;
      const specific = sameName.find((m) => m.preferred_supplier_id === data.newSupplierId);
      if (specific?.reference_cost && specific.reference_cost > 0)
        estUnit = Number(specific.reference_cost);
      else {
        const withCost = sameName.filter((m) => m.reference_cost && m.reference_cost > 0);
        if (withCost.length)
          estUnit =
            withCost.reduce((s, m) => s + Number(m.reference_cost ?? 0), 0) / withCost.length;
      }

      if (estUnit != null) {
        const { data: sheets } = await sb
          .from("tech_sheets")
          .select("id, product_id, cost_price, overhead_pct")
          .in("id", sheetIds);
        type SR = {
          id: string;
          product_id: string | null;
          cost_price: number | null;
          overhead_pct: number | null;
        };
        const sRows = (sheets ?? []) as SR[];
        const productIds = [
          ...new Set(sRows.map((s) => s.product_id).filter((x): x is string => !!x)),
        ];
        const { data: prods } = productIds.length
          ? await sb.from("products").select("id, name, sku, status").in("id", productIds)
          : {
              data: [] as {
                id: string;
                name: string | null;
                sku: string | null;
                status: string | null;
              }[],
            };
        const prodMap = new Map((prods ?? []).map((p) => [p.id, p]));

        const linesBySheet = new Map<string, TsmLite[]>();
        for (const m of matching) {
          const a = linesBySheet.get(m.tech_sheet_id) ?? [];
          a.push(m);
          linesBySheet.set(m.tech_sheet_id, a);
        }

        for (const sheet of sRows) {
          const prod = sheet.product_id ? prodMap.get(sheet.product_id) : null;
          if (!prod || !prod.status || !ACTIVE_PRODUCT_STATUS.has(prod.status)) continue;
          const lines = linesBySheet.get(sheet.id) ?? [];
          if (lines.length === 0) continue;
          const currentLine = lines.reduce((s, l) => s + Number(l.total_cost ?? 0), 0);
          const projLine = lines.reduce((s, l) => {
            const cons = Number(l.consumption ?? 0);
            const loss = Number(l.loss_pct ?? 0);
            return s + estUnit! * cons * (1 + loss / 100);
          }, 0);
          const overheadMult = 1 + Number(sheet.overhead_pct ?? 0) / 100;
          const finalDelta = (projLine - currentLine) * overheadMult;
          const currentCost = Number(sheet.cost_price ?? 0);
          if (currentCost <= 0) continue;
          const pct = (finalDelta / currentCost) * 100;
          affectedActive++;
          if (worstPct == null || Math.abs(pct) > Math.abs(worstPct)) {
            worstPct = pct;
            worstName = prod.name;
            worstSku = prod.sku;
          }
        }

        if (!data.override && worstPct != null && Math.abs(worstPct) > GUARDRAIL_PCT) {
          return {
            blocked: true,
            worstPct,
            worstProductName: worstName,
            worstSku,
            threshold: GUARDRAIL_PCT,
            affectedActive,
          };
        }
      }
    }

    // --- Apply the swap ---
    const { data: rows, error } = await sb
      .from("material_library")
      .select("id, name")
      .eq("active", true);
    if (error) throw error;

    const targetIds = new Set(data.materialLibraryIds ?? []);
    const ids = (rows ?? [])
      .filter((r) => targetIds.has(r.id) || (r.name && nk(r.name) === key))
      .map((r) => r.id);

    if (ids.length === 0) {
      return { blocked: false, updated: 0, ids: [], worstPct, overridden: !!data.override };
    }

    const { error: upErr } = await sb
      .from("material_library")
      .update({ preferred_supplier_id: data.newSupplierId })
      .in("id", ids);
    if (upErr) throw upErr;

    await sb.rpc("log_audit", {
      _entity: "material_library",
      _entity_id: ids[0],
      _action: data.override ? "supplier_swap_override" : "supplier_swap",
      _payload: {
        material_key: key,
        new_supplier_id: data.newSupplierId,
        affected_ids: ids,
        worst_pct: worstPct,
        worst_product: worstName,
        override_reason: data.override?.reason ?? null,
        source: "material_sourcing_risk_panel",
      },
    });

    return { blocked: false, updated: ids.length, ids, worstPct, overridden: !!data.override };
  });

export type MaterialSwapSimulation = {
  newSupplierId: string;
  newSupplierName: string | null;
  hasReferenceCost: boolean;
  estimatedUnitCost: number | null;
  affectedSheets: number;
  affectedDrafts: number;
  materialsCostDelta: number; // BRL, may be negative
  materialsCostDeltaPct: number | null; // vs current sheets materials_cost total
  finalCostDelta: number; // considers overhead
  worst: {
    techSheetId: string;
    productName: string | null;
    sku: string | null;
    currentCost: number;
    projectedCost: number;
    deltaPct: number;
  } | null;
  details: Array<{
    techSheetId: string;
    productName: string | null;
    sku: string | null;
    status: string | null;
    currentCost: number;
    projectedCost: number;
    delta: number;
    deltaPct: number;
  }>;
};

export const simulateMaterialSupplierSwap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      materialKey: string;
      candidateSupplierIds: string[];
      materialLibraryIds?: string[];
    }) => data,
  )
  .handler(async ({ data, context }): Promise<MaterialSwapSimulation[]> => {
    const sb = context.supabase;
    const key = data.materialKey.trim().toLowerCase().replace(/\s+/g, " ");
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

    const [{ data: matLib }, { data: suppliers }] = await Promise.all([
      sb
        .from("material_library")
        .select("id, name, preferred_supplier_id, reference_cost, active")
        .eq("active", true),
      sb.from("suppliers").select("id, name").in("id", data.candidateSupplierIds),
    ]);

    const supplierName = new Map(
      ((suppliers ?? []) as { id: string; name: string | null }[]).map((s) => [s.id, s.name]),
    );

    type MatLibRow = {
      id: string;
      name: string | null;
      preferred_supplier_id: string | null;
      reference_cost: number | null;
    };

    const sameName = ((matLib ?? []) as MatLibRow[]).filter((m) => m.name && norm(m.name) === key);

    // Fallback pool: any material_library row from same supplier (avg reference cost)
    const supplierAvgCost = new Map<string, number>();
    for (const sid of data.candidateSupplierIds) {
      const rows = ((matLib ?? []) as MatLibRow[]).filter(
        (m) => m.preferred_supplier_id === sid && m.reference_cost != null && m.reference_cost > 0,
      );
      if (rows.length > 0) {
        supplierAvgCost.set(
          sid,
          rows.reduce((s, r) => s + Number(r.reference_cost ?? 0), 0) / rows.length,
        );
      }
    }

    // Load draft/em_revisao tech sheets consuming this material
    const { data: tsm } = await sb
      .from("tech_sheet_materials")
      .select("id, tech_sheet_id, name, unit_cost, total_cost, consumption, loss_pct");

    type TsmRow = {
      id: string;
      tech_sheet_id: string;
      name: string | null;
      unit_cost: number | null;
      total_cost: number | null;
      consumption: number | null;
      loss_pct: number | null;
    };

    const matching = ((tsm ?? []) as TsmRow[]).filter((m) => m.name && norm(m.name) === key);
    const sheetIds = [...new Set(matching.map((m) => m.tech_sheet_id))];
    if (sheetIds.length === 0) {
      return data.candidateSupplierIds.map((sid) => ({
        newSupplierId: sid,
        newSupplierName: supplierName.get(sid) ?? null,
        hasReferenceCost: false,
        estimatedUnitCost: null,
        affectedSheets: 0,
        affectedDrafts: 0,
        materialsCostDelta: 0,
        materialsCostDeltaPct: null,
        finalCostDelta: 0,
        worst: null,
        details: [],
      }));
    }

    const [{ data: sheets }, { data: products }] = await Promise.all([
      sb
        .from("tech_sheets")
        .select("id, product_id, status, cost_price, materials_cost, overhead_pct")
        .in("id", sheetIds)
        .in("status", ["rascunho", "em_revisao"]),
      sb.from("products").select("id, name, sku"),
    ]);

    type SheetRow = {
      id: string;
      product_id: string | null;
      status: string;
      cost_price: number | null;
      materials_cost: number | null;
      overhead_pct: number | null;
    };
    type ProdRow = { id: string; name: string | null; sku: string | null };

    const sheetRows = (sheets ?? []) as SheetRow[];
    const prodMap = new Map(((products ?? []) as ProdRow[]).map((p) => [p.id, p]));

    // Group matching materials by tech_sheet
    const linesBySheet = new Map<string, TsmRow[]>();
    for (const m of matching) {
      const arr = linesBySheet.get(m.tech_sheet_id) ?? [];
      arr.push(m);
      linesBySheet.set(m.tech_sheet_id, arr);
    }

    const results: MaterialSwapSimulation[] = [];

    for (const sid of data.candidateSupplierIds) {
      // Best available unit cost estimate for this supplier + material
      const specificRow = sameName.find((m) => m.preferred_supplier_id === sid);
      let estimatedUnitCost: number | null = null;
      let hasReferenceCost = false;
      if (specificRow?.reference_cost != null && specificRow.reference_cost > 0) {
        estimatedUnitCost = Number(specificRow.reference_cost);
        hasReferenceCost = true;
      } else if (sameName.length > 0) {
        // avg of same-name reference costs (best proxy for market)
        const withCost = sameName.filter((m) => m.reference_cost != null && m.reference_cost > 0);
        if (withCost.length > 0) {
          estimatedUnitCost =
            withCost.reduce((s, m) => s + Number(m.reference_cost ?? 0), 0) / withCost.length;
        }
      }
      if (estimatedUnitCost == null && supplierAvgCost.has(sid)) {
        estimatedUnitCost = supplierAvgCost.get(sid)!;
      }

      const details: MaterialSwapSimulation["details"] = [];
      let totalDelta = 0;
      let totalFinalDelta = 0;
      let currentMatTotal = 0;

      for (const sheet of sheetRows) {
        const lines = linesBySheet.get(sheet.id) ?? [];
        if (lines.length === 0) continue;

        const currentLineCost = lines.reduce((s, l) => s + Number(l.total_cost ?? 0), 0);

        let projectedLineCost = currentLineCost;
        if (estimatedUnitCost != null) {
          projectedLineCost = lines.reduce((s, l) => {
            const cons = Number(l.consumption ?? 0);
            const loss = Number(l.loss_pct ?? 0);
            return s + estimatedUnitCost! * cons * (1 + loss / 100);
          }, 0);
        }

        const matDelta = projectedLineCost - currentLineCost;
        const overheadMult = 1 + Number(sheet.overhead_pct ?? 0) / 100;
        const finalDelta = matDelta * overheadMult;

        const currentCost = Number(sheet.cost_price ?? 0);
        const projectedCost = currentCost + finalDelta;
        const deltaPct = currentCost > 0 ? (finalDelta / currentCost) * 100 : 0;

        const prod = sheet.product_id ? prodMap.get(sheet.product_id) : null;

        details.push({
          techSheetId: sheet.id,
          productName: prod?.name ?? null,
          sku: prod?.sku ?? null,
          status: sheet.status,
          currentCost,
          projectedCost,
          delta: finalDelta,
          deltaPct,
        });

        totalDelta += matDelta;
        totalFinalDelta += finalDelta;
        currentMatTotal += Number(sheet.materials_cost ?? 0);
      }

      details.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
      const worst =
        details.length > 0
          ? {
              techSheetId: details[0].techSheetId,
              productName: details[0].productName,
              sku: details[0].sku,
              currentCost: details[0].currentCost,
              projectedCost: details[0].projectedCost,
              deltaPct: details[0].deltaPct,
            }
          : null;

      results.push({
        newSupplierId: sid,
        newSupplierName: supplierName.get(sid) ?? null,
        hasReferenceCost,
        estimatedUnitCost,
        affectedSheets: details.length,
        affectedDrafts: details.length,
        materialsCostDelta: totalDelta,
        materialsCostDeltaPct: currentMatTotal > 0 ? (totalDelta / currentMatTotal) * 100 : null,
        finalCostDelta: totalFinalDelta,
        worst,
        details: details.slice(0, 6),
      });
    }

    return results;
  });
