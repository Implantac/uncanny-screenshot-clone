import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type CapaRow = {
  id: string;
  title: string;
  problem: string;
  root_cause: string | null;
  corrective_action: string | null;
  preventive_action: string | null;
  severity: string;
  status: string;
  due_date: string | null;
  closed_at: string | null;
  verified_at: string | null;
  effectiveness_check: string | null;
  supplier_id: string | null;
  supplier_name?: string | null;
  inspection_id: string | null;
  occurrence_id: string | null;
  order_id: string | null;
  order_code?: string | null;
  created_at: string;
  updated_at: string;
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
    return (rows ?? []).map((r: any) => ({
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
    const payload: any = { ...data, owner_id: userId };
    if (data.status === "concluida" && !payload.closed_at)
      payload.closed_at = new Date().toISOString();
    if (data.status === "verificada") {
      payload.verified_at = new Date().toISOString();
      payload.verified_by = userId;
      if (!payload.closed_at) payload.closed_at = new Date().toISOString();
    }
    const { data: row, error } = data.id
      ? await supabase.from("quality_capa").update(payload).eq("id", data.id).select().single()
      : await supabase.from("quality_capa").insert(payload).select().single();
    if (error) throw error;
    return row as any;
  });

export const deleteCapa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("quality_capa").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
