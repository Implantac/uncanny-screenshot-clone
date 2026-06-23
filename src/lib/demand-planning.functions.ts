import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { REORDER_DEFAULTS, REORDER_LIMITS, resolveReorderParams } from "./inventory-smart.functions";

export const ABC_Z_FACTORS: Record<"A" | "B" | "C", number> = {
  A: 1.65, // 95%
  B: 1.41, // 92%
  C: 1.28, // 90%
};

export const ABC_SERVICE_LEVEL: Record<"A" | "B" | "C", string> = {
  A: "95%",
  B: "92%",
  C: "90%",
};

type ScopeRow = {
  scope: "category" | "product_group" | "product";
  scope_value: string;
  product_id: string | null;
  distribution?: Record<string, number>;
  multipliers?: Record<string, number>;
};

function pickByScope<T extends ScopeRow>(
  rows: T[],
  product: { id: string; category: string | null; product_group: string | null },
): T | null {
  // resolução em cascata: product > product_group > category
  const byProduct = rows.find((r) => r.scope === "product" && r.product_id === product.id);
  if (byProduct) return byProduct;
  if (product.product_group) {
    const byGroup = rows.find(
      (r) => r.scope === "product_group" && r.scope_value === product.product_group,
    );
    if (byGroup) return byGroup;
  }
  if (product.category) {
    const byCat = rows.find((r) => r.scope === "category" && r.scope_value === product.category);
    if (byCat) return byCat;
  }
  return null;
}

export const recomputeAbcClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("recompute_abc_class", {
      _owner: context.userId,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return {
      a: Number(row?.a_count ?? 0),
      b: Number(row?.b_count ?? 0),
      c: Number(row?.c_count ?? 0),
      total: Number(row?.total ?? 0),
    };
  });

type DemandRow = {
  productId: string;
  productName: string;
  productSku: string;
  category: string | null;
  abcClass: "A" | "B" | "C" | null;
  supplierId: string | null;
  supplierName: string | null;
  supplierMinOrderValue: number | null;
  supplierMinOrderQty: number | null;
  costPrice: number;
  annualDemand: number;
  monthFactor: number;
  Z: number;
  dailyAvg: number;
  variants: Array<{
    variantId: string;
    sku: string;
    colorId: string | null;
    colorName: string | null;
    colorHex: string | null;
    sizeId: string | null;
    sizeLabel: string | null;
    sizePct: number;
    skuDailyAvg: number;
    skuAnnualDemand: number;
    leadTimeDays: number;
    safetyStock: number;
    rop: number;
    eoq: number;
    balance: number;
    needsOrder: boolean;
  }>;
  warnings: string[];
};

