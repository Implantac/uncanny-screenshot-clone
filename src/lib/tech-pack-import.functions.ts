import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Importador de Tech Pack (CLO 3D / Adobe Illustrator / Browzwear / manual).
 *
 * Aceita um JSON normalizado (payload abaixo) e cria/atualiza a ficha técnica,
 * substituindo materiais, medidas e operações. Fichas já `aprovada` viram uma
 * nova versão `rascunho` para não sobrescrever a produção.
 */

const MaterialSchema = z.object({
  name: z.string().min(1),
  unit: z.string().default("un"),
  consumption: z.coerce.number().nonnegative().default(0),
  loss_pct: z.coerce.number().min(0).max(100).default(0),
  unit_cost: z.coerce.number().nonnegative().default(0),
  notes: z.string().optional().nullable(),
});

const MeasurementSchema = z.object({
  point: z.string().min(1),
  sizes: z.record(z.string(), z.coerce.number()).default({}),
  tolerance_plus: z.coerce.number().nonnegative().default(0),
  tolerance_minus: z.coerce.number().nonnegative().default(0),
  notes: z.string().optional().nullable(),
});

const OperationSchema = z.object({
  name: z.string().min(1),
  machine: z.string().optional().nullable(),
  sam: z.coerce.number().nonnegative().default(0),
  rate_per_min: z.coerce.number().nonnegative().default(0),
  notes: z.string().optional().nullable(),
});

const TechPackSchema = z.object({
  source: z
    .enum(["clo3d", "illustrator", "browzwear", "manual", "other"])
    .default("other"),
  code: z.string().min(1),
  product_sku: z.string().optional().nullable(),
  product_id: z.string().uuid().optional().nullable(),
  version_label: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  overhead_pct: z.coerce.number().min(0).max(100).optional(),
  materials: z.array(MaterialSchema).default([]),
  measurements: z.array(MeasurementSchema).default([]),
  operations: z.array(OperationSchema).default([]),
});

export type TechPackPayload = z.infer<typeof TechPackSchema>;

export const importTechPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ payload: TechPackSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const p = data.payload;

    // 1. Resolver produto (por id ou por SKU)
    let productId: string | null = p.product_id ?? null;
    if (!productId && p.product_sku) {
      const { data: prod } = await supabase
        .from("products")
        .select("id")
        .eq("sku", p.product_sku)
        .maybeSingle();
      productId = prod?.id ?? null;
    }

    // 2. Encontrar ficha existente pelo code no owner atual
    const { data: existing } = await supabase
      .from("tech_sheets")
      .select("id, status, version")
      .eq("code", p.code)
      .eq("owner_id", userId)
      .maybeSingle();

    let sheetId: string;
    let action: "created" | "updated" | "revised" = "created";

    if (!existing) {
      const { data: created, error } = await supabase
        .from("tech_sheets")
        .insert({
          owner_id: userId,
          code: p.code,
          product_id: productId,
          status: "rascunho",
          overhead_pct: p.overhead_pct ?? 0,
          content: p.notes ?? null,
        })
        .select("id")
        .single();
      if (error) throw new Error(`Falha ao criar ficha: ${error.message}`);
      sheetId = created.id;
      action = "created";
    } else if (existing.status === "aprovada") {
      // Nunca sobrescrever aprovada — criar nova ficha rascunho com sufixo -rev
      const revCode = `${p.code}-rev-${new Date().toISOString().slice(0, 10)}`;
      const { data: created, error } = await supabase
        .from("tech_sheets")
        .insert({
          owner_id: userId,
          code: revCode,
          product_id: productId,
          status: "rascunho",
          overhead_pct: p.overhead_pct ?? 0,
          content: p.notes ?? null,
        })
        .select("id")
        .single();
      if (error) throw new Error(`Falha ao criar revisão: ${error.message}`);
      sheetId = created.id;
      action = "revised";
    } else {
      sheetId = existing.id;
      // limpar children antes de reimportar
      await Promise.all([
        supabase.from("tech_sheet_materials").delete().eq("tech_sheet_id", sheetId),
        supabase.from("tech_sheet_measurements").delete().eq("tech_sheet_id", sheetId),
        supabase.from("tech_sheet_operations").delete().eq("tech_sheet_id", sheetId),
      ]);
      if (p.overhead_pct != null || p.notes != null || productId) {
        await supabase
          .from("tech_sheets")
          .update({
            overhead_pct: p.overhead_pct ?? undefined,
            content: p.notes ?? undefined,
            product_id: productId ?? undefined,
          })
          .eq("id", sheetId);
      }
      action = "updated";
    }

    // 3. Inserir children
    if (p.materials.length) {
      const rows = p.materials.map((m, i) => ({
        tech_sheet_id: sheetId,
        owner_id: userId,
        name: m.name,
        unit: m.unit,
        consumption: m.consumption,
        loss_pct: m.loss_pct,
        unit_cost: m.unit_cost,
        notes: m.notes ?? null,
        position: i,
      }));
      const { error } = await supabase.from("tech_sheet_materials").insert(rows);
      if (error) throw new Error(`Materiais: ${error.message}`);
    }
    if (p.measurements.length) {
      const rows = p.measurements.map((m, i) => ({
        tech_sheet_id: sheetId,
        owner_id: userId,
        point: m.point,
        sizes: m.sizes,
        tolerance_plus: m.tolerance_plus,
        tolerance_minus: m.tolerance_minus,
        notes: m.notes ?? null,
        position: i,
      }));
      const { error } = await supabase.from("tech_sheet_measurements").insert(rows);
      if (error) throw new Error(`Medidas: ${error.message}`);
    }
    if (p.operations.length) {
      const rows = p.operations.map((o, i) => ({
        tech_sheet_id: sheetId,
        owner_id: userId,
        name: o.name,
        machine: o.machine ?? null,
        sam: o.sam,
        rate_per_min: o.rate_per_min,
        notes: o.notes ?? null,
        position: i,
      }));
      const { error } = await supabase.from("tech_sheet_operations").insert(rows);
      if (error) throw new Error(`Operações: ${error.message}`);
    }

    // 4. Snapshot no versionamento para trilha de auditoria
    await supabase.from("tech_sheet_versions").insert({
      tech_sheet_id: sheetId,
      owner_id: userId,
      version_number: 0, // marker de import; incrementos "reais" vêm do fluxo de aprovação
      label: `Import ${p.source} · ${p.version_label ?? new Date().toISOString().slice(0, 10)}`,
      notes: `Tech pack importado (${p.materials.length} materiais, ${p.measurements.length} medidas, ${p.operations.length} operações).`,
      snapshot: p as unknown as Record<string, unknown>,
      created_by: userId,
    });

    // 5. Audit log
    await supabase.rpc("log_audit", {
      _entity: "tech_sheet",
      _entity_id: sheetId,
      _action: `tech_pack_${action}`,
      _payload: {
        source: p.source,
        code: p.code,
        materials: p.materials.length,
        measurements: p.measurements.length,
        operations: p.operations.length,
      },
    });

    return {
      tech_sheet_id: sheetId,
      action,
      counts: {
        materials: p.materials.length,
        measurements: p.measurements.length,
        operations: p.operations.length,
      },
    };
  });
