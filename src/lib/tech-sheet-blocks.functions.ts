import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Blocos técnicos suportados pela ficha (chaves do JSON content). */
export const TECH_SHEET_BLOCKS = [
  "composition",
  "packaging",
  "treatments",
  "printing",
  "embroidery",
  "laundry",
  "quality",
] as const;

export type TechSheetBlockKey = (typeof TECH_SHEET_BLOCKS)[number];

export type SheetBlockRow = Record<string, string>;

/** Mapa de tabela física por bloco. */
const BLOCK_TABLE: Record<TechSheetBlockKey, string> = {
  composition: "tech_sheet_composition",
  packaging: "tech_sheet_packaging",
  treatments: "tech_sheet_treatments",
  printing: "tech_sheet_printing",
  embroidery: "tech_sheet_embroidery",
  laundry: "tech_sheet_laundry",
  quality: "tech_sheet_quality",
};

/** Mapa de colunas (órbitas) por bloco — preserva a ordem. */
const BLOCK_COLUMNS: Record<TechSheetBlockKey, string[]> = {
  composition: ["fiber", "pct", "notes"],
  packaging: ["type", "material", "dims", "notes"],
  treatments: ["type", "description", "supplier"],
  printing: ["technique", "colors", "supplier", "notes"],
  embroidery: ["technique", "stitch", "supplier", "notes"],
  laundry: ["wash", "supplier", "instructions"],
  quality: ["instruction"],
};

function parseContent(content: string | null): Record<string, SheetBlockRow[]> {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, SheetBlockRow[]>) : {};
  } catch {
    return {};
  }
}

/**
 * Lê os 7 blocos de uma ficha técnica.
 * Prioriza as tabelas transacionais; se um bloco estiver vazio
 * na tabela, faz fallback para o JSON `content` (retrocompatível).
 */
export const listTechSheetBlocks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ techSheetId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: sheet, error: sheetErr } = await supabase
      .from("tech_sheets")
      .select("id, owner_id, content")
      .eq("id", data.techSheetId)
      .maybeSingle();
    if (sheetErr) throw new Error(sheetErr.message);
    if (!sheet) throw new Error("Ficha não encontrada.");
    if (sheet.owner_id !== userId) {
      throw new Error("Sem permissão para acessar esta ficha.");
    }

    const jsonFallback = parseContent(sheet.content ?? null);
    const result: Record<TechSheetBlockKey, SheetBlockRow[]> = {
      composition: [],
      packaging: [],
      treatments: [],
      printing: [],
      embroidery: [],
      laundry: [],
      quality: [],
    };

    await Promise.all(
      TECH_SHEET_BLOCKS.map(async (block) => {
        const table = BLOCK_TABLE[block];
        const cols = BLOCK_COLUMNS[block];
        const { data: rows, error } = await supabase
          .from(table as any)
          .select("id, " + cols.join(", "))
          .eq("tech_sheet_id", data.techSheetId)
          .eq("owner_id", userId)
          .order("position");
        if (error) throw new Error(error.message);

        const typed = (rows ?? []) as unknown as (SheetBlockRow & { id: string })[];
        if (typed.length > 0) {
          result[block] = typed.map((r) => {
            const row: SheetBlockRow = {};
            for (const c of cols) row[c] = r[c] ?? "";
            return row;
          });
        } else {
          // Fallback para o JSON existente
          result[block] = Array.isArray(jsonFallback[block]) ? jsonFallback[block] : [];
        }
      }),
    );

    return result;
  });

/**
 * Salva um bloco da ficha técnica (substitui as linhas da tabela).
 * O trigger `sync_block_to_json` mantém o JSON `content` sincronizado.
 */
export const saveTechSheetBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        techSheetId: z.string().uuid(),
        block: z.enum(TECH_SHEET_BLOCKS),
        items: z.array(z.record(z.string(), z.string())).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: sheet, error: sheetErr } = await supabase
      .from("tech_sheets")
      .select("id, owner_id")
      .eq("id", data.techSheetId)
      .maybeSingle();
    if (sheetErr) throw new Error(sheetErr.message);
    if (!sheet) throw new Error("Ficha não encontrada.");
    if (sheet.owner_id !== userId) {
      throw new Error("Apenas o responsável pela ficha pode editar os blocos.");
    }

    const table = BLOCK_TABLE[data.block];
    const cols = BLOCK_COLUMNS[data.block];

    // 1) Remove linhas existentes do bloco
    const { error: delErr } = await supabase
      .from(table as any)
      .delete()
      .eq("tech_sheet_id", data.techSheetId)
      .eq("owner_id", userId);
    if (delErr) throw new Error(delErr.message);

    // 2) Insere as novas linhas (posição ordenada)
    const rows = data.items.map((item, position) => {
      const row: Record<string, unknown> = {
        owner_id: userId,
        tech_sheet_id: data.techSheetId,
        position,
      };
      for (const c of cols) row[c] = item[c]?.trim() || null;
      return row;
    });

    if (rows.length > 0) {
      const { error: insErr } = await supabase.from(table as any).insert(rows);
      if (insErr) throw new Error(insErr.message);
    }

    return { ok: true, block: data.block, count: rows.length };
  });
