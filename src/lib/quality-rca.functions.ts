import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SupplierDefectRow = {
  supplier_id: string;
  supplier_name: string;
  total_inspections: number;
  failed: number;
  fpy: number;
  critical: number;
  major: number;
  minor: number;
  recurring_top_defect: string | null;
  reason: string;
};

/**
 * Ranking de fornecedores × reincidência de defeitos.
 * Considera inspeções dos últimos 90 dias, exige ao menos 3 inspeções p/ entrar.
 * Ordenado pelo "risco": críticos primeiro, depois FPY mais baixo.
 */
export const getSupplierDefectRanking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SupplierDefectRow[]> => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - 90 * 86_400_000).toISOString();

    const { data: insps, error } = await supabase
      .from("quality_inspections")
      .select(
        "id, supplier_id, result, critical_defects, major_defects, minor_defects, defect_categories, created_at",
      )
      .eq("owner_id", userId)
      .gte("created_at", since)
      .not("supplier_id", "is", null);
    if (error) throw error;

    const supplierIds = Array.from(new Set((insps ?? []).map((i) => i.supplier_id as string)));
    if (supplierIds.length === 0) return [];

    const { data: suppliers } = await supabase
      .from("suppliers")
      .select("id, name")
      .in("id", supplierIds);
    const supplierName = new Map((suppliers ?? []).map((s) => [s.id, s.name as string]));

    const agg = new Map<
      string,
      {
        total: number;
        failed: number;
        critical: number;
        major: number;
        minor: number;
        defects: Map<string, number>;
      }
    >();

    for (const i of insps ?? []) {
      const sid = i.supplier_id as string;
      const a = agg.get(sid) ?? {
        total: 0,
        failed: 0,
        critical: 0,
        major: 0,
        minor: 0,
        defects: new Map<string, number>(),
      };
      a.total += 1;
      if (i.result === "reprovado" || i.result === "reprovada") a.failed += 1;
      a.critical += Number(i.critical_defects ?? 0);
      a.major += Number(i.major_defects ?? 0);
      a.minor += Number(i.minor_defects ?? 0);
      const cats = (i.defect_categories ?? []) as string[] | null;
      for (const d of cats ?? []) {
        a.defects.set(d, (a.defects.get(d) ?? 0) + 1);
      }
      agg.set(sid, a);
    }

    const rows: SupplierDefectRow[] = [];
    for (const [sid, a] of agg.entries()) {
      if (a.total < 3) continue;
      const fpy = ((a.total - a.failed) / a.total) * 100;
      let topDefect: string | null = null;
      let topCount = 0;
      for (const [d, c] of a.defects.entries()) {
        if (c > topCount) {
          topDefect = d;
          topCount = c;
        }
      }
      const reasonParts: string[] = [];
      if (a.critical > 0) reasonParts.push(`${a.critical} crítico${a.critical > 1 ? "s" : ""}`);
      if (fpy < 90) reasonParts.push(`FPY ${Math.round(fpy)}%`);
      if (topDefect && topCount >= 2)
        reasonParts.push(`reincidência em "${topDefect}" (${topCount}×)`);
      const reason =
        reasonParts.length > 0
          ? reasonParts.join(" · ")
          : `${a.total} inspeções, sem padrão recorrente`;

      rows.push({
        supplier_id: sid,
        supplier_name: supplierName.get(sid) ?? "—",
        total_inspections: a.total,
        failed: a.failed,
        fpy: Math.round(fpy * 10) / 10,
        critical: a.critical,
        major: a.major,
        minor: a.minor,
        recurring_top_defect: topCount >= 2 ? topDefect : null,
        reason,
      });
    }

    rows.sort((x, y) => {
      if (y.critical !== x.critical) return y.critical - x.critical;
      return x.fpy - y.fpy;
    });
    return rows.slice(0, 20);
  });