export const getDemandPlanning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i?: { productId?: string }) =>
    z.object({ productId: z.string().uuid().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date();
    const currentMonth = String(now.getUTCMonth() + 1);

    // 1) Produtos
    let q = supabase
      .from("products")
      .select(
        "id, sku, name, category, product_group, abc_class, abc_updated_at, cost_price, status",
      )
      .eq("owner_id", userId)
      .neq("status", "descontinuado");
    if (data.productId) q = q.eq("id", data.productId);
    const { data: products, error: pErr } = await q;
    if (pErr) throw new Error(pErr.message);
    const list = products ?? [];
    if (list.length === 0) return { items: [] as DemandRow[], month: currentMonth };

    const productIds = list.map((p) => p.id);

    // 2) Variants + sizes + colors
    const { data: variants, error: vErr } = await supabase
      .from("product_variants")
      .select(
        "id, product_id, sku, color_id, size_id, active, product_color_options:color_id(name,hex), product_size_options:size_id(label)",
      )
      .eq("owner_id", userId)
      .in("product_id", productIds)
      .eq("active", true);
    if (vErr) throw new Error(vErr.message);

    // 3) Grades e sazonalidade do owner
    const [{ data: grids }, { data: seasons }] = await Promise.all([
      supabase.from("size_grids").select("*").eq("owner_id", userId),
      supabase.from("seasonality_curves").select("*").eq("owner_id", userId),
    ]);

    // 4) Sales (últimos 365d) p/ dailyAvg por produto
    const since = new Date(Date.now() - 365 * 86400_000).toISOString();
    const { data: sales } = await supabase
      .from("sales")
      .select("product_id, quantity, sold_at")
      .eq("user_id", userId)
      .in("product_id", productIds)
      .gte("sold_at", since);
    const salesByProd = new Map<string, number>();
    for (const s of sales ?? []) {
      if (!s.product_id) continue;
      salesByProd.set(s.product_id, (salesByProd.get(s.product_id) ?? 0) + Number(s.quantity ?? 0));
    }

    // 5) Inventory items vinculados ao produto (saldo + supplier + overrides)
    const { data: items } = await supabase
      .from("inventory_items")
      .select(
        "id, product_id, balance, mrp_overrides, preferred_supplier_id, suppliers:preferred_supplier_id(name, lead_time_days, min_order_value, min_order_qty)",
      )
      .eq("owner_id", userId)
      .in("product_id", productIds);
    const itemByProduct = new Map<string, any>();
    for (const it of items ?? []) {
      if (!it.product_id) continue;
      if (!itemByProduct.has(it.product_id)) itemByProduct.set(it.product_id, it);
    }

    // 6) Saldo por variante (production_order_grid recebido — soma de quantity)
    const variantIds = (variants ?? []).map((v) => v.id);
    const variantBalance = new Map<string, number>();
    if (variantIds.length > 0) {
      const { data: grid } = await supabase
        .from("production_order_grid")
        .select("variant_id, quantity")
        .in("variant_id", variantIds);
      for (const g of grid ?? []) {
        if (!g.variant_id) continue;
        variantBalance.set(
          g.variant_id,
          (variantBalance.get(g.variant_id) ?? 0) + Number(g.quantity ?? 0),
        );
      }
    }

    const out: DemandRow[] = list.map((p: any) => {
      const productVariants = (variants ?? []).filter((v) => v.product_id === p.id);
      const item = itemByProduct.get(p.id);
      const supplier = item?.suppliers ?? null;
      const supplierId = item?.preferred_supplier_id ?? null;

      // ABC -> Z dinâmico (default 1.65 quando sem classe)
      const klass = (p.abc_class as "A" | "B" | "C" | null) ?? null;
      const overrideZ = resolveReorderParams(item?.mrp_overrides).Z;
      const Z =
        item?.mrp_overrides && typeof item.mrp_overrides === "object" &&
        (item.mrp_overrides as any).service_factor_z != null
          ? overrideZ
          : klass
            ? ABC_Z_FACTORS[klass]
            : REORDER_DEFAULTS.service_factor_z;

      // Demanda anual + diária do PAI
      const annualUnits = salesByProd.get(p.id) ?? 0;
      const dailyAvg = annualUnits / 365;

      // Sazonalidade -> multiplicador do mês corrente
      const seasonRow = pickByScope(
        (seasons ?? []) as ScopeRow[],
        { id: p.id, category: p.category, product_group: p.product_group },
      );
      const monthFactor = Number(
        seasonRow?.multipliers?.[currentMonth] ?? 1,
      );

      // Grade padrão
      const gridRow = pickByScope(
        (grids ?? []) as ScopeRow[],
        { id: p.id, category: p.category, product_group: p.product_group },
      );
      const distribution = gridRow?.distribution ?? null;

      const warnings: string[] = [];
      const leadTimeRaw = Number(supplier?.lead_time_days);
      const leadTimeValid =
        Number.isFinite(leadTimeRaw) &&
        leadTimeRaw >= REORDER_LIMITS.lead_time_days.min &&
        leadTimeRaw <= REORDER_LIMITS.lead_time_days.max;
      const leadTime = leadTimeValid ? leadTimeRaw : 14;
      if (supplier && Number.isFinite(leadTimeRaw) && !leadTimeValid) {
        warnings.push(`Lead time fornecedor (${leadTimeRaw}d) fora da faixa; usando 14d.`);
      }
      if (!klass) warnings.push("Classe ABC não calculada — recalcule para Z dinâmico.");
      if (!distribution) warnings.push("Sem grade padrão definida — distribuindo uniformemente.");

      const { S, H } = resolveReorderParams(item?.mrp_overrides);
      const costPrice = Number(p.cost_price ?? 0);

      const variantsOut = productVariants.map((v: any) => {
        const sizeLabel = v.product_size_options?.label ?? null;
        const colorName = v.product_color_options?.name ?? null;
        const colorHex = v.product_color_options?.hex ?? null;
        // grade padrão por size
        let sizePct: number;
        if (distribution && sizeLabel && distribution[sizeLabel] != null) {
          sizePct = Number(distribution[sizeLabel]);
        } else if (productVariants.length > 0) {
          sizePct = 1 / productVariants.length;
        } else {
          sizePct = 0;
        }

        const skuAnnual = annualUnits * sizePct;
        const skuDaily = dailyAvg * sizePct * monthFactor;

        // SS = Z * σ * √LT — σ estimada como sqrt(dailyAvg) (Poisson) por falta de série SKU
        const sigma = Math.sqrt(Math.max(0, skuDaily));
        const safetyStock = Math.ceil(Z * sigma * Math.sqrt(leadTime));
        const rop = Math.ceil(skuDaily * leadTime + safetyStock);
        const eoq =
          S > 0 && H > 0 && skuAnnual > 0
            ? Math.ceil(Math.sqrt((2 * skuAnnual * S) / H))
            : Math.max(0, Math.ceil(skuAnnual / 12));

        const balance = variantBalance.get(v.id) ?? 0;
        const needsOrder = balance <= rop && skuDaily > 0;

        return {
          variantId: v.id,
          sku: v.sku,
          colorId: v.color_id,
          colorName,
          colorHex,
          sizeId: v.size_id,
          sizeLabel,
          sizePct,
          skuDailyAvg: Number(skuDaily.toFixed(3)),
          skuAnnualDemand: Math.round(skuAnnual),
          leadTimeDays: leadTime,
          safetyStock,
          rop,
          eoq,
          balance,
          needsOrder,
        };
      });

      return {
        productId: p.id,
        productName: p.name,
        productSku: p.sku,
        category: p.category,
        abcClass: klass,
        supplierId,
        supplierName: supplier?.name ?? null,
        supplierMinOrderValue:
          supplier?.min_order_value != null ? Number(supplier.min_order_value) : null,
        supplierMinOrderQty:
          supplier?.min_order_qty != null ? Number(supplier.min_order_qty) : null,
        costPrice,
        annualDemand: Math.round(annualUnits),
        monthFactor,
        Z,
        dailyAvg: Number(dailyAvg.toFixed(3)),
        variants: variantsOut,
        warnings,
      };
    });

    return { items: out, month: currentMonth };
  });

export const getPurchaseSuggestionsBySupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const dp = await getDemandPlanning({ data: {} });
    const items = dp.items;

    type SupplierGroup = {
      supplierId: string | null;
      supplierName: string;
      products: Array<{
        productId: string;
        productName: string;
        productSku: string;
        abcClass: "A" | "B" | "C" | null;
        cols: { id: string; label: string }[];
        rows: { id: string; name: string; hex: string | null }[];
        matrix: Record<string, Record<string, number>>; // colorId -> sizeId -> eoq
        totalQty: number;
        totalCost: number;
        monthFactor: number;
        Z: number;
        reason: string;
      }>;
      totalQty: number;
      totalCost: number;
    };

    const groups = new Map<string, SupplierGroup>();
    for (const p of items) {
      const toOrder = p.variants.filter((v) => v.needsOrder && v.eoq > 0);
      if (toOrder.length === 0) continue;

      const key = p.supplierId ?? "_no_supplier";
      let g = groups.get(key);
      if (!g) {
        g = {
          supplierId: p.supplierId,
          supplierName: p.supplierName ?? "Sem fornecedor definido",
          products: [],
          totalQty: 0,
          totalCost: 0,
        };
        groups.set(key, g);
      }

      // Build matrix
      const colsMap = new Map<string, string>();
      const rowsMap = new Map<string, { name: string; hex: string | null }>();
      const matrix: Record<string, Record<string, number>> = {};
      let prodQty = 0;
      for (const v of toOrder) {
        if (!v.sizeId || !v.colorId) continue;
        colsMap.set(v.sizeId, v.sizeLabel ?? "?");
        rowsMap.set(v.colorId, { name: v.colorName ?? "?", hex: v.colorHex });
        if (!matrix[v.colorId]) matrix[v.colorId] = {};
        matrix[v.colorId][v.sizeId] = v.eoq;
        prodQty += v.eoq;
      }
      if (prodQty === 0) continue;

      const prodCost = prodQty * (p.costPrice ?? 0);
      g.products.push({
        productId: p.productId,
        productName: p.productName,
        productSku: p.productSku,
        abcClass: p.abcClass,
        cols: Array.from(colsMap, ([id, label]) => ({ id, label })),
        rows: Array.from(rowsMap, ([id, v]) => ({ id, name: v.name, hex: v.hex })),
        matrix,
        totalQty: prodQty,
        totalCost: prodCost,
        monthFactor: p.monthFactor,
        Z: p.Z,
        reason: `Classe ${p.abcClass ?? "—"} · Z ${p.Z.toFixed(2)} · sazonalidade mês ${p.monthFactor.toFixed(2)}× · LEC otimizado por SKU`,
      });
      g.totalQty += prodQty;
      g.totalCost += prodCost;
    }

    return {
      groups: Array.from(groups.values()).sort((a, b) => b.totalQty - a.totalQty),
    };
  });

export const generatePurchaseOrderFromSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      supplierId: string | null;
      items: Array<{ description: string; quantity: number; unitPrice: number }>;
    }) =>
      z
        .object({
          supplierId: z.string().uuid().nullable(),
          items: z
            .array(
              z.object({
                description: z.string().min(1).max(300),
                quantity: z.number().positive(),
                unitPrice: z.number().min(0),
              }),
            )
            .min(1),
        })
        .parse(i),
  )
  .handler(async ({ data, context }) => {
    const code = `OC-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const total = data.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
    const { data: po, error } = await context.supabase
      .from("purchase_orders")
      .insert({
        owner_id: context.userId,
        supplier_id: data.supplierId,
        code,
        status: "rascunho",
        total_value: total,
        notes: "Gerado automaticamente pelo Demand Planning",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: iErr } = await context.supabase.from("purchase_order_items").insert(
      data.items.map((it) => ({
        owner_id: context.userId,
        purchase_order_id: po!.id,
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unitPrice,
      })),
    );
    if (iErr) throw new Error(iErr.message);
    return { id: po!.id, code };
  });
