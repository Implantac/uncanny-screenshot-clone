import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DocSource =
  | "tech_sheet"
  | "supplier_portal"
  | "collection_cover"
  | "collection_moodboard"
  | "product_image";

export type DocItem = {
  id: string;
  source: DocSource;
  title: string;
  subtitle: string | null;
  url: string;
  mime: string | null;
  size: number | null;
  kind: string | null;
  createdAt: string;
  link: string | null;
  refId: string | null;
  isImage: boolean;
  isPdf: boolean;
};

function imageFromMime(mime: string | null, url: string): boolean {
  if (mime && mime.startsWith("image/")) return true;
  return /\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/i.test(url);
}
function pdfFromMime(mime: string | null, url: string): boolean {
  if (mime === "application/pdf") return true;
  return /\.pdf(\?|$)/i.test(url);
}

export const listDocumentsHub = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { sources?: DocSource[]; search?: string; limit?: number } | undefined) =>
      input ?? {},
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const limit = Math.min(Math.max(data.limit ?? 200, 50), 500);
    const wanted = new Set<DocSource>(
      data.sources ?? [
        "tech_sheet",
        "supplier_portal",
        "collection_cover",
        "collection_moodboard",
        "product_image",
      ],
    );
    const search = (data.search ?? "").trim().toLowerCase();
    const items: DocItem[] = [];

    if (wanted.has("tech_sheet")) {
      const { data: rows } = await supabase
        .from("tech_sheet_attachments")
        .select("id, tech_sheet_id, file_name, file_url, mime_type, size_bytes, kind, created_at, tech_sheets:tech_sheet_id(code, products:product_id(name, sku))")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
      for (const r of rows ?? []) {
        const ts = (r as any).tech_sheets;
        items.push({
          id: `ts-${r.id}`,
          source: "tech_sheet",
          title: r.file_name,
          subtitle: ts?.products?.name
            ? `${ts.code ?? ""} · ${ts.products.name}${ts.products.sku ? ` (${ts.products.sku})` : ""}`
            : (ts?.code ?? "Ficha técnica"),
          url: r.file_url,
          mime: r.mime_type,
          size: r.size_bytes,
          kind: r.kind,
          createdAt: r.created_at,
          link: r.tech_sheet_id ? `/fichas-tecnicas?id=${r.tech_sheet_id}` : null,
          refId: r.tech_sheet_id,
          isImage: imageFromMime(r.mime_type, r.file_url),
          isPdf: pdfFromMime(r.mime_type, r.file_url),
        });
      }
    }

    if (wanted.has("supplier_portal")) {
      const { data: rows } = await supabase
        .from("supplier_portal_attachments")
        .select("id, file_name, file_path, mime, size, attachment_kind, created_at, supplier_id, production_order_id, suppliers:supplier_id(name), production_orders:production_order_id(code)")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
      const paths = (rows ?? []).map((r: any) => r.file_path).filter(Boolean);
      const urlMap = new Map<string, string>();
      if (paths.length) {
        const { data: signed } = await supabase.storage
          .from("supplier-uploads")
          .createSignedUrls(paths, 60 * 60);
        for (const s of signed ?? []) {
          if (s.path && s.signedUrl) urlMap.set(s.path, s.signedUrl);
        }
      }
      for (const r of rows ?? []) {
        const url = urlMap.get((r as any).file_path) ?? "";
        if (!url) continue;
        const op = (r as any).production_orders?.code;
        const sup = (r as any).suppliers?.name;
        items.push({
          id: `sp-${r.id}`,
          source: "supplier_portal",
          title: r.file_name,
          subtitle: [sup, op].filter(Boolean).join(" · ") || "Portal do fornecedor",
          url,
          mime: (r as any).mime,
          size: (r as any).size,
          kind: (r as any).attachment_kind,
          createdAt: r.created_at,
          link: r.production_order_id ? `/producao?id=${r.production_order_id}` : "/fornecedores",
          refId: r.production_order_id ?? r.supplier_id,
          isImage: imageFromMime((r as any).mime, url),
          isPdf: pdfFromMime((r as any).mime, url),
        });
      }
    }

    if (wanted.has("collection_cover")) {
      const { data: rows } = await supabase
        .from("collections")
        .select("id, name, season, year, cover_url, updated_at")
        .eq("owner_id", userId)
        .not("cover_url", "is", null)
        .order("updated_at", { ascending: false })
        .limit(limit);
      for (const r of rows ?? []) {
        items.push({
          id: `cc-${r.id}`,
          source: "collection_cover",
          title: `Capa · ${r.name}`,
          subtitle: [r.season, r.year].filter(Boolean).join(" "),
          url: r.cover_url as string,
          mime: "image/*",
          size: null,
          kind: "cover",
          createdAt: r.updated_at,
          link: `/colecoes?id=${r.id}`,
          refId: r.id,
          isImage: true,
          isPdf: false,
        });
      }
    }

    if (wanted.has("collection_moodboard")) {
      const { data: rows } = await supabase
        .from("collection_moodboard")
        .select("id, collection_id, image_url, caption, kind, created_at, collections:collection_id(name)")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
      for (const r of rows ?? []) {
        items.push({
          id: `mb-${r.id}`,
          source: "collection_moodboard",
          title: r.caption || "Moodboard",
          subtitle: (r as any).collections?.name ?? "Coleção",
          url: r.image_url,
          mime: "image/*",
          size: null,
          kind: r.kind ?? "inspiracao",
          createdAt: r.created_at,
          link: `/colecoes?id=${r.collection_id}`,
          refId: r.collection_id,
          isImage: true,
          isPdf: false,
        });
      }
    }

    if (wanted.has("product_image")) {
      const { data: rows } = await supabase
        .from("products")
        .select("id, name, sku, image_url, updated_at")
        .eq("owner_id", userId)
        .not("image_url", "is", null)
        .order("updated_at", { ascending: false })
        .limit(limit);
      for (const r of rows ?? []) {
        items.push({
          id: `pi-${r.id}`,
          source: "product_image",
          title: r.name,
          subtitle: r.sku ?? "Produto",
          url: r.image_url as string,
          mime: "image/*",
          size: null,
          kind: "product",
          createdAt: r.updated_at,
          link: `/produtos?id=${r.id}`,
          refId: r.id,
          isImage: true,
          isPdf: false,
        });
      }
    }

    let filtered = items;
    if (search) {
      filtered = items.filter((i) =>
        `${i.title} ${i.subtitle ?? ""} ${i.kind ?? ""}`.toLowerCase().includes(search),
      );
    }
    filtered.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    const counts: Record<DocSource, number> = {
      tech_sheet: 0,
      supplier_portal: 0,
      collection_cover: 0,
      collection_moodboard: 0,
      product_image: 0,
    };
    for (const i of items) counts[i.source]++;

    return { items: filtered.slice(0, limit), counts, total: filtered.length };
  });
