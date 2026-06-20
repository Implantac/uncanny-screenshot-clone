import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const CHANNELS = [
  "ecommerce",
  "varejo_proprio",
  "multimarcas",
  "franquia",
  "outlet",
] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABEL: Record<Channel, string> = {
  ecommerce: "E-commerce",
  varejo_proprio: "Varejo Próprio",
  multimarcas: "Multimarcas",
  franquia: "Franquia",
  outlet: "Outlet",
};

export type FamilyRow = {
  id: string;
  name: string;
  description: string | null;
  targetMarginPct: number | null;
  priceTier: "entrada" | "medio" | "premium" | null;
  displayOrder: number;
};

export type AssortmentCell = {
  id: string | null;
  collectionId: string;
  channel: Channel;
  familyId: string | null;
  targetSkus: number;
  targetUnits: number;
  targetRevenue: number;
  targetMarginPct: number | null;
  actualSkus: number;
  actualUnits: number;
  actualRevenue: number;
};

export type AssortmentInsight = {
  severity: "info" | "warn" | "critical";
  message: string;
};

export type OtbRow = {
  familyId: string | null;
  familyName: string;
  targetUnits: number;
  committedUnits: number;
  openToBuy: number;
};

export type AssortmentContext = {
  families: FamilyRow[];
  channels: Channel[];
  cells: AssortmentCell[];
  insights: AssortmentInsight[];
  otb: OtbRow[];
};

const ChannelEnum = z.enum(CHANNELS);
const TierEnum = z.enum(["entrada", "medio", "premium"]);

