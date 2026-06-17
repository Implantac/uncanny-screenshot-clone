import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function buildSnapshot(supabase: any, sheetId: string) {
  const [{ data: sheet }, { data: materials }, { data: operations }, { data: measurements }] = await Promise.all([
    supabase.from("tech_sheets").select("*").eq("id", sheetId).maybeSingle(),
    supabase.from("tech_sheet_materials").select("*").eq("tech_sheet_id", sheetId),
    supabase.from("tech_sheet_operations").select("*").eq("tech_sheet_id", sheetId),
    supabase.from("tech_sheet_measurements").select("*").eq("tech_sheet_id", sheetId),
  ]);
  return { sheet, materials: materials ?? [], operations: operations ?? [], measurements: measurements ?? [] };
}

export const listTechSheetVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ techSheetId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("tech_sheet_versions")
      .select("id, version_number, label, notes, created_at, created_by")
      .eq("tech_sheet_id", data.techSheetId)
      .order("version_number", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

export const createTechSheetVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      techSheetId: z.string().uuid(),
      label: z.string().trim().max(120).optional(),
      notes: z.string().trim().max(1000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: sheet, error: sErr } = await supabase
      .from("tech_sheets").select("id, owner_id").eq("id", data.techSheetId).maybeSingle();
    if (sErr) throw sErr;
    if (!sheet) throw new Error("Ficha não encontrada");

    const snapshot = await buildSnapshot(supabase, data.techSheetId);

    const { data: last } = await supabase
      .from("tech_sheet_versions")
      .select("version_number")
      .eq("tech_sheet_id", data.techSheetId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextNum = (last?.version_number ?? 0) + 1;

    const { data: inserted, error } = await supabase
      .from("tech_sheet_versions")
      .insert({
        owner_id: userId,
        tech_sheet_id: data.techSheetId,
        version_number: nextNum,
        label: data.label ?? null,
        notes: data.notes ?? null,
        snapshot,
        created_by: userId,
      })
      .select("id, version_number")
      .single();
    if (error) throw error;
    return inserted;
  });

export const getTechSheetVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ versionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("tech_sheet_versions").select("*").eq("id", data.versionId).maybeSingle();
    if (error) throw error;
    return row;
  });

type Snap = Awaited<ReturnType<typeof buildSnapshot>>;

function diffHeader(a: any, b: any) {
  const fields = ["status", "size_range", "composition", "cost_price", "materials_cost", "labor_cost", "overhead_pct", "notes"];
  const changes: { field: string; from: any; to: any }[] = [];
  for (const f of fields) {
    if ((a?.[f] ?? null) !== (b?.[f] ?? null)) changes.push({ field: f, from: a?.[f] ?? null, to: b?.[f] ?? null });
  }
  return changes;
}

function diffList<T extends Record<string, any>>(a: T[], b: T[], keyOf: (r: T) => string, compareFields: string[]) {
  const ma = new Map(a.map((r) => [keyOf(r), r]));
  const mb = new Map(b.map((r) => [keyOf(r), r]));
  const added: T[] = [];
  const removed: T[] = [];
  const changed: { key: string; row: T; changes: { field: string; from: any; to: any }[] }[] = [];
  for (const [k, rowB] of mb) {
    const rowA = ma.get(k);
    if (!rowA) { added.push(rowB); continue; }
    const changes = compareFields
      .map((f) => ({ field: f, from: rowA[f] ?? null, to: rowB[f] ?? null }))
      .filter((c) => c.from !== c.to);
    if (changes.length) changed.push({ key: k, row: rowB, changes });
  }
  for (const [k, rowA] of ma) if (!mb.has(k)) removed.push(rowA);
  return { added, removed, changed };
}

export const diffTechSheetVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ fromId: z.string().uuid(), toId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("tech_sheet_versions")
      .select("id, version_number, label, snapshot, created_at")
      .in("id", [data.fromId, data.toId]);
    if (error) throw error;
    const from = rows?.find((r: any) => r.id === data.fromId);
    const to = rows?.find((r: any) => r.id === data.toId);
    if (!from || !to) throw new Error("Versões não encontradas");

    const sa = from.snapshot as Snap;
    const sb = to.snapshot as Snap;

    return {
      from: { id: from.id, version_number: from.version_number, label: from.label, created_at: from.created_at },
      to: { id: to.id, version_number: to.version_number, label: to.label, created_at: to.created_at },
      header: diffHeader(sa.sheet, sb.sheet),
      materials: diffList(
        sa.materials, sb.materials,
        (r: any) => r.id ?? `${r.name}-${r.color ?? ""}`,
        ["name", "supplier", "color", "consumption", "unit", "unit_cost", "total_cost", "notes"],
      ),
      operations: diffList(
        sa.operations, sb.operations,
        (r: any) => r.id ?? `${r.name}-${r.position ?? 0}`,
        ["name", "position", "sam", "unit_cost", "total_cost", "notes"],
      ),
      measurements: diffList(
        sa.measurements, sb.measurements,
        (r: any) => r.id ?? `${r.point}-${r.size ?? ""}`,
        ["point", "size", "value", "tolerance", "notes"],
      ),
    };
  });
