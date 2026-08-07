import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { log } from "@/lib/observability";

function hashToken(t: string): string {
  return createHash("sha256").update(t).digest("hex");
}

type BlockRow = Record<string, string>;

/** Chaves dos blocos apresentados no modo fornecedor. */
const BLOCK_KEYS = [
  "composition",
  "packaging",
  "treatments",
  "printing",
  "embroidery",
  "laundry",
  "quality",
] as const;

/** Tabela física e colunas (ordem) por bloco. */
const BLOCK_TABLE: Record<(typeof BLOCK_KEYS)[number], string> = {
  composition: "tech_sheet_composition",
  packaging: "tech_sheet_packaging",
  treatments: "tech_sheet_treatments",
  printing: "tech_sheet_printing",
  embroidery: "tech_sheet_embroidery",
  laundry: "tech_sheet_laundry",
  quality: "tech_sheet_quality",
};

const BLOCK_COLUMNS: Record<(typeof BLOCK_KEYS)[number], string[]> = {
  composition: ["fiber", "pct", "notes"],
  packaging: ["type", "material", "dims", "notes"],
  treatments: ["type", "description", "supplier"],
  printing: ["technique", "colors", "supplier", "notes"],
  embroidery: ["technique", "stitch", "supplier", "notes"],
  laundry: ["wash", "supplier", "instructions"],
  quality: ["instruction"],
};

function parseContent(content: string | null): Record<string, BlockRow[]> {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, BlockRow[]>) : {};
  } catch {
    return {};
  }
}

/**
 * API pública (token) — modo fornecedor da ficha técnica.
 * GET /api/public/supplier-portal-ficha/:token/:sheetId
 *
 * Retorna dados autorizados ao fornecedor: cabeçalho da ficha, produto,
 * materiais SEM custo/fornecedor concorrente, blocos técnicos, medidas e
 * variantes/SKUs. Nunca expõe custos nem lista de fornecedores.
 */
export const Route = createFileRoute("/api/public/supplier-portal-ficha/$token/$sheetId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { token, sheetId } = params;
        if (!token || token.length < 16) return new Response("Invalid token", { status: 400 });
        if (!sheetId) return new Response("Missing sheetId", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const tokenHash = hashToken(token);
        const { data: tok } = await supabaseAdmin
          .from("supplier_portal_tokens")
          .select("id, owner_id, supplier_id, expires_at")
          .eq("token_hash", tokenHash)
          .maybeSingle();
        if (!tok) return new Response("Not found", { status: 404 });
        if (tok.expires_at && new Date(tok.expires_at) < new Date())
          return new Response("Expired", { status: 410 });

        // Ficha deve pertencer ao owner do token.
        const { data: sheet, error: sheetErr } = await supabaseAdmin
          .from("tech_sheets")
          .select("id, owner_id, product_id, code, version, status, content")
          .eq("id", sheetId)
          .maybeSingle();
        if (sheetErr) return new Response("Error", { status: 500 });
        if (!sheet) return new Response("Sheet not found", { status: 404 });
        if (sheet.owner_id !== tok.owner_id) return new Response("Forbidden", { status: 403 });

        // Produto vinculado (nome + sku apenas).
        const { data: product } = sheet.product_id
          ? await supabaseAdmin
              .from("products")
              .select("id, name, sku, image_url")
              .eq("id", sheet.product_id)
              .maybeSingle()
          : { data: null };

        // Materiais SEM custo e SEM fornecedor concorrente.
        const { data: materials = [] } = await supabaseAdmin
          .from("tech_sheet_materials")
          .select("id, name, type, code, description, color, unit, consumption, loss_pct")
          .eq("tech_sheet_id", sheetId)
          .eq("owner_id", tok.owner_id)
          .order("position");

        // Medidas (sem custo) — tabela dedicada, fallback content.measurements.
        const { data: measRows = [] } = await supabaseAdmin
          .from("tech_sheet_measurements")
          .select("point, tolerance_plus, tolerance_minus, sizes")
          .eq("tech_sheet_id", sheetId)
          .eq("owner_id", tok.owner_id)
          .order("position");

        // Blocos técnicos: tabela-first, fallback JSON.
        const jsonFallback = parseContent(sheet.content ?? null);
        const blocks: Record<(typeof BLOCK_KEYS)[number], BlockRow[]> = {
          composition: [],
          packaging: [],
          treatments: [],
          printing: [],
          embroidery: [],
          laundry: [],
          quality: [],
        };
        await Promise.all(
          BLOCK_KEYS.map(async (block) => {
            const table = BLOCK_TABLE[block];
            const cols = BLOCK_COLUMNS[block];
            const { data: rows } = await supabaseAdmin
              .from(table as any)
              .select("id, " + cols.join(", "))
              .eq("tech_sheet_id", sheetId)
              .eq("owner_id", tok.owner_id)
              .order("position");
            const typed = (rows ?? []) as unknown as (BlockRow & { id: string })[];
            if (typed.length > 0) {
              blocks[block] = typed.map((r) => {
                const row: BlockRow = {};
                for (const c of cols) row[c] = r[c] ?? "";
                return row;
              });
            } else {
              blocks[block] = Array.isArray(jsonFallback[block]) ? jsonFallback[block] : [];
            }
          }),
        );

        // Variantes/SKUs (matriz cor × tamanho) — sem custo.
        const { data: variants = [] } = sheet.product_id
          ? await supabaseAdmin
              .from("product_variants")
              .select("id, sku, active, color:color_id(name), size:size_id(label)")
              .eq("product_id", sheet.product_id)
          : { data: [] };

        // Observação geral (overview) do content.
        const overview = typeof jsonFallback.overview === "string" ? jsonFallback.overview : "";

        await supabaseAdmin
          .from("supplier_portal_tokens")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", tok.id);

        log("info", "supplier_portal_ficha.view", {
          sheet_id: sheetId,
          supplier_id: tok.supplier_id,
        });

        return Response.json({
          sheet: {
            code: sheet.code,
            version: sheet.version,
            status: sheet.status,
          },
          product,
          materials,
          measurements: measRows,
          blocks,
          overview,
          skuVariants: variants,
        });
      },
    },
  },
});
