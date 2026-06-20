/**
 * PCP Avançado: Split de lotes (pai/filho) e Eficiência por SAM real.
 *
 * Split: divide uma OP em sub-OPs (ex.: 1.000 pç → 600 facção A + 400 facção B),
 *   preservando produto/coleção/prazo e mantendo o vínculo `parent_order_id`.
 *
 * SAM Efficiency: compara minutos planejados (SAM × qtd produzida) com minutos
 *   reais de produção (tempo entre primeiro e último movimento de etapa).
 *   Indica gargalo real por OP e por produto.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// SPLIT DE LOTES
// ─────────────────────────────────────────────────────────────────────────────

const splitSchema = z.object({
  orderId: z.string().uuid(),
  splits: z
    .array(
      z.object({
        quantity: z.number().int().positive(),
        supplierId: z.string().uuid().nullable().optional(),
        dueDate: z.string().nullable().optional(),
        notes: z.string().optional(),
      }),
    )
    .min(1)
    .max(10),
});

export type SplitInput = z.infer<typeof splitSchema>;

export const splitProductionOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: SplitInput) => splitSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: parent, error: pErr } = await supabase
      .from("production_orders")
      .select("id, owner_id, product_id, supplier_id, code, quantity, due_date, priority, notes, stage")
      .eq("id", data.orderId)
      .single();
    if (pErr || !parent) throw new Error("OP-pai não encontrada");
    if (parent.owner_id !== userId) throw new Error("Sem permissão");

    const totalSplit = data.splits.reduce((s, x) => s + x.quantity, 0);
    if (totalSplit > (parent.quantity ?? 0)) {
      throw new Error(
        `Soma dos lotes (${totalSplit}) excede a quantidade da OP-pai (${parent.quantity}).`,
      );
    }

    const baseCode = parent.code ?? `OP-${parent.id.slice(0, 6)}`;
    const created: string[] = [];

    for (let i = 0; i < data.splits.length; i++) {
      const s = data.splits[i];
      const childCode = `${baseCode}.${i + 1}`;
      const { data: row, error } = await supabase
        .from("production_orders")
        .insert({
          owner_id: userId,
          parent_order_id: parent.id,
          product_id: parent.product_id,
          supplier_id: s.supplierId ?? parent.supplier_id,
          code: childCode,
          quantity: s.quantity,
          status: "aguardando",
          stage: parent.stage,
          due_date: s.dueDate ?? parent.due_date,
          priority: parent.priority,
          notes:
            (s.notes ? s.notes + " " : "") +
            `[split-de:${parent.id}] Lote filho de ${baseCode}`,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      created.push(row!.id);
    }

    // Marca a OP-pai como umbrella (não some, vira "guarda-chuva" do split)
    await supabase
      .from("production_orders")
      .update({
        notes:
          (parent.notes ? parent.notes + "\n" : "") +
          `[split:${data.splits.length} sub-OPs · ${totalSplit}/${parent.quantity} pç]`,
      })
      .eq("id", parent.id);

    return { parentId: parent.id, childIds: created, totalSplit };
  });

// ─────────────────────────────────────────────────────────────────────────────
// SAM EFFICIENCY (real por OP)
// ─────────────────────────────────────────────────────────────────────────────

export type OpSamEfficiency = {
  orderId: string;
  code: string;
  productName: string | null;
  quantity: number;
  producedQty: number;
  samPerPiece: number;
  plannedMinutes: number;
  elapsedMinutes: number;
  efficiencyPct: number; // planned / elapsed (>100% = mais rápido que padrão)
  status: "ok" | "abaixo" | "critico" | "sem_sam" | "em_curso";
  hint: string;
};

export type SamEfficiencyReport = {
  orders: OpSamEfficiency[];
  insights: string[];
  windowDays: number;
};

export const getSamEfficiency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { days?: number }) => z.object({ days: z.number().int().min(7).max(180).default(30) }).parse(i))
  .handler(async ({ data, context }): Promise<SamEfficiencyReport> => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - data.days * 86400000).toISOString();

    // OPs ativas/concluídas na janela
    const { data: orders } = await supabase
      .from("production_orders")
      .select("id, code, quantity, progress, product_id, status, stage, created_at, products(name)")
      .eq("owner_id", userId)
      .gte("created_at", since);

    if (!orders?.length) {
      return { orders: [], insights: ["Sem OPs na janela analisada."], windowDays: data.days };
    }

    const productIds = Array.from(new Set(orders.map((o) => o.product_id).filter(Boolean) as string[]));

    // Ficha técnica aprovada por produto → soma de SAM das operações
    const { data: sheets } = productIds.length
      ? await supabase
          .from("tech_sheets")
          .select("id, product_id, status")
          .in("product_id", productIds)
          .eq("status", "aprovada")
      : { data: [] as { id: string; product_id: string | null }[] };

    const sheetIds = (sheets ?? []).map((s) => s.id);
    const { data: ops } = sheetIds.length
      ? await supabase
          .from("tech_sheet_operations")
          .select("tech_sheet_id, sam")
          .in("tech_sheet_id", sheetIds)
      : { data: [] as { tech_sheet_id: string; sam: number | null }[] };

    const samByProduct = new Map<string, number>();
    const sheetToProduct = new Map<string, string>();
    (sheets ?? []).forEach((s) => {
      if (s.product_id) sheetToProduct.set(s.id, s.product_id);
    });
    (ops ?? []).forEach((o) => {
      const pid = sheetToProduct.get(o.tech_sheet_id);
      if (!pid) return;
      samByProduct.set(pid, (samByProduct.get(pid) ?? 0) + Number(o.sam ?? 0));
    });

    // Logs de transição por OP
    const orderIds = orders.map((o) => o.id);
    const { data: logs } = await supabase
      .from("production_stage_log")
      .select("order_id, created_at, quantity")
      .in("order_id", orderIds)
      .order("created_at", { ascending: true });

    type LogRow = { order_id: string | null; created_at: string; quantity: number | null };
    const byOrder = new Map<string, LogRow[]>();
    ((logs ?? []) as LogRow[]).forEach((l) => {
      if (!l.order_id) return;
      const arr = byOrder.get(l.order_id) ?? [];
      arr.push(l);
      byOrder.set(l.order_id, arr);
    });

    const rows: OpSamEfficiency[] = orders.map((o) => {
      const sam = o.product_id ? (samByProduct.get(o.product_id) ?? 0) : 0;
      const qty = Number(o.quantity ?? 0);
      const progress = Number(o.progress ?? 0);
      const producedQty = Math.round((qty * progress) / 100);
      const logsOf = byOrder.get(o.id) ?? [];

      let elapsedMin = 0;
      if (logsOf.length >= 2) {
        const first = new Date(logsOf[0].created_at).getTime();
        const last = new Date(logsOf[logsOf.length - 1].created_at).getTime();
        elapsedMin = Math.max(1, (last - first) / 60000);
      }

      const plannedMin = sam * producedQty;
      const eff = elapsedMin > 0 && plannedMin > 0 ? (plannedMin / elapsedMin) * 100 : 0;

      let status: OpSamEfficiency["status"];
      let hint: string;
      if (sam === 0) {
        status = "sem_sam";
        hint = "Sem SAM cadastrado na ficha técnica — impossível calcular eficiência.";
      } else if (producedQty === 0) {
        status = "em_curso";
        hint = "OP ainda não iniciou apontamento.";
      } else if (eff === 0) {
        status = "em_curso";
        hint = "Aguardando segundo apontamento para calcular tempo decorrido.";
      } else if (eff < 50) {
        status = "critico";
        hint = `Tempo real ${Math.round(100 / eff * 100) / 100}× o padrão — investigar parada, retrabalho ou SAM desatualizado.`;
      } else if (eff < 80) {
        status = "abaixo";
        hint = `Operando a ${Math.round(eff)}% do padrão SAM — verificar gargalo na célula.`;
      } else {
        status = "ok";
        hint = `Dentro do padrão (${Math.round(eff)}% SAM).`;
      }

      return {
        orderId: o.id,
        code: o.code ?? "—",
        productName: o.products?.name ?? null,
        quantity: qty,
        producedQty,
        samPerPiece: Math.round(sam * 100) / 100,
        plannedMinutes: Math.round(plannedMin),
        elapsedMinutes: Math.round(elapsedMin),
        efficiencyPct: Math.round(eff),
        status,
        hint,
      };
    });

    rows.sort((a, b) => {
      const order = { critico: 0, abaixo: 1, em_curso: 2, sem_sam: 3, ok: 4 } as const;
      return order[a.status] - order[b.status];
    });

    const insights: string[] = [];
    const crit = rows.filter((r) => r.status === "critico").length;
    const ab = rows.filter((r) => r.status === "abaixo").length;
    const semSam = rows.filter((r) => r.status === "sem_sam").length;
    if (crit) insights.push(`${crit} OP(s) em estado crítico — tempo real >2× o padrão SAM.`);
    if (ab) insights.push(`${ab} OP(s) abaixo do padrão (50–80%) — revisar célula e setups.`);
    if (semSam) insights.push(`${semSam} OP(s) sem SAM na ficha — impossível medir eficiência. Cadastrar tempos por operação.`);
    if (!insights.length && rows.length) insights.push("Todas as OPs com SAM cadastrado estão operando dentro do padrão.");

    return { orders: rows, insights, windowDays: data.days };
  });
