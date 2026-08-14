import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Shared types ----------

export type ImportEntity = "suppliers" | "materials" | "products";

export type ImportResult = {
  entity: ImportEntity;
  received: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

// ---------- Row schemas ----------

const SupplierRow = z.object({
  name: z.string().min(1, "name obrigatório"),
  document: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  phone: z.string().optional().nullable(),
  contact_name: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  lead_time_days: z.coerce.number().int().nonnegative().optional().nullable(),
  min_order_qty: z.coerce.number().nonnegative().optional().nullable(),
  min_order_value: z.coerce.number().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const MaterialRow = z.object({
  code: z.string().min(1, "code obrigatório"),
  name: z.string().min(1, "name obrigatório"),
  kind: z.string().min(1, "kind obrigatório (tecido/aviamento/acabado/outros)"),
  unit: z.string().optional().nullable(),
  composition: z.string().optional().nullable(),
  color_hex: z
    .string()
    .regex(/^#?[0-9a-fA-F]{6}$/)
    .optional()
    .or(z.literal(""))
    .nullable(),
  reference_cost: z.coerce.number().nonnegative().optional().nullable(),
  description: z.string().optional().nullable(),
  image_url: z.string().url().optional().or(z.literal("")).nullable(),
});

const ProductRow = z.object({
  sku: z.string().min(1, "sku obrigatório"),
  name: z.string().min(1, "name obrigatório"),
  category: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  cost_price: z.coerce.number().nonnegative().optional().nullable(),
  sell_price: z.coerce.number().nonnegative().optional().nullable(),
  colors: z.string().optional().nullable(), // pipe-separated
  sizes: z.string().optional().nullable(), // pipe-separated
  grade: z.string().optional().nullable(),
  product_group: z.string().optional().nullable(),
  subgroup: z.string().optional().nullable(),
});

const InputSchema = z.object({
  entity: z.enum(["suppliers", "materials", "products"]),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))).max(2000),
  dryRun: z.boolean().default(false),
});

// ---------- Helpers ----------

function cleanEmpty<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === "" || v === undefined) continue;
    out[k] = v;
  }
  return out as T;
}

