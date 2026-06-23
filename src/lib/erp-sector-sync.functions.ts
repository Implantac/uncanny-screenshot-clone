/**
 * Verificador ERP ↔ PLM: confere se o `stage` das OPs no Use Moda corresponde
 * ao setor atual da OP no ERP Usesoft (tabela indpcpst).
 *
 * Read-only no ERP. As atualizações acontecem apenas no PLM (production_orders.stage)
 * e somente quando o usuário aciona `applyErpSectorSync`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  expediçao: "entregue",
  expedição: "entregue",
};

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function mapSectorToStage(sectorName: string | null | undefined): Stage | null {
  if (!sectorName) return null;
  const k = normalize(sectorName);
  return STAGE_BY_SECTOR[k] ?? null;
}

function extractErpPedidoId(notes: string | null): number | null {
  if (!notes) return null;
  const m = notes.match(/\[erp:pedido:(\d+)/i);
  return m ? Number(m[1]) : null;
}

export type SyncRow = {
  order_id: string;
  code: string;
  plm_stage: Stage;
  erp_pedido_id: number | null;
  erp_sector_name: string | null;
  erp_stage: Stage | null;
  status: "ok" | "divergent" | "no_link" | "erp_missing" | "unmapped_sector";
  message: string;
};

export type VerifyResult = {
  checked_at: string;
  total: number;
  ok: number;
  divergent: number;
  no_link: number;
  erp_missing: number;
  unmapped: number;
  rows: SyncRow[];
};

export const verifyErpSectorSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VerifyResult> => {
    const { supabase, userId } = context;

    const { data: orders, error } = await supabase
      .from("production_orders")
      .select("id, code, stage, notes")
      .eq("owner_id", userId)
      .neq("status", "concluida")
      .neq("status", "cancelada");
    if (error) throw new Error(error.message);

    const rows: SyncRow[] = [];
    const linked: { row: SyncRow; pedidoId: number }[] = [];

    for (const o of orders ?? []) {
      const pedidoId = extractErpPedidoId(o.notes);
      const base: SyncRow = {
        order_id: o.id,
        code: o.code,
        plm_stage: o.stage as Stage,
        erp_pedido_id: pedidoId,
        erp_sector_name: null,
        erp_stage: null,
        status: "no_link",
        message: "OP sem vínculo com ERP nas notas (marcador [erp:pedido:N]).",
      };
      rows.push(base);
      if (pedidoId != null) linked.push({ row: base, pedidoId });
    }

    if (linked.length === 0) {
      return summarize(rows);
    }

    const pedidoIds = Array.from(new Set(linked.map((l) => l.pedidoId)));

    const { usesoftQuery } = await import("@/integrations/usesoft/client.server");

    type ErpRow = { nnumeropedid: number; cdescrisetin: string };
    let erpRows: ErpRow[] = [];
    try {
      const r = await usesoftQuery<ErpRow>(
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
        SELECT r.nnumeropedid, s.cdescrisetin
          FROM ranked r
          JOIN indsetin s ON s.nnumerosetin = r.nnumerosetin
         WHERE r.rn = 1
        `,
        [pedidoIds],
      );
      erpRows = r.rows;
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      // Marca todas as linkadas como erro de leitura ERP
      for (const { row } of linked) {
        row.status = "erp_missing";
        row.message = `Falha ao ler ERP: ${msg}`;
      }
      return summarize(rows);
    }

    const erpByPedido = new Map<number, string>();
    for (const er of erpRows) erpByPedido.set(Number(er.nnumeropedid), er.cdescrisetin);

    for (const { row, pedidoId } of linked) {
      const sectorName = erpByPedido.get(pedidoId) ?? null;
      row.erp_sector_name = sectorName;
      if (!sectorName) {
        row.status = "erp_missing";
        row.message = `ERP pedido ${pedidoId}: sem setor atual (todas finalizadas ou sem entrada).`;
        continue;
      }
      const erpStage = mapSectorToStage(sectorName);
      row.erp_stage = erpStage;
      if (!erpStage) {
        row.status = "unmapped_sector";
        row.message = `Setor ERP "${sectorName}" não mapeado para nenhum stage do PLM.`;
        continue;
      }
      if (erpStage === row.plm_stage) {
        row.status = "ok";
        row.message = `Em sincronia (${sectorName}).`;
      } else {
        row.status = "divergent";
        row.message = `PLM em "${row.plm_stage}" mas ERP em "${sectorName}" (${erpStage}).`;
      }
    }

    return summarize(rows);
  });

function summarize(rows: SyncRow[]): VerifyResult {
  return {
    checked_at: new Date().toISOString(),
    total: rows.length,
    ok: rows.filter((r) => r.status === "ok").length,
    divergent: rows.filter((r) => r.status === "divergent").length,
    no_link: rows.filter((r) => r.status === "no_link").length,
    erp_missing: rows.filter((r) => r.status === "erp_missing").length,
    unmapped: rows.filter((r) => r.status === "unmapped_sector").length,
    rows,
  };
}

const ApplyInput = z.object({
  order_ids: z.array(z.string().uuid()).min(1).max(500),
});

export const applyErpSectorSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ApplyInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const verify = await verifyErpSectorSync();
    const targets = new Map<string, Stage>();
    for (const r of verify.rows) {
      if (r.status === "divergent" && r.erp_stage && data.order_ids.includes(r.order_id)) {
        targets.set(r.order_id, r.erp_stage);
      }
    }
    let updated = 0;
    for (const [id, stage] of targets) {
      const { error } = await supabase
        .from("production_orders")
        .update({ stage })
        .eq("id", id)
        .eq("owner_id", userId);
      if (!error) updated++;
    }
    return { updated, requested: data.order_ids.length };
  });
