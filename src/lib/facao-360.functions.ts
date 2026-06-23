import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FaccaoKPIs = {
  supplierId: string;
  name: string;
  city: string | null;
  state: string | null;
  totalOS: number;
  openOS: number;
  inTransit: number;
  overdue: number;
  qtySent: number;
  qtyReceived: number;
  qtyLost: number;
  qtyDefect: number;
  lossPct: number;
  defectPct: number;
  avgLeadTimeDays: number | null;
  reason: string;
};

export const getFaccoes360 = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FaccaoKPIs[]> => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - 90 * 86400000).toISOString();
    const today = new Date().toISOString().slice(0, 10);

    const { data: os, error } = await supabase
      .from("service_orders")
      .select(
        "id, supplier_id, quantity, qty_received, qty_lost, qty_defect, status, sent_at, received_at, expected_return_date, due_at",
      )
      .eq("owner_id", userId)
      .gte("created_at", since);
    if (error) throw new Error(error.message);
    const list = os ?? [];
    const supplierIds = Array.from(
      new Set(list.map((o) => o.supplier_id).filter((v): v is string => !!v)),
    );
    if (supplierIds.length === 0) return [];

    const { data: sups } = await supabase
      .from("suppliers")
      .select("id, name, city, state")
      .in("id", supplierIds);
    const supMap = new Map((sups ?? []).map((s) => [s.id, s]));

    const byS = new Map<string, typeof list>();
    for (const o of list) {
      if (!o.supplier_id) continue;
      const arr = byS.get(o.supplier_id) ?? [];
      arr.push(o);
      byS.set(o.supplier_id, arr);
    }

    const out: FaccaoKPIs[] = [];
    for (const [sid, arr] of byS) {
      const sup = supMap.get(sid);
      if (!sup) continue;
      const qtySent = arr.reduce((s, o) => s + Number(o.quantity ?? 0), 0);
      const qtyReceived = arr.reduce((s, o) => s + Number(o.qty_received ?? 0), 0);
      const qtyLost = arr.reduce((s, o) => s + Number(o.qty_lost ?? 0), 0);
      const qtyDefect = arr.reduce((s, o) => s + Number(o.qty_defect ?? 0), 0);
      const openOS = arr.filter((o) => o.status !== "recebida" && o.status !== "cancelada").length;
      const inTransit = arr.filter((o) => o.sent_at && !o.received_at).length;
      const overdue = arr.filter(
        (o) =>
          (o.expected_return_date ?? o.due_at) &&
          (o.expected_return_date ?? o.due_at)! < today &&
          o.status !== "recebida" &&
          o.status !== "cancelada",
      ).length;
      const leadDays: number[] = [];
      for (const o of arr) {
        if (o.sent_at && o.received_at) {
          const d =
            (new Date(o.received_at).getTime() - new Date(o.sent_at).getTime()) / 86400000;
          if (d >= 0) leadDays.push(d);
        }
      }
      const avgLeadTimeDays =
        leadDays.length > 0
          ? Number((leadDays.reduce((a, b) => a + b, 0) / leadDays.length).toFixed(1))
          : null;
      const lossPct = qtySent > 0 ? Number(((qtyLost / qtySent) * 100).toFixed(1)) : 0;
      const defectPct =
        qtyReceived > 0 ? Number(((qtyDefect / qtyReceived) * 100).toFixed(1)) : 0;

      let reason = "Sem alertas relevantes nos últimos 90 dias.";
      if (overdue > 0) reason = `${overdue} OS atrasada(s) — cobrar retorno imediato.`;
      else if (lossPct > 3)
        reason = `Perda ${lossPct}% acima da média setorial (2–3%). Auditar corte.`;
      else if (defectPct > 5)
        reason = `Defeito ${defectPct}% — abrir CAPA e revisar treinamento.`;
      else if (avgLeadTimeDays && avgLeadTimeDays > 21)
        reason = `Lead time médio ${avgLeadTimeDays}d acima do esperado (≤21d).`;

      out.push({
        supplierId: sid,
        name: sup.name,
        city: sup.city,
        state: sup.state,
        totalOS: arr.length,
        openOS,
        inTransit,
        overdue,
        qtySent,
        qtyReceived,
        qtyLost,
        qtyDefect,
        lossPct,
        defectPct,
        avgLeadTimeDays,
        reason,
      });
    }

    // Ranking: pior primeiro (mais atrasadas, mais perda)
    out.sort((a, b) => {
      if (b.overdue !== a.overdue) return b.overdue - a.overdue;
      if (b.lossPct !== a.lossPct) return b.lossPct - a.lossPct;
      return b.defectPct - a.defectPct;
    });
    return out;
  });
