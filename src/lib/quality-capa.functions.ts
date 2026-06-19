import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

type QualityCapaRow = Database["public"]["Tables"]["quality_capa"]["Row"];
type QualityCapaInsert = Database["public"]["Tables"]["quality_capa"]["Insert"];
type QualityCapaUpdate = Database["public"]["Tables"]["quality_capa"]["Update"];

type CapaJoinedRow = QualityCapaRow & {
  suppliers?: { name: string | null } | null;
  production_orders?: { code: string | null } | null;
};

export type CapaRow = QualityCapaRow & {
  supplier_name?: string | null;
  order_code?: string | null;
};

export const listCapas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        status: z.string().optional(),
        supplierId: z.string().uuid().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("quality_capa")
      .select("*, suppliers(name), production_orders(code)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status) q = q.eq("status", data.status);
    if (data.supplierId) q = q.eq("supplier_id", data.supplierId);
    const { data: rows, error } = await q;
    if (error) throw error;
    return ((rows ?? []) as CapaJoinedRow[]).map((r) => ({
      ...r,
      supplier_name: r.suppliers?.name ?? null,
      order_code: r.production_orders?.code ?? null,
    })) as CapaRow[];
  });

export const upsertCapa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().min(2),
        problem: z.string().min(2),
        root_cause: z.string().optional().nullable(),
        corrective_action: z.string().optional().nullable(),
        preventive_action: z.string().optional().nullable(),
        severity: z.enum(["baixa", "media", "alta", "critica"]).default("media"),
        status: z
          .enum(["aberta", "em_andamento", "concluida", "verificada", "cancelada"])
          .default("aberta"),
        due_date: z.string().optional().nullable(),
        effectiveness_check: z.string().optional().nullable(),
        supplier_id: z.string().uuid().optional().nullable(),
        inspection_id: z.string().uuid().optional().nullable(),
        occurrence_id: z.string().uuid().optional().nullable(),
        order_id: z.string().uuid().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: QualityCapaInsert = { ...data, owner_id: userId };
    if (data.status === "concluida" && !payload.closed_at)
      payload.closed_at = new Date().toISOString();
    if (data.status === "verificada") {
      payload.verified_at = new Date().toISOString();
      payload.verified_by = userId;
      if (!payload.closed_at) payload.closed_at = new Date().toISOString();
    }
    const { data: row, error } = data.id
      ? await supabase
          .from("quality_capa")
          .update(payload as QualityCapaUpdate)
          .eq("id", data.id)
          .select()
          .single()
      : await supabase.from("quality_capa").insert(payload).select().single();
    if (error) throw error;
    return row as QualityCapaRow;
  });

export const deleteCapa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("quality_capa").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ===== Closed-loop reinspeção =====

export type ReinspectionRow = {
  id: string;
  inspected_at: string;
  result: string;
  inspection_type: string;
  critical_defects: number;
  major_defects: number;
  minor_defects: number;
  notes: string | null;
};

export const listReinspectionsForCapa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ capaId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const marker = `[capa:${data.capaId}]`;
    const { data: rows, error } = await context.supabase
      .from("quality_inspections")
      .select(
        "id, inspected_at, result, inspection_type, critical_defects, major_defects, minor_defects, notes",
      )
      .ilike("notes", `%${marker}%`)
      .order("inspected_at", { ascending: false });
    if (error) throw error;
    return (rows ?? []) as ReinspectionRow[];
  });

export const createReinspectionFromCapa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ capaId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: capa, error: capaErr } = await supabase
      .from("quality_capa")
      .select("id, supplier_id, order_id, inspection_id, status")
      .eq("id", data.capaId)
      .single();
    if (capaErr) throw capaErr;

    let origType = "final";
    let aql: string | null = null;
    let lot: number | null = null;
    if (capa.inspection_id) {
      const { data: orig } = await supabase
        .from("quality_inspections")
        .select("inspection_type, aql_level, lot_size")
        .eq("id", capa.inspection_id)
        .maybeSingle();
      if (orig) {
        origType = orig.inspection_type ?? origType;
        aql = orig.aql_level;
        lot = orig.lot_size;
      }
    }

    const marker = `[capa:${capa.id}]${capa.inspection_id ? ` [reinsp-of:${capa.inspection_id}]` : ""}`;
    const { data: insp, error } = await supabase
      .from("quality_inspections")
      .insert({
        owner_id: userId,
        inspection_type: "reinspecao",
        result: "pendente",
        supplier_id: capa.supplier_id,
        production_order_id: capa.order_id,
        aql_level: aql,
        lot_size: lot,
        notes: `Reinspeção pós-CAPA (${origType}). ${marker}`,
      })
      .select("id")
      .single();
    if (error) throw error;

    if (capa.status === "aberta") {
      await supabase
        .from("quality_capa")
        .update({ status: "em_andamento" })
        .eq("id", capa.id);
    }
    return { id: insp.id };
  });

export const verifyCapaFromReinspection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ capaId: z.string().uuid(), reinspectionId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: insp, error: e1 } = await supabase
      .from("quality_inspections")
      .select("result")
      .eq("id", data.reinspectionId)
      .single();
    if (e1) throw e1;
    if (insp.result !== "aprovado") {
      throw new Error("Só é possível verificar a CAPA com uma reinspeção aprovada.");
    }
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("quality_capa")
      .update({
        status: "verificada",
        verified_at: now,
        verified_by: userId,
        closed_at: now,
        effectiveness_check: `Verificada via reinspeção ${data.reinspectionId} em ${now}`,
      })
      .eq("id", data.capaId);
    if (error) throw error;
    return { ok: true };
  });
