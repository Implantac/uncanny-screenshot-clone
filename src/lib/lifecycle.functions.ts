import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const COLLECTION_STATES = [
  "briefing",
  "design",
  "aprovacao",
  "desenvolvimento",
  "producao",
  "entregue",
  "lancamento",
  "markdown",
  "descontinuada",
] as const;
export type CollectionState = (typeof COLLECTION_STATES)[number];

export const STATE_META: Record<
  CollectionState,
  { label: string; tone: string; next: CollectionState[] }
> = {
  briefing:        { label: "Briefing",        tone: "bg-slate-500/15 text-slate-600",     next: ["design"] },
  design:          { label: "Design",          tone: "bg-violet-500/15 text-violet-600",   next: ["aprovacao", "briefing"] },
  aprovacao:       { label: "Aprovação",       tone: "bg-amber-500/15 text-amber-600",     next: ["desenvolvimento", "design"] },
  desenvolvimento: { label: "Desenvolvimento", tone: "bg-blue-500/15 text-blue-600",       next: ["producao", "aprovacao"] },
  producao:        { label: "Produção",        tone: "bg-indigo-500/15 text-indigo-600",   next: ["entregue"] },
  entregue:        { label: "Entregue",        tone: "bg-teal-500/15 text-teal-600",       next: ["lancamento"] },
  lancamento:      { label: "Lançamento",      tone: "bg-emerald-500/15 text-emerald-600", next: ["markdown", "descontinuada"] },
  markdown:        { label: "Markdown",        tone: "bg-rose-500/15 text-rose-600",       next: ["descontinuada"] },
  descontinuada:   { label: "Descontinuada",   tone: "bg-zinc-500/15 text-zinc-600",       next: [] },
};

const StateEnum = z.enum(COLLECTION_STATES);

export type LifecyclePreflight = {
  ok: boolean;
  warnings: string[];
  effects: string[];
};

export const previewTransition = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { collectionId: string; to: CollectionState }) =>
    z.object({ collectionId: z.string().uuid(), to: StateEnum }).parse(d),
  )
  .handler(async ({ data, context }): Promise<LifecyclePreflight> => {
    const sb = context.supabase;
    const warnings: string[] = [];
    const effects: string[] = [];

    const [{ data: cp }, { data: ts }] = await Promise.all([
      sb
        .from("collection_products")
        .select("product_id, role")
        .eq("collection_id", data.collectionId),
      sb
        .from("tech_sheets")
        .select("id, product_id, status")
        .eq("status", "aprovada"),
    ]);

    type CpRow = { product_id: string; role: string | null };
    type TsRow = { id: string; product_id: string | null; status: string };
    const nonNos = ((cp ?? []) as CpRow[]).filter((c) => c.role !== "nos");
    const approvedIds = new Set(((ts ?? []) as TsRow[]).map((t) => t.product_id));

    if (data.to === "producao") {
      const missing = nonNos.filter((c) => !approvedIds.has(c.product_id)).length;
      if (nonNos.length === 0) warnings.push("Nenhum produto no mix da coleção.");
      if (missing > 0)
        warnings.push(`${missing} produto(s) sem ficha técnica aprovada.`);
      effects.push(`${nonNos.length} ordem(ns) de produção em rascunho serão criadas.`);
    }
    if (data.to === "lancamento" || data.to === "entregue") {
      effects.push("Produtos do mix marcados como ativos no ciclo comercial.");
    }
    if (data.to === "markdown") {
      effects.push(`${nonNos.length} produto(s) entram em markdown (NOS preservados).`);
    }
    if (data.to === "descontinuada") {
      const nos = (cp ?? []).length - nonNos.length;
      effects.push(`${nonNos.length} produto(s) removidos do mix; ${nos} NOS preservado(s).`);
    }

    return { ok: warnings.length === 0, warnings, effects };
  });

export const transitionCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    collectionId: string;
    to: CollectionState;
    reason?: string | null;
  }) =>
    z
      .object({
        collectionId: z.string().uuid(),
        to: StateEnum,
        reason: z.string().max(300).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: cur, error: getErr } = await sb
      .from("collections")
      .select("status")
      .eq("id", data.collectionId)
      .single();
    if (getErr) throw new Error(getErr.message);

    const from = cur.status as CollectionState;
    const allowed = STATE_META[from]?.next ?? [];
    if (!allowed.includes(data.to) && from !== data.to) {
      throw new Error(
        `Transição não permitida: ${STATE_META[from]?.label ?? from} → ${STATE_META[data.to].label}.`,
      );
    }

    const { error } = await sb
      .from("collections")
      .update({
        status: data.to,
        status_changed_by: context.userId,
        status_change_reason: data.reason ?? null,
      })
      .eq("id", data.collectionId);
    if (error) throw new Error(error.message);

    return { ok: true as const, from, to: data.to };
  });
