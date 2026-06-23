/**
 * Sincronização global ERP → PLM (item por item).
 *
 * Para cada item (indpcpip) de pedido ativo no ERP Usesoft:
 *  - se a OP não existe no PLM (marker [erp:pedido:<P>:item:<I>]), cria;
 *  - se existe mas o stage diverge do setor atual no ERP, atualiza.
 *
 * Read-only no ERP. Escreve apenas em production_orders.
 * Protegido por CRON_SECRET (header x-cron-secret).
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
  compras: "compras",
  corte: "corte",
  bordado: "bordado",
  "bordado terceirizado": "bordado_terc",
  "bordado terceirizada": "bordado_terc",
  silk: "silk",
  "silk terceirizado": "silk_terc",
  "silk terceirizada": "silk_terc",
  costura: "costura",
  "costura terceirizado": "costura_terc",
  "costura terceirizada": "costura_terc",
  acabamento: "acabamento",
  expedicao: "entregue",
  expedicão: "entregue",
  expedição: "entregue",
};

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

type ErpItem = {
  nnumeropcpip: number;
  nnumeroitped: number;
  nnumeropedid: number;
  nnumeroprodu: number;
  nquatdepcpip: string | number | null;
  setor: string | null;
  ncodigopedid: string | null;
  cliente: string | null;
  ddataentrega: string | null;
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
        const dryRun = url.searchParams.get("dry") === "1";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { usesoftQuery } = await import("@/integrations/usesoft/client.server");

        // Owner único do tenant (single-tenant atualmente).
        const { data: ownerRow } = await supabaseAdmin
          .from("production_orders")
          .select("owner_id")
          .limit(1)
          .maybeSingle();
        const ownerId = ownerRow?.owner_id;
        if (!ownerId) {
          return Response.json({ error: "Sem owner_id base — crie ao menos uma OP." }, { status: 400 });
        }

        // 1) Todos os itens ativos do ERP (setor atual = última sequência não finalizada com entrada).
        // OPs realmente abertas no PCP do ERP: status 'U' (em produção) e
        // entrega não vencida há mais de 180 dias (descarta lixo histórico).
        // Sobrescreva o status via ?status=U,A ou a janela via ?days=N.
        const days = Math.max(1, Math.min(3650, Number(url.searchParams.get("days") ?? "180")));
        const statusesParam = (url.searchParams.get("status") ?? "U")
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean);
        const erpRes = await usesoftQuery<ErpItem>(
          `
          WITH recent_ped AS (
            -- Apenas O.C. Cliente (tipo 99 - Ordem de Producao), em producao.
            -- Identificamos o tipo pelo nome ("99 -..." ou contem "ORDEM DE PRODU")
            -- na tabela soltpped para nao depender de ID hardcoded.
            SELECT p.nnumeropedid, p.ncodigopedid, p.cliente, p.ddataentrega
              FROM pedidos p
              JOIN soltpped t ON t.nnumerotpped = p.nnumerotpped
             WHERE p.cstatuspedid = ANY($2::text[])
               AND (
                     COALESCE(t.cnometpped,'') ILIKE '99 -%'
                  OR COALESCE(t.cnometpped,'') ILIKE '%ORDEM DE PRODU%'
                   )
               AND p.ddataentrega >= CURRENT_DATE - ($1 || ' days')::interval
          ),
          active AS (
            SELECT st.nnumeropcpip, st.nnumerosetin,
                   ROW_NUMBER() OVER (PARTITION BY st.nnumeropcpip
                                       ORDER BY st.nsequenpcpst DESC) AS rn
              FROM indpcpst st
             WHERE st.cfinalipcpst = 'N'
               AND st.dentradpcpst IS NOT NULL
          ),
          cur AS (
            SELECT a.nnumeropcpip, s.cdescrisetin AS setor
              FROM active a
              JOIN indsetin s ON s.nnumerosetin = a.nnumerosetin
             WHERE a.rn = 1
          )
          SELECT ip.nnumeropcpip, ip.nnumeroitped, ip.nnumeropedid,
                 ip.nnumeroprodu, ip.nquatdepcpip, c.setor,
                 p.ncodigopedid, p.cliente, p.ddataentrega
            FROM cur c
            JOIN indpcpip ip ON ip.nnumeropcpip = c.nnumeropcpip
            JOIN recent_ped p ON p.nnumeropedid = ip.nnumeropedid
           ORDER BY ip.nnumeropedid, ip.nnumeropcpip
          `,
          [String(days), statusesParam],
        );
        const erpItems = erpRes.rows;

        // 2) OPs existentes no PLM com marker item.
        const { data: existing, error: exErr } = await supabaseAdmin
          .from("production_orders")
          .select("id, code, stage, notes")
          .eq("owner_id", ownerId);
        if (exErr) return Response.json({ error: exErr.message }, { status: 500 });

        const byMarker = new Map<string, { id: string; stage: Stage }>();
        const byCode = new Map<string, { id: string; stage: Stage }>();
        for (const o of existing ?? []) {
          const ref = { id: o.id, stage: o.stage as Stage };
          const m = (o.notes ?? "").match(/\[erp:pedido:(\d+):item:(\d+)\]/);
          if (m) byMarker.set(`${m[1]}:${m[2]}`, ref);
          if (o.code) byCode.set(o.code, ref);
        }

        let inserted = 0;
        let updated = 0;
        let okCount = 0;
        let unmapped = 0;
        const unmappedSectors = new Set<string>();
        const divergences: Array<{ code: string; from?: Stage; to: Stage; sector: string }> = [];

        for (const it of erpItems) {
          const setor = (it.setor ?? "").trim();
          const target = STAGE_BY_SECTOR[normalize(setor)];
          if (!target) {
            unmapped++;
            unmappedSectors.add(setor);
            continue;
          }
          const key = `${it.nnumeropedid}:${it.nnumeroitped}`;
          const ex = byMarker.get(key);
          if (ex) {
            if (ex.stage === target) {
              okCount++;
            } else {
              if (!dryRun) {
                await supabaseAdmin
                  .from("production_orders")
                  .update({ stage: target })
                  .eq("id", ex.id);
              }
              updated++;
              divergences.push({ code: key, from: ex.stage, to: target, sector: setor });
            }
            continue;
          }

          // Inserir nova OP (com fallback dedupe por code para evitar duplicatas
          // de OPs legadas que não tinham marker `:item:` nas notas).
          const code = `${it.ncodigopedid?.trim() || it.nnumeropedid}/${it.nnumeroitped}`;
          const exByCode = byCode.get(code);
          if (exByCode) {
            if (exByCode.stage === target) {
              okCount++;
            } else {
              if (!dryRun) {
                await supabaseAdmin
                  .from("production_orders")
                  .update({ stage: target })
                  .eq("id", exByCode.id);
              }
              updated++;
              divergences.push({ code, from: exByCode.stage, to: target, sector: setor });
            }
            continue;
          }

          const qty = Math.max(0, Math.round(Number(it.nquatdepcpip ?? 0)));
          const marker = `[erp:pedido:${it.nnumeropedid}:item:${it.nnumeroitped}]`;
          const notes = `Importada do ERP Usesoft (pedido ${it.nnumeropedid}, código ${it.ncodigopedid ?? "?"}, item ${it.nnumeroitped}). Cliente: ${(it.cliente ?? "").trim()}. Produto ERP ${it.nnumeroprodu}. Setor atual: ${setor}. ${marker}`;
          const due = it.ddataentrega ? new Date(it.ddataentrega).toISOString().slice(0, 10) : null;

          if (!dryRun) {
            const { error: insErr } = await supabaseAdmin.from("production_orders").insert({
              owner_id: ownerId,
              code,
              quantity: qty,
              status: "aguardando",
              stage: target,
              notes,
              due_date: due,
            });
            if (insErr) {
              return Response.json(
                { error: `Falha ao inserir ${code}: ${insErr.message}`, partial: { inserted, updated } },
                { status: 500 },
              );
            }
          }
          inserted++;
          divergences.push({ code, to: target, sector: setor });
        }

        return Response.json({
          dry_run: dryRun,
          erp_items: erpItems.length,
          inserted,
          updated,
          ok: okCount,
          unmapped,
          unmapped_sectors: [...unmappedSectors],
          divergences: divergences.slice(0, 50),
        });
      },
    },
  },
});
