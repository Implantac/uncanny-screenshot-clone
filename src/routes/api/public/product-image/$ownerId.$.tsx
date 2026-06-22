/**
 * Proxy público para servir imagens de produtos armazenadas no bucket privado
 * `product-images`. Usa supabaseAdmin para baixar e retorna bytes com cache CDN.
 *
 * Caminho: /api/public/product-image/{ownerId}/{subpath...}
 * Storage path: `{subpath}` dentro do bucket `product-images`.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/product-image/$ownerId/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const ownerId = params.ownerId;
        const sub = (params as Record<string, string>)._splat ?? "";
        if (!ownerId || !sub) {
          return new Response("Not found", { status: 404 });
        }
        const safeOwner = /^[0-9a-f-]{36}$/i.test(ownerId);
        if (!safeOwner) return new Response("Bad request", { status: 400 });

        const path = `${ownerId}/${sub}`;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage
          .from("product-images")
          .download(path);
        if (error || !data) {
          return new Response("Not found", { status: 404 });
        }
        const buf = await data.arrayBuffer();
        const ext = sub.split(".").pop()?.toLowerCase() ?? "jpg";
        const mime =
          ext === "png" ? "image/png" :
          ext === "webp" ? "image/webp" :
          ext === "gif" ? "image/gif" :
          "image/jpeg";
        return new Response(buf, {
          status: 200,
          headers: {
            "content-type": mime,
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
