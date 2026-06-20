import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============= THEMES =============
export type ThemeRow = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  palette: string[] | null;
  displayOrder: number;
  productCount: number;
};

export const listThemes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { collectionId: string }) =>
    z.object({ collectionId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ThemeRow[]> => {
    const sb = context.supabase;
    const [{ data: themes }, { data: cp }] = await Promise.all([
      sb
        .from("collection_themes")
        .select("id, name, description, color, palette, display_order")
        .eq("collection_id", data.collectionId)
        .order("display_order"),
      sb
        .from("collection_products")
        .select("theme_id")
        .eq("collection_id", data.collectionId),
    ]);
    const counts = new Map<string, number>();
    for (const c of cp ?? []) {
      if (c.theme_id) counts.set(c.theme_id, (counts.get(c.theme_id) ?? 0) + 1);
    }
    type ThemeDbRow = {
      id: string;
      name: string;
      description: string | null;
      color: string | null;
      palette: string[] | null;
      display_order: number;
    };
    return ((themes ?? []) as ThemeDbRow[]).map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      color: t.color,
      palette: t.palette,
      displayOrder: t.display_order,
      productCount: counts.get(t.id) ?? 0,
    }));
  });

export const upsertTheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    collectionId: string;
    name: string;
    description?: string | null;
    color?: string | null;
    palette?: string[] | null;
  }) =>
    z
      .object({
        id: z.string().uuid().optional(),
        collectionId: z.string().uuid(),
        name: z.string().min(1).max(80),
        description: z.string().max(400).nullable().optional(),
        color: z.string().max(20).nullable().optional(),
        palette: z.array(z.string().max(20)).max(12).nullable().optional(),
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
      color: data.color ?? null,
      palette: data.palette ?? null,
    };
    if (data.id) {
      const { error } = await sb.from("collection_themes").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await sb
      .from("collection_themes")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

export const deleteTheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("collection_themes")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ============= LINES =============
export type LineRow = {
  id: string;
  name: string;
  season: string | null;
  year: number | null;
  description: string | null;
  displayOrder: number;
  productCount: number;
};

export const listLines = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LineRow[]> => {
    const sb = context.supabase;
    const [{ data: lines }, { data: products }] = await Promise.all([
      sb
        .from("product_lines")
        .select("id, name, season, year, description, display_order")
        .order("display_order"),
      sb.from("products").select("line_id"),
    ]);
    const counts = new Map<string, number>();
    for (const p of products ?? []) {
      if (p.line_id) counts.set(p.line_id, (counts.get(p.line_id) ?? 0) + 1);
    }
    type LineDbRow = {
      id: string;
      name: string;
      season: string | null;
      year: number | null;
      description: string | null;
      display_order: number;
    };
    return ((lines ?? []) as LineDbRow[]).map((l) => ({
      id: l.id,
      name: l.name,
      season: l.season,
      year: l.year,
      description: l.description,
      displayOrder: l.display_order,
      productCount: counts.get(l.id) ?? 0,
    }));
  });

export const upsertLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    name: string;
    season?: string | null;
    year?: number | null;
    description?: string | null;
  }) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(80),
        season: z.string().max(40).nullable().optional(),
        year: z.number().int().min(2000).max(2100).nullable().optional(),
        description: z.string().max(400).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const payload = {
      owner_id: context.userId,
      name: data.name,
      season: data.season ?? null,
      year: data.year ?? null,
      description: data.description ?? null,
    };
    if (data.id) {
      const { error } = await sb.from("product_lines").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await sb
      .from("product_lines")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

export const deleteLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("product_lines")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ============= CHANNEL MIX (drag-drop) =============
export const CHANNELS_LIST = [
  "ecommerce",
  "varejo_proprio",
  "multimarcas",
  "franquia",
  "outlet",
] as const;
export type ChannelKey = (typeof CHANNELS_LIST)[number];

export type ChannelMixProduct = {
  productId: string;
  sku: string;
  name: string;
  imageUrl: string | null;
  channels: ChannelKey[];
  role: string;
};

export const getChannelMix = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { collectionId: string }) =>
    z.object({ collectionId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ChannelMixProduct[]> => {
    const sb = context.supabase;
    const [{ data: cp }, { data: products }] = await Promise.all([
      sb
        .from("collection_products")
        .select("product_id, role, channel_exclusive")
        .eq("collection_id", data.collectionId),
      sb.from("products").select("id, sku, name, image_url"),
    ]);
    type ProdRow = { id: string; sku: string | null; name: string | null; image_url: string | null };
    type CpRow = {
      product_id: string;
      role: string;
      channel_exclusive: string[] | null;
    };
    const pmap = new Map(((products ?? []) as ProdRow[]).map((p) => [p.id, p]));
    return ((cp ?? []) as CpRow[]).map((c) => {
      const p = pmap.get(c.product_id);
      return {
        productId: c.product_id,
        sku: p?.sku ?? "—",
        name: p?.name ?? "—",
        imageUrl: p?.image_url ?? null,
        channels:
          c.channel_exclusive && c.channel_exclusive.length > 0
            ? (c.channel_exclusive as ChannelKey[])
            : ([...CHANNELS_LIST] as ChannelKey[]),
        role: c.role,
      };
    });
  });

export const setProductChannels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    productId: string;
    collectionId: string;
    channels: ChannelKey[];
  }) =>
    z
      .object({
        productId: z.string().uuid(),
        collectionId: z.string().uuid(),
        channels: z.array(z.enum(CHANNELS_LIST)),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // empty array means "all channels" — store NULL for clarity
    const value = data.channels.length === CHANNELS_LIST.length ? null : data.channels;
    const { error } = await context.supabase
      .from("collection_products")
      .update({ channel_exclusive: value })
      .eq("collection_id", data.collectionId)
      .eq("product_id", data.productId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
