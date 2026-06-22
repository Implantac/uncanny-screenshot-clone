import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildAiReason } from "@/lib/ai-reason";

/**
 * Drawer 360° de Facção — KPIs consolidados de um fornecedor:
 *  - lead time real (média + p90 em dias), entregas no prazo
 *  - FPY (qualidade), defeitos críticos, ocorrências abertas
 *  - capacidade contratada × demanda em curso (utilização)
 *  - certificações vigentes / vencidas
 *  - OPs ativas, top defeitos, histórico recente
 *
 * Janela de análise: últimos 90 dias por padrão.
 */

const Input = z.object({
  supplier_id: z.string().uuid(),
  window_days: z.number().int().min(7).max(365).optional(),
});

type OrderRow = {
  id: string;
  code: string;
  product_id: string | null;
  quantity: number | null;
  due_date: string | null;
  stage: string | null;
  status: string | null;
  priority: number | null;
  started_at: string | null;
  updated_at: string;
  stage_updated_at: string | null;
  notes: string | null;
};

const TERMINAL = new Set(["entregue"]);
const ACTIVE = new Set(["aguardando", "em_producao", "atrasada"]);

export const getSupplier360 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const sinceMs = Date.now() - (data.window_days ?? 90) * 86_400_000;
    const sinceIso = new Date(sinceMs).toISOString();

    const [
      { data: supplier },
      { data: capacity },
      { data: capabilities },
      { data: compliance },
      { data: orders },
      { data: inspections },
      { data: occurrences },
    ] = await Promise.all([
      supabase
        .from("suppliers")
        .select("id, name, category, contact_name, email, phone, city, state, rating, lead_time_days, active, notes")
        .eq("id", data.supplier_id)
        .eq("owner_id", userId)
        .maybeSingle(),
      supabase
        .from("supplier_capacity")
        .select("pieces_per_day, working_days_per_week, notes")
        .eq("supplier_id", data.supplier_id)
        .eq("owner_id", userId)
        .maybeSingle(),
      supabase
        .from("supplier_capabilities")
        .select("capability, monthly_capacity, notes")
        .eq("supplier_id", data.supplier_id)
        .eq("owner_id", userId),
      supabase
        .from("supplier_compliance")
        .select("cert_type, cert_number, issued_at, expires_at, issuer, attachment_url")
        .eq("supplier_id", data.supplier_id)
        .eq("owner_id", userId),
      supabase
        .from("production_orders")
        .select(
          "id, code, product_id, quantity, due_date, stage, status, priority, started_at, updated_at, stage_updated_at, notes",
        )
        .eq("supplier_id", data.supplier_id)
        .eq("owner_id", userId)
        .gte("updated_at", sinceIso)
        .order("updated_at", { ascending: false }),
      supabase
        .from("quality_inspections")
        .select(
          "id, created_at, result, inspection_type, critical_defects, major_defects, minor_defects, defect_categories, production_order_id",
        )
        .eq("supplier_id", data.supplier_id)
        .eq("owner_id", userId)
        .gte("created_at", sinceIso),
      supabase
        .from("production_occurrences")
        .select("id, created_at, kind, status, description, affected_qty, order_id")
        .eq("owner_id", userId)
        .gte("created_at", sinceIso),
    ]);

    if (!supplier) throw new Error("Fornecedor não encontrado.");

    const ordersAll = (orders ?? []) as OrderRow[];
    const ordersActive = ordersAll.filter((o) => ACTIVE.has(o.status ?? ""));
    const ordersDone = ordersAll.filter((o) => o.status === "entregue" || TERMINAL.has(o.stage ?? ""));

    // Lead time real: started_at → updated_at em OPs concluídas
    const leadDays = ordersDone
      .map((o) => {
        if (!o.started_at) return null;
        const d = (new Date(o.updated_at).getTime() - new Date(o.started_at).getTime()) / 86_400_000;
        return d > 0 ? d : null;
      })
      .filter((x): x is number => x !== null)
      .sort((a, b) => a - b);
    const leadAvg = leadDays.length ? leadDays.reduce((s, x) => s + x, 0) / leadDays.length : null;
    const leadP90 = leadDays.length ? leadDays[Math.min(leadDays.length - 1, Math.floor(leadDays.length * 0.9))] : null;

    // On-time: due_date >= updated_at em entregues
    const onTimeBase = ordersDone.filter((o) => o.due_date);
    const onTime = onTimeBase.filter(
      (o) => new Date(o.updated_at).getTime() <= new Date(o.due_date!).getTime() + 86_400_000,
    );
    const onTimePct = onTimeBase.length ? Math.round((onTime.length / onTimeBase.length) * 100) : null;

    // FPY
    const insp = inspections ?? [];
    const fpyTotal = insp.length;
    const fpyApproved = insp.filter((i) => i.result === "aprovado" || i.result === "aprovada").length;
    const fpy = fpyTotal ? Math.round((fpyApproved / fpyTotal) * 100) : null;
    const criticalDefects = insp.reduce((s, i) => s + (i.critical_defects ?? 0), 0);
    const majorDefects = insp.reduce((s, i) => s + (i.major_defects ?? 0), 0);

    // Top defeitos
    const defectCount: Record<string, number> = {};
    for (const i of insp) {
      const cats = (i.defect_categories ?? []) as string[];
      for (const c of cats) defectCount[c] = (defectCount[c] ?? 0) + 1;
    }
    const topDefects = Object.entries(defectCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));

    // Ocorrências ligadas via OPs do fornecedor
    const opIds = new Set(ordersAll.map((o) => o.id));
    const supplierOccs = (occurrences ?? []).filter((o) => o.order_id && opIds.has(o.order_id));
    const occOpen = supplierOccs.filter((o) => o.status === "aberta").length;

    // Capacidade contratada vs demanda em curso
    const piecesPerDay = capacity?.pieces_per_day ?? null;
    const workingDays = capacity?.working_days_per_week ?? 5;
    const monthlyCapacity = piecesPerDay ? piecesPerDay * Math.round((workingDays / 7) * 30) : null;
    const inProgressQty = ordersActive.reduce((s, o) => s + (o.quantity ?? 0), 0);
    const utilizationPct = monthlyCapacity && monthlyCapacity > 0
      ? Math.round((inProgressQty / monthlyCapacity) * 100) : null;

    // Compliance
    const now = Date.now();
    const certs = (compliance ?? []).map((c) => {
      const expired = c.expires_at ? new Date(c.expires_at).getTime() < now : false;
      const expiringSoon = c.expires_at
        ? !expired && new Date(c.expires_at).getTime() - now < 30 * 86_400_000
        : false;
      return { ...c, expired, expiring_soon: expiringSoon };
    });
    const expiredCount = certs.filter((c) => c.expired).length;

    // Score composto 0-100 (transparente)
    const fpyScore = fpy ?? 70; // default neutro
    const otScore = onTimePct ?? 70;
    const occScore = Math.max(0, 100 - occOpen * 15);
    const certScore = expiredCount > 0 ? 50 : 100;
    const score = Math.round(fpyScore * 0.4 + otScore * 0.35 + occScore * 0.15 + certScore * 0.1);

    // Health
    const health: "saudavel" | "atencao" | "critico" =
      score >= 80 ? "saudavel" : score >= 60 ? "atencao" : "critico";

    // IA reason
    const signals: string[] = [];
    if (fpy !== null && fpy < 85) signals.push(`FPY ${fpy}%`);
    if (onTimePct !== null && onTimePct < 80) signals.push(`pontualidade ${onTimePct}%`);
    if (utilizationPct !== null && utilizationPct > 95) signals.push(`utilização ${utilizationPct}%`);
    if (occOpen) signals.push(`${occOpen} ocorrência${occOpen > 1 ? "s" : ""} aberta${occOpen > 1 ? "s" : ""}`);
    if (expiredCount) signals.push(`${expiredCount} certificação${expiredCount > 1 ? "ões" : ""} vencida${expiredCount > 1 ? "s" : ""}`);
    if (topDefects[0]) signals.push(`defeito recorrente: ${topDefects[0].category}`);
    const recommendation =
      health === "critico" ? "abrir CAPA e reduzir alocação até estabilizar" :
      health === "atencao" ? "monitorar próximas OPs e revisar plano de ação" :
      utilizationPct !== null && utilizationPct > 95 ? "balancear carga com outra facção" :
      null;

    const reason = buildAiReason({
      signals,
      recommendation,
      fallback: "performance estável no período",
    });

    // Produtos relacionados (top 5 por volume)
    const productCount: Record<string, number> = {};
    for (const o of ordersAll) {
      if (!o.product_id) continue;
      productCount[o.product_id] = (productCount[o.product_id] ?? 0) + (o.quantity ?? 0);
    }
    const topProductIds = Object.entries(productCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);
    const productMap: Record<string, { name: string | null; sku: string | null }> = {};
    if (topProductIds.length) {
      const { data: prods } = await supabase
        .from("products")
        .select("id, name, sku")
        .in("id", topProductIds);
      for (const p of prods ?? []) productMap[p.id] = { name: p.name, sku: p.sku };
    }
    const topProducts = topProductIds.map((id) => ({
      id,
      name: productMap[id]?.name ?? null,
      sku: productMap[id]?.sku ?? null,
      quantity: productCount[id],
    }));

    return {
      supplier,
      window_days: data.window_days ?? 90,
      kpis: {
        score,
        health,
        fpy,
        critical_defects: criticalDefects,
        major_defects: majorDefects,
        on_time_pct: onTimePct,
        lead_time_avg_days: leadAvg !== null ? Math.round(leadAvg * 10) / 10 : null,
        lead_time_p90_days: leadP90 !== null ? Math.round(leadP90 * 10) / 10 : null,
        contracted_lead_time_days: supplier.lead_time_days,
        utilization_pct: utilizationPct,
        monthly_capacity: monthlyCapacity,
        pieces_per_day: piecesPerDay,
        in_progress_qty: inProgressQty,
        orders_active_count: ordersActive.length,
        orders_done_count: ordersDone.length,
        inspections_count: fpyTotal,
        occurrences_open: occOpen,
        occurrences_total: supplierOccs.length,
        certifications_expired: expiredCount,
      },
      reason,
      top_defects: topDefects,
      top_products: topProducts,
      capabilities: capabilities ?? [],
      compliance: certs,
      orders_active: ordersActive.slice(0, 20).map((o) => ({
        id: o.id,
        code: o.code,
        product_id: o.product_id,
        quantity: o.quantity,
        due_date: o.due_date,
        stage: o.stage,
        priority: o.priority,
        stage_updated_at: o.stage_updated_at,
        days_to_due: o.due_date
          ? Math.ceil((new Date(o.due_date).getTime() - Date.now()) / 86_400_000)
          : null,
      })),
      orders_recent: ordersDone.slice(0, 10).map((o) => ({
        id: o.id,
        code: o.code,
        quantity: o.quantity,
        due_date: o.due_date,
        delivered_at: o.updated_at,
        on_time: o.due_date
          ? new Date(o.updated_at).getTime() <= new Date(o.due_date).getTime() + 86_400_000
          : null,
      })),
      occurrences_recent: supplierOccs.slice(0, 10).map((o) => ({
        id: o.id,
        kind: o.kind,
        status: o.status,
        description: o.description,
        created_at: o.created_at,
        order_id: o.order_id,
      })),
    };
  });

export type Supplier360 = Awaited<ReturnType<typeof getSupplier360>>;
