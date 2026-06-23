import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const STAGE_DEFAULTS: Array<{
  stage:
    | "briefing"
    | "moodboard"
    | "tech_pack"
    | "piloto"
    | "aprovacao"
    | "producao"
    | "lancamento";
  sla: number;
}> = [
  { stage: "briefing", sla: 5 },
  { stage: "moodboard", sla: 7 },
  { stage: "tech_pack", sla: 14 },
  { stage: "piloto", sla: 10 },
  { stage: "aprovacao", sla: 5 },
  { stage: "producao", sla: 45 },
  { stage: "lancamento", sla: 7 },
];

export const STAGE_LABELS: Record<string, string> = {
  briefing: "Briefing",
  moodboard: "Moodboard",
  tech_pack: "Ficha Técnica",
  piloto: "Peça-Piloto",
  aprovacao: "Aprovação",
  producao: "Produção",
  lancamento: "Lançamento",
};

export const listCollectionMilestones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ collectionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("collection_milestones")
      .select("*")
      .eq("owner_id", context.userId)
      .eq("collection_id", data.collectionId)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const initCollectionTimeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ collectionId: z.string().uuid(), baseDate: z.string().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    // Confirma que a coleção é do usuário
    const { data: col } = await context.supabase
      .from("collections")
      .select("id, owner_id, launch_date, season, year")
      .eq("id", data.collectionId)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!col) throw new Error("Coleção não encontrada");

    const start = data.baseDate ? new Date(data.baseDate) : new Date();
    let cursor = new Date(start);
    const rows = STAGE_DEFAULTS.map((s, idx) => {
      const planned = new Date(cursor);
      cursor = new Date(cursor.getTime() + s.sla * 86400000);
      return {
        owner_id: context.userId,
        collection_id: data.collectionId,
        stage: s.stage,
        sla_days: s.sla,
        planned_date: planned.toISOString().slice(0, 10),
        position: idx,
        status: "pendente" as const,
      };
    });

    const { error } = await context.supabase
      .from("collection_milestones")
      .upsert(rows, { onConflict: "collection_id,stage" });
    if (error) throw new Error(error.message);
    return { ok: true, count: rows.length };
  });

export const upsertMilestone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid().optional(),
        collectionId: z.string().uuid(),
        stage: z.enum([
          "briefing",
          "moodboard",
          "tech_pack",
          "piloto",
          "aprovacao",
          "producao",
          "lancamento",
        ]),
        plannedDate: z.string().nullable().optional(),
        actualDate: z.string().nullable().optional(),
        slaDays: z.number().int().nullable().optional(),
        responsibleUserId: z.string().uuid().nullable().optional(),
        status: z.enum(["pendente", "em_andamento", "concluido", "atrasado"]).optional(),
        notes: z.string().max(500).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      owner_id: context.userId,
      collection_id: data.collectionId,
      stage: data.stage,
      planned_date: data.plannedDate ?? null,
      actual_date: data.actualDate ?? null,
      sla_days: data.slaDays ?? null,
      responsible_user_id: data.responsibleUserId ?? null,
      status: data.status ?? "pendente",
      notes: data.notes ?? null,
    };
    const { error } = await context.supabase
      .from("collection_milestones")
      .upsert(payload, { onConflict: "collection_id,stage" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markMilestoneDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("collection_milestones")
      .update({
        actual_date: new Date().toISOString().slice(0, 10),
        status: "concluido",
      })
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