export const getAssortmentContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { collectionId: string }) =>
    z.object({ collectionId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<AssortmentContext> => {
    const sb = context.supabase;

    const [
      { data: famRows },
      { data: planRows },
      { data: cpRows },
      { data: products },
      { data: poRows },
    ] = await Promise.all([
      sb
        .from("product_families")
        .select("id, name, description, target_margin_pct, price_tier, display_order")
        .eq("collection_id", data.collectionId)
        .order("display_order"),
      sb
        .from("assortment_plan")
        .select(
          "id, channel, family_id, target_skus, target_units, target_revenue, target_margin_pct",
        )
        .eq("collection_id", data.collectionId),
      sb
        .from("collection_products")
        .select("product_id, family_id, channel_exclusive")
        .eq("collection_id", data.collectionId),
      sb.from("products").select("id, sku"),
      sb.from("production_orders").select("product_id, quantity").not("product_id", "is", null),
    ]);

    type FamRowDB = { id: string; name: string; description: string | null; target_margin_pct: number | null; price_tier: FamilyRow["priceTier"]; display_order: number };
    type PlanRow = { id: string; channel: Channel; family_id: string | null; target_skus: number | null; target_units: number | null; target_revenue: number | null; target_margin_pct: number | null };
    type CpRow = { product_id: string; family_id: string | null; channel_exclusive: string[] | null };
    type ProductRow = { id: string; sku: string };
    type PoRow = { product_id: string | null; quantity: number | null };

    const families: FamilyRow[] = ((famRows ?? []) as FamRowDB[]).map((f) => ({
      id: f.id,
      name: f.name,
      description: f.description,
      targetMarginPct: f.target_margin_pct,
      priceTier: f.price_tier,
      displayOrder: f.display_order,
    }));

    const skuByProduct = new Map(
      ((products ?? []) as ProductRow[]).map((p) => [p.id, p.sku]),
    );

    // Actuals: count distinct SKUs assigned per channel × family.
    // A product without channel_exclusive contributes to ALL channels.
    const actuals = new Map<
      string,
      { skus: Set<string>; units: number; revenue: number }
    >();
    const key = (channel: Channel, familyId: string | null) =>
      `${channel}::${familyId ?? "_"}`;

    for (const cp of ((cpRows ?? []) as CpRow[])) {
      const sku = skuByProduct.get(cp.product_id);
      if (!sku) continue;
      const channels: Channel[] =
        cp.channel_exclusive && cp.channel_exclusive.length > 0
          ? (cp.channel_exclusive as Channel[])
          : ([...CHANNELS] as Channel[]);
      for (const ch of channels) {
        const k = key(ch, cp.family_id);
        const cur = actuals.get(k) ?? { skus: new Set<string>(), units: 0, revenue: 0 };
        cur.skus.add(sku);
        actuals.set(k, cur);
      }
    }

    const planByKey = new Map(
      ((planRows ?? []) as PlanRow[]).map((p) => [key(p.channel, p.family_id), p]),
    );


    const cells: AssortmentCell[] = [];
    const familyIds: (string | null)[] = [...families.map((f) => f.id), null];
    for (const ch of CHANNELS) {
      for (const fid of familyIds) {
        const plan = planByKey.get(key(ch, fid));
        const act = actuals.get(key(ch, fid));
        cells.push({
          id: plan?.id ?? null,
          collectionId: data.collectionId,
          channel: ch,
          familyId: fid,
          targetSkus: plan?.target_skus ?? 0,
          targetUnits: plan?.target_units ?? 0,
          targetRevenue: Number(plan?.target_revenue ?? 0),
          targetMarginPct: plan?.target_margin_pct ?? null,
          actualSkus: act?.skus.size ?? 0,
          actualUnits: act?.units ?? 0,
          actualRevenue: act?.revenue ?? 0,
        });
      }
    }

    // IA-PCP insights
    const insights: AssortmentInsight[] = [];
    for (const c of cells) {
      if (c.targetSkus > 0) {
        const gap = c.targetSkus - c.actualSkus;
        if (gap > 0) {
          insights.push({
            severity: gap >= c.targetSkus * 0.5 ? "critical" : "warn",
            message: `${CHANNEL_LABEL[c.channel]}${
              c.familyId
                ? " · " + (families.find((f) => f.id === c.familyId)?.name ?? "—")
                : ""
            }: faltam ${gap} SKUs para atingir a meta de ${c.targetSkus}.`,
          });
        } else if (c.actualSkus > c.targetSkus * 1.3) {
          insights.push({
            severity: "warn",
            message: `${CHANNEL_LABEL[c.channel]}: ${c.actualSkus} SKUs vs. meta ${c.targetSkus} — considere cortar excedente.`,
          });
        }
      }
    }
    if (families.length === 0) {
      insights.push({
        severity: "info",
        message:
          "Crie famílias (ex: Camisetas Básicas, Vestidos Festa) para distribuir a meta por canal de forma cirúrgica.",
      });
    }

    // OTB (Open-To-Buy) per family: target units (across all channels) − committed via production_orders
    const familyByProduct = new Map<string, string | null>(
      ((cpRows ?? []) as CpRow[]).map((cp) => [cp.product_id, cp.family_id]),
    );
    const committedByFamily = new Map<string | null, number>();
    for (const po of ((poRows ?? []) as PoRow[])) {
      const pid = po.product_id;
      if (!pid || !familyByProduct.has(pid)) continue; // outside this collection
      const fid = familyByProduct.get(pid) ?? null;
      committedByFamily.set(fid, (committedByFamily.get(fid) ?? 0) + Number(po.quantity ?? 0));
    }
    const targetByFamily = new Map<string | null, number>();
    for (const c of cells) {
      targetByFamily.set(c.familyId, (targetByFamily.get(c.familyId) ?? 0) + c.targetUnits);
    }
    const otb: OtbRow[] = [...families.map((f) => f.id), null].map((fid) => {
      const t = targetByFamily.get(fid) ?? 0;
      const c = committedByFamily.get(fid) ?? 0;
      return {
        familyId: fid,
        familyName: fid ? families.find((f) => f.id === fid)?.name ?? "—" : "Sem família",
        targetUnits: t,
        committedUnits: c,
        openToBuy: t - c,
      };
    });

    for (const o of otb) {
      if (o.targetUnits > 0 && o.openToBuy < 0) {
        insights.push({
          severity: "warn",
          message: `${o.familyName}: produção comprometida (${o.committedUnits}) excede meta (${o.targetUnits}) em ${Math.abs(o.openToBuy)} un — risco de over-buy.`,
        });
      }
    }

    return { families, channels: [...CHANNELS], cells, insights, otb };
  });

export const upsertFamily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    collectionId: string;
    name: string;
    description?: string | null;
    targetMarginPct?: number | null;
    priceTier?: "entrada" | "medio" | "premium" | null;
    displayOrder?: number;
  }) =>
    z
      .object({
        id: z.string().uuid().optional(),
        collectionId: z.string().uuid(),
        name: z.string().min(1).max(80),
        description: z.string().max(400).nullable().optional(),
        targetMarginPct: z.number().min(0).max(100).nullable().optional(),
        priceTier: TierEnum.nullable().optional(),
        displayOrder: z.number().int().min(0).max(999).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const payload = {
      owner_id: context.userId,
      collection_id: data.collectionId,
      name: data.name,
      description: data.description ?? null,
      target_margin_pct: data.targetMarginPct ?? null,
      price_tier: data.priceTier ?? null,
      display_order: data.displayOrder ?? 0,
    };
    if (data.id) {
      const { error } = await sb
        .from("product_families")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await sb
      .from("product_families")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

export const deleteFamily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("product_families")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const upsertAssortmentCell = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    collectionId: string;
    channel: Channel;
    familyId: string | null;
    targetSkus: number;
    targetUnits: number;
    targetRevenue: number;
    targetMarginPct?: number | null;
  }) =>
    z
      .object({
        collectionId: z.string().uuid(),
        channel: ChannelEnum,
        familyId: z.string().uuid().nullable(),
        targetSkus: z.number().int().min(0).max(99999),
        targetUnits: z.number().int().min(0).max(9999999),
        targetRevenue: z.number().min(0).max(999999999),
        targetMarginPct: z.number().min(0).max(100).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    // Manual upsert because UNIQUE includes nullable family_id (Postgres treats NULL ≠ NULL).
    const q = sb
      .from("assortment_plan")
      .select("id")
      .eq("collection_id", data.collectionId)
      .eq("channel", data.channel);
    const { data: existing } = data.familyId
      ? await q.eq("family_id", data.familyId).maybeSingle()
      : await q.is("family_id", null).maybeSingle();

    const payload = {
      owner_id: context.userId,
      collection_id: data.collectionId,
      channel: data.channel,
      family_id: data.familyId,
      target_skus: data.targetSkus,
      target_units: data.targetUnits,
      target_revenue: data.targetRevenue,
      target_margin_pct: data.targetMarginPct ?? null,
    };

    if (existing) {
      const { error } = await sb
        .from("assortment_plan")
        .update(payload)
        .eq("id", (existing as any).id);
      if (error) throw new Error(error.message);
      return { id: (existing as any).id as string };
    }
    const { data: ins, error } = await sb
      .from("assortment_plan")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

export const assignProductFamily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    productId: string;
    collectionId: string;
    familyId: string | null;
    channels?: Channel[] | null;
  }) =>
    z
      .object({
        productId: z.string().uuid(),
        collectionId: z.string().uuid(),
        familyId: z.string().uuid().nullable(),
        channels: z.array(ChannelEnum).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const update: { family_id: string | null; channel_exclusive?: Channel[] | null } = {
      family_id: data.familyId,
    };
    if (data.channels !== undefined) update.channel_exclusive = data.channels;
    const { error } = await context.supabase
      .from("collection_products")
      .update(update)
      .eq("collection_id", data.collectionId)
      .eq("product_id", data.productId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