function splitPipes(v: string | null | undefined): string[] | null {
  if (!v) return null;
  const arr = String(v)
    .split(/[|,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return arr.length ? arr : null;
}

// ---------- Server function ----------

export const bulkImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }): Promise<ImportResult> => {
    const { entity, rows, dryRun } = data;
    const supabase = context.supabase;
    const userId = context.userId;

    const result: ImportResult = {
      entity,
      received: rows.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    if (entity === "suppliers") {
      // fetch existing by document within owner
      const { data: existing } = await supabase
        .from("suppliers")
        .select("id,document,name")
        .eq("owner_id", userId);
      const byDoc = new Map(
        (existing ?? []).filter((s) => s.document).map((s) => [String(s.document), s.id]),
      );
      const byName = new Map((existing ?? []).map((s) => [s.name.toLowerCase(), s.id]));

      for (let i = 0; i < rows.length; i++) {
        try {
          const parsed = SupplierRow.parse(rows[i]);
          const clean = cleanEmpty(parsed);
          const key = parsed.document
            ? byDoc.get(String(parsed.document))
            : byName.get(parsed.name.toLowerCase());
          if (key) {
            if (!dryRun) {
              const { error } = await supabase
                .from("suppliers")
                .update(clean)
                .eq("id", key)
                .eq("owner_id", userId);
              if (error) throw error;
            }
            result.updated++;
          } else {
            if (!dryRun) {
              const { error } = await supabase
                .from("suppliers")
                .insert({ ...clean, owner_id: userId, name: parsed.name });
              if (error) throw error;
            }
            result.inserted++;
          }
        } catch (e) {
          result.skipped++;
          result.errors.push({ row: i + 2, message: e instanceof Error ? e.message : String(e) });
        }
      }
    } else if (entity === "materials") {
      const { data: existing } = await supabase
        .from("material_library")
        .select("id,code")
        .eq("owner_id", userId);
      const byCode = new Map((existing ?? []).map((m) => [m.code.toLowerCase(), m.id]));

      for (let i = 0; i < rows.length; i++) {
        try {
          const parsed = MaterialRow.parse(rows[i]);
          const clean = cleanEmpty(parsed);
          if (clean.color_hex && !String(clean.color_hex).startsWith("#")) {
            clean.color_hex = `#${clean.color_hex}`;
          }
          const key = byCode.get(parsed.code.toLowerCase());
          if (key) {
            if (!dryRun) {
              const { error } = await supabase
                .from("material_library")
                .update(clean)
                .eq("id", key)
                .eq("owner_id", userId);
              if (error) throw error;
            }
            result.updated++;
          } else {
            if (!dryRun) {
              const { error } = await supabase.from("material_library").insert({
                ...clean,
                owner_id: userId,
                code: parsed.code,
                name: parsed.name,
                kind: parsed.kind,
              });
              if (error) throw error;
            }
            result.inserted++;
          }
        } catch (e) {
          result.skipped++;
          result.errors.push({ row: i + 2, message: e instanceof Error ? e.message : String(e) });
        }
      }
    } else if (entity === "products") {
      const { data: existing } = await supabase
        .from("products")
        .select("id,sku")
        .eq("owner_id", userId);
      const bySku = new Map((existing ?? []).map((p) => [p.sku.toLowerCase(), p.id]));

      for (let i = 0; i < rows.length; i++) {
        try {
          const parsed = ProductRow.parse(rows[i]);
          const payload = cleanEmpty({
            ...parsed,
            colors: splitPipes(parsed.colors ?? null),
            sizes: splitPipes(parsed.sizes ?? null),
          });
          const key = bySku.get(parsed.sku.toLowerCase());
          if (key) {
            if (!dryRun) {
              const { error } = await supabase
                .from("products")
                .update(payload)
                .eq("id", key)
                .eq("owner_id", userId);
              if (error) throw error;
            }
            result.updated++;
          } else {
            if (!dryRun) {
              const { error } = await supabase.from("products").insert({
                ...payload,
                owner_id: userId,
                sku: parsed.sku,
                name: parsed.name,
              });
              if (error) throw error;
            }
            result.inserted++;
          }
        } catch (e) {
          result.skipped++;
          result.errors.push({ row: i + 2, message: e instanceof Error ? e.message : String(e) });
        }
      }
    }

    // trim error list to protect payload size
    if (result.errors.length > 50) {
      result.errors = result.errors.slice(0, 50);
    }
    return result;
  });

// ---------- Templates (used by UI to render "baixar modelo") ----------

export const IMPORT_TEMPLATES: Record<
  ImportEntity,
  { required: string[]; optional: string[]; sample: Record<string, string>[] }
> = {
  suppliers: {
    required: ["name"],
    optional: [
      "document",
      "category",
      "email",
      "phone",
      "contact_name",
      "city",
      "state",
      "lead_time_days",
      "min_order_qty",
      "min_order_value",
      "notes",
    ],
    sample: [
      {
        name: "Malharia Santista",
        document: "12.345.678/0001-90",
        category: "Malha",
        email: "vendas@santista.com.br",
        phone: "(11) 3333-4444",
        contact_name: "Ana Silva",
        city: "São Paulo",
        state: "SP",
        lead_time_days: "15",
        min_order_qty: "50",
        min_order_value: "2000",
        notes: "Ótima qualidade em piquet",
      },
    ],
  },
  materials: {
    required: ["code", "name", "kind"],
    optional: ["unit", "composition", "color_hex", "reference_cost", "description", "image_url"],
    sample: [
      {
        code: "MAL-001",
        name: "Malha PV 30/1",
        kind: "tecido",
        unit: "kg",
        composition: "67% PES 33% VIS",
        color_hex: "#0055AA",
        reference_cost: "42.50",
        description: "Malha piquet estrutural",
        image_url: "",
      },
    ],
  },
  products: {
    required: ["sku", "name"],
    optional: [
      "category",
      "description",
      "cost_price",
      "sell_price",
      "colors",
      "sizes",
      "grade",
      "product_group",
      "subgroup",
    ],
    sample: [
      {
        sku: "CAM-POLO-001",
        name: "Camisa Polo Piquet",
        category: "Camisaria",
        description: "Polo clássica gola V",
        cost_price: "28.90",
        sell_price: "149.90",
        colors: "Branco|Preto|Azul Marinho",
        sizes: "P|M|G|GG",
        grade: "adulto",
        product_group: "Camisas",
        subgroup: "Polo",
      },
    ],
  },
};
