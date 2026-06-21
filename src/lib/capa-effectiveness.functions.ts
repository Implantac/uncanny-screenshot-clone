import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CAPAEffectivenessRow = {
  capa_id: string;
  title: string;
  supplier_id: string | null;
  supplier_name: string | null;
  closed_at: string;
  due_check_at: string;
  reincidencias: number;
  status_efetividade: "efetiva" | "reincidente" | "em-verificacao";
};

export type CAPAEffectivenessReport = {
  window_days: number;
  total_fechadas: number;
  efetivas: number;
  reincidentes: number;
  em_verificacao: number;
  efetividade_pct: number;
  por_fornecedor: Array<{
    supplier_id: string;
    supplier_name: string;
    total: number;
    efetivas: number;
    reincidentes: number;
    efetividade_pct: number;
  }>;
  rows: CAPAEffectivenessRow[];
};

const WINDOW_RECHECK_DAYS = 60;

export const getCAPAEffectiveness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CAPAEffectivenessReport> => {
    const { supabase } = context;
    const sinceClosed = new Date();
    sinceClosed.setDate(sinceClosed.getDate() - 120);

    const { data: capas, error } = await supabase
      .from("quality_capa")
      .select("id, title, supplier_id, closed_at")
      .eq("status", "fechada")
      .gte("closed_at", sinceClosed.toISOString())
      .order("closed_at", { ascending: false });
    if (error) throw error;

    const capaList = (capas ?? []).filter((c) => c.closed_at);
    const supplierIds = Array.from(
      new Set(capaList.map((c) => c.supplier_id).filter((v): v is string => !!v)),
    );

    const [{ data: suppliers }, { data: inspections }] = await Promise.all([
      supplierIds.length
        ? supabase.from("suppliers").select("id, name").in("id", supplierIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
      supplierIds.length
        ? supabase
            .from("quality_inspections")
            .select("id, supplier_id, result, inspected_at, created_at")
            .in("supplier_id", supplierIds)
            .in("result", ["reprovado", "reprovada"])
        : Promise.resolve({
            data: [] as Array<{
              id: string;
              supplier_id: string | null;
              result: string | null;
              inspected_at: string | null;
              created_at: string | null;
            }>,
          }),
    ]);
    const supMap = new Map((suppliers ?? []).map((s) => [s.id, s.name]));
    const inspBySup = new Map<string, Array<{ at: number }>>();
    (inspections ?? []).forEach((i) => {
      if (!i.supplier_id) return;
      const at = new Date(i.inspected_at ?? i.created_at ?? Date.now()).getTime();
      const arr = inspBySup.get(i.supplier_id) ?? [];
      arr.push({ at });
      inspBySup.set(i.supplier_id, arr);
    });

    const now = Date.now();
    const winMs = WINDOW_RECHECK_DAYS * 24 * 60 * 60 * 1000;

    const rows: CAPAEffectivenessRow[] = capaList.map((c) => {
      const closed = new Date(c.closed_at!).getTime();
      const due = closed + winMs;
      const sup = c.supplier_id;
      const reincid = sup
        ? (inspBySup.get(sup) ?? []).filter((r) => r.at > closed && r.at <= due).length
        : 0;
      let status: CAPAEffectivenessRow["status_efetividade"];
      if (due > now) status = "em-verificacao";
      else if (reincid > 0) status = "reincidente";
      else status = "efetiva";
      return {
        capa_id: c.id,
        title: c.title,
        supplier_id: sup,
        supplier_name: sup ? supMap.get(sup) ?? null : null,
        closed_at: c.closed_at!,
        due_check_at: new Date(due).toISOString(),
        reincidencias: reincid,
        status_efetividade: status,
      };
    });

    const total_fechadas = rows.length;
    const efetivas = rows.filter((r) => r.status_efetividade === "efetiva").length;
    const reincidentes = rows.filter((r) => r.status_efetividade === "reincidente").length;
    const em_verificacao = rows.filter((r) => r.status_efetividade === "em-verificacao").length;
    const denom = efetivas + reincidentes;
    const efetividade_pct = denom > 0 ? (efetivas / denom) * 100 : 0;

    const bySup = new Map<
      string,
      { total: number; efetivas: number; reincidentes: number; name: string }
    >();
    rows.forEach((r) => {
      if (!r.supplier_id || r.status_efetividade === "em-verificacao") return;
      const cur = bySup.get(r.supplier_id) ?? {
        total: 0,
        efetivas: 0,
        reincidentes: 0,
        name: r.supplier_name ?? "—",
      };
      cur.total += 1;
      if (r.status_efetividade === "efetiva") cur.efetivas += 1;
      else cur.reincidentes += 1;
      bySup.set(r.supplier_id, cur);
    });
    const por_fornecedor = Array.from(bySup.entries())
      .map(([supplier_id, v]) => ({
        supplier_id,
        supplier_name: v.name,
        total: v.total,
        efetivas: v.efetivas,
        reincidentes: v.reincidentes,
        efetividade_pct: v.total > 0 ? (v.efetivas / v.total) * 100 : 0,
      }))
      .sort((a, b) => a.efetividade_pct - b.efetividade_pct);

    return {
      window_days: WINDOW_RECHECK_DAYS,
      total_fechadas,
      efetivas,
      reincidentes,
      em_verificacao,
      efetividade_pct,
      rows,
      por_fornecedor,
    };
  });
