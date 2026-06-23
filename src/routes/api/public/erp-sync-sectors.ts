/**
 * Sincronização global ERP → PLM dos setores das OPs ativas.
 * Protegido por CRON_SECRET (header x-cron-secret). Read-only no ERP;
 * atualiza apenas production_orders.stage no PLM.
 */
import { createFileRoute } from "@tanstack/react-router";

type Stage =
  | "compras"
  | "corte"
  | "bordado"
  | "bordado_terc"
  | "silk"
  | "silk_terc"
  | "costura"
  | "costura_terc"
  | "acabamento"
  | "entregue";

const STAGE_BY_SECTOR: Record<string, Stage> = {
  corte: "corte",
  bordado: "bordado",
  "bordado terceirizado": "bordado_terc",
  silk: "silk",
  "silk terceirizado": "silk_terc",
  costura: "costura",
  "costura terceirizado": "costura_terc",
  acabamento: "acabamento",
  expedicao: "entregue",
  expedicão: "entregue",
  expedição: "entregue",
};

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

const extractErpPedidoId = (notes: string | null): number | null => {
  if (!notes) return null;
  const m = notes.match(/\[erp:pedido:(\d+)/i);
  return m ? Number(m[1]) : null;
};

export const Route = createFileRoute("/api/public/erp-sync-sectors")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-cron-secret") ?? "";
        const expected = process.env.CRON_SECRET ?? "";
        if (!expected || secret !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const url = new URL(request.url);
        if (url.searchParams.get("probe") === "1") {
          const { usesoftQuery } = await import("@/integrations/usesoft/client.server");
          const cols = await usesoftQuery(
            `SELECT table_name, column_name FROM information_schema.columns
              WHERE table_schema='public' AND table_name IN ('indsetin','indpcpst','indpcpip')
              ORDER BY table_name, ordinal_position`,
          );
          return Response.json({ cols: cols.rows });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { usesoftQuery } = await import("@/integrations/usesoft/client.server");


        const { data: orders, error } = await supabaseAdmin
          .from("production_orders")
          .select("id, owner_id, code, stage, notes, status")
          .not("status", "in", "(concluida,cancelada)");
        if (error) return Response.json({ error: error.message }, { status: 500 });

        type Item = {
          id: string;
          owner_id: string;
          code: string;
          stage: Stage;
          pedido_id: number;
        };
        const linked: Item[] = [];
        let noLink = 0;
        for (const o of orders ?? []) {
          const pid = extractErpPedidoId(o.notes);
          if (pid == null) {
            noLink++;
            continue;
          }
          linked.push({
            id: o.id,
            owner_id: o.owner_id,
            code: o.code,
            stage: o.stage as Stage,
            pedido_id: pid,
          });
        }

        if (linked.length === 0) {
          return Response.json({ checked: 0, updated: 0, no_link: noLink, divergences: [] });
        }

        const pedidoIds = Array.from(new Set(linked.map((l) => l.pedido_id)));

        const erpRes = await usesoftQuery<{ nnumeropedid: number; cnomesetin: string }>(
          `
          WITH items AS (
            SELECT DISTINCT ip.nnumeropcpip, ip.nnumeropedid
              FROM indpcpip ip
             WHERE ip.nnumeropedid = ANY($1::int[])
          ),
          ranked AS (
            SELECT i.nnumeropedid,
                   st.nnumerosetin,
                   ROW_NUMBER() OVER (
                     PARTITION BY i.nnumeropedid
                     ORDER BY st.nsequenpcpst
                   ) AS rn
              FROM items i
              JOIN indpcpst st ON st.nnumeropcpip = i.nnumeropcpip
             WHERE st.cfinalipcpst = 'N'
               AND st.dentradpcpst IS NOT NULL
          )
          SELECT r.nnumeropedid, s.cnomesetin
            FROM ranked r
            JOIN indsetin s ON s.nnumerosetin = r.nnumerosetin
           WHERE r.rn = 1
          `,
          [pedidoIds],
        );

        const sectorByPedido = new Map<number, string>();
        for (const r of erpRes.rows) sectorByPedido.set(Number(r.nnumeropedid), r.cnomesetin);

        let updated = 0;
        let okCount = 0;
        let unmapped = 0;
        let erpMissing = 0;
        const divergences: Array<{
          code: string;
          from: Stage;
          to: Stage;
          sector: string;
        }> = [];

        for (const it of linked) {
          const sector = sectorByPedido.get(it.pedido_id);
          if (!sector) {
            erpMissing++;
            continue;
          }
          const target = STAGE_BY_SECTOR[normalize(sector)];
          if (!target) {
            unmapped++;
            continue;
          }
          if (target === it.stage) {
            okCount++;
            continue;
          }
          const { error: uerr } = await supabaseAdmin
            .from("production_orders")
            .update({ stage: target })
            .eq("id", it.id);
          if (!uerr) {
            updated++;
            divergences.push({ code: it.code, from: it.stage, to: target, sector });
          }
        }

        return Response.json({
          checked: linked.length,
          ok: okCount,
          updated,
          no_link: noLink,
          erp_missing: erpMissing,
          unmapped,
          divergences,
        });
      },
    },
  },
});
