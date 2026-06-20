import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type FpyRow = {
  supplierId: string;
  supplierName: string;
  total: number;
  approved: number;
  rejected: number;
  fpy: number; // %
  criticalDefects: number;
  majorDefects: number;
  status: "verde" | "amarelo" | "vermelho";
};

export type RecurrencePattern = {
  key: string;
  supplierId: string | null;
  supplierName: string;
  inspectionType: string;
  occurrences: number;
  lastAt: string;
  hasPreventive: boolean; // already has open CAPA with preventive_action filled
  suggestedPreventive: string;
};

export type FpyAnalysis = {
  windowDays: number;
  totalInspections: number;
  globalFpy: number;
  bySupplier: FpyRow[];
  recurrences: RecurrencePattern[];
};

export const getFpyAnalysis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FpyAnalysis> => {
    const sb = context.supabase;
    const WINDOW = 90;
    const since = new Date(Date.now() - WINDOW * 86400000).toISOString();

    const [{ data: insps }, { data: suppliers }, { data: capas }] = await Promise.all([
      sb
        .from("quality_inspections")
        .select(
          "id, supplier_id, result, inspection_type, critical_defects, major_defects, inspected_at, created_at",
        )
        .gte("inspected_at", since),
      sb.from("suppliers").select("id, name"),
      sb
        .from("quality_capa")
        .select("supplier_id, title, preventive_action, status")
        .in("status", ["aberta", "em_andamento"]),
    ]);

    type Insp = {
      supplier_id: string | null;
      result: string;
      inspection_type: string;
      critical_defects: number | null;
      major_defects: number | null;
      inspected_at: string;
    };
    type Sup = { id: string; name: string };

    const supMap = new Map(((suppliers ?? []) as Sup[]).map((s) => [s.id, s.name]));

    const bySup = new Map<
      string,
      { total: number; approved: number; rejected: number; crit: number; maj: number }
    >();
    const recAgg = new Map<
      string,
      { sid: string | null; type: string; count: number; lastAt: string }
    >();

    ((insps ?? []) as Insp[]).forEach((i) => {
      const sid = i.supplier_id ?? "_sem_fornecedor";
      const a = bySup.get(sid) ?? { total: 0, approved: 0, rejected: 0, crit: 0, maj: 0 };
      a.total += 1;
      const isReject = i.result === "reprovado" || i.result === "reprovada";
      if (isReject) a.rejected += 1;
      else if (i.result === "aprovado" || i.result === "aprovada") a.approved += 1;
      a.crit += Number(i.critical_defects ?? 0);
      a.maj += Number(i.major_defects ?? 0);
      bySup.set(sid, a);

      if (isReject) {
        const key = `${sid}::${i.inspection_type}`;
        const r = recAgg.get(key) ?? {
          sid: i.supplier_id,
          type: i.inspection_type,
          count: 0,
          lastAt: i.inspected_at,
        };
        r.count += 1;
        if (i.inspected_at > r.lastAt) r.lastAt = i.inspected_at;
        recAgg.set(key, r);
      }
    });

    const preventiveBySup = new Set<string>();
    ((capas ?? []) as { supplier_id: string | null; preventive_action: string | null }[]).forEach(
      (c) => {
        if (c.supplier_id && c.preventive_action && c.preventive_action.trim().length > 5) {
          preventiveBySup.add(c.supplier_id);
        }
      },
    );

    const bySupplier: FpyRow[] = [];
    bySup.forEach((a, sid) => {
      const fpy = a.total ? (a.approved / a.total) * 100 : 0;
      const status: FpyRow["status"] = fpy >= 95 ? "verde" : fpy >= 85 ? "amarelo" : "vermelho";
      bySupplier.push({
        supplierId: sid,
        supplierName: sid === "_sem_fornecedor" ? "Sem fornecedor" : (supMap.get(sid) ?? "—"),
        total: a.total,
        approved: a.approved,
        rejected: a.rejected,
        fpy,
        criticalDefects: a.crit,
        majorDefects: a.maj,
        status,
      });
    });
    bySupplier.sort((a, b) => a.fpy - b.fpy);

    const recurrences: RecurrencePattern[] = [];
    recAgg.forEach((r, key) => {
      if (r.count < 3) return;
      recurrences.push({
        key,
        supplierId: r.sid,
        supplierName: r.sid ? (supMap.get(r.sid) ?? "—") : "Sem fornecedor",
        inspectionType: r.type,
        occurrences: r.count,
        lastAt: r.lastAt,
        hasPreventive: r.sid ? preventiveBySup.has(r.sid) : false,
        suggestedPreventive: buildSuggestion(r.type, r.count),
      });
    });
    recurrences.sort((a, b) => b.occurrences - a.occurrences);

    const totalInsp = (insps ?? []).length;
    const totalApproved = ((insps ?? []) as Insp[]).filter(
      (i) => i.result === "aprovado" || i.result === "aprovada",
    ).length;
    const globalFpy = totalInsp ? (totalApproved / totalInsp) * 100 : 0;

    return {
      windowDays: WINDOW,
      totalInspections: totalInsp,
      globalFpy,
      bySupplier,
      recurrences,
    };
  });

function buildSuggestion(type: string, count: number): string {
  const base = `${count} reprovações recorrentes em ${type}`;
  switch (type) {
    case "corte":
      return `${base}. Ação preventiva: revisar enfesto/encaixe, calibrar máquina de corte, treinar operador.`;
    case "costura":
      return `${base}. Ação preventiva: revisar ficha de operações, padronizar tensão de linha, retreinar célula.`;
    case "acabamento":
      return `${base}. Ação preventiva: checklist de acabamento + auditoria por amostragem reforçada.`;
    case "recebimento_mp":
    case "materia_prima":
      return `${base}. Ação preventiva: requalificar fornecedor de MP, AQL mais rigoroso na próxima entrada.`;
    default:
      return `${base}. Ação preventiva: análise 5-porquês e plano de mitigação documentado.`;
  }
}

export const createPreventiveCapa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { supplierId: string; inspectionType: string; suggestion: string }) =>
    z
      .object({
        supplierId: z.string().min(1),
        inspectionType: z.string().min(1),
        suggestion: z.string().min(5),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const marker = `[preventive:${data.supplierId}:${data.inspectionType}]`;

    const { data: existing } = await sb
      .from("quality_capa")
      .select("id")
      .eq("supplier_id", data.supplierId)
      .ilike("problem", `%${marker}%`)
      .in("status", ["aberta", "em_andamento"])
      .limit(1);
    if (existing && existing.length > 0) {
      return { ok: true, alreadyExists: true, id: existing[0].id };
    }

    const due = new Date();
    due.setDate(due.getDate() + 14);

    const { data: inserted, error } = await sb
      .from("quality_capa")
      .insert({
        owner_id: context.userId,
        supplier_id: data.supplierId,
        title: `CAPA preventiva · Recorrência em ${data.inspectionType}`,
        problem: `Reprovações recorrentes detectadas automaticamente. ${marker}`,
        preventive_action: data.suggestion,
        severity: "media",
        status: "aberta",
        due_date: due.toISOString().slice(0, 10),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, alreadyExists: false, id: inserted.id };
  });
