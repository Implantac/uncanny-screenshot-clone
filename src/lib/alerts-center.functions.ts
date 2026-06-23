import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Central de Alertas Inteligentes — Módulo 18.
 *
 * Inbox unificado que agrega sinais JÁ existentes em uma única visão,
 * sem duplicar fontes. Reusa: inventory_items, production_orders,
 * marketing_notifications, prototypes, quality_capa, alert_dismissals.
 *
 * Cada item tem severidade (critica|alta|media|baixa) e um "porquê"
 * curto para a IA contextual / leitura humana rápida.
 */

export type AlertSeverity = "critica" | "alta" | "media" | "baixa";

export type AlertCategory =
  | "estoque"
  | "atraso"
  | "parado"
  | "qualidade"
  | "proto"
  | "marketing";

export type CenterAlert = {
  key: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  detail: string;
  why: string;
  link: string;
  ts: string;
};

const sevWeight: Record<AlertSeverity, number> = {
  critica: 4,
  alta: 3,
  media: 2,
  baixa: 1,
};

export const getAlertsCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CenterAlert[]> => {
    const { supabase, userId } = context;
    const today = new Date().toISOString().slice(0, 10);
    const nowMs = Date.now();
    const oldProtoCutoff = new Date(nowMs - 7 * 86_400_000).toISOString();
    const stuckCutoff = new Date(nowMs - 86_400_000).toISOString();
    const sinceMkt = new Date(nowMs - 3 * 86_400_000).toISOString();

    const [
      { data: inv },
      { data: overdueOps },
      { data: stuckOps },
      { data: stages },
      { data: oldProtos },
      { data: capas },
      { data: mkt },
      { data: dism },
    ] = await Promise.all([
      supabase
        .from("inventory_items")
        .select("id, name, balance, minimum, unit")
        .eq("owner_id", userId),
      supabase
        .from("production_orders")
        .select("id, code, due_date, status, progress, updated_at")
        .eq("owner_id", userId)
        .neq("status", "concluida")
        .lte("due_date", today),
      supabase
        .from("production_orders")
        .select("id, code, stage, stage_updated_at")
        .eq("owner_id", userId)
        .neq("status", "concluida")
        .neq("stage", "entregue")
        .lt("stage_updated_at", stuckCutoff)
        .order("stage_updated_at", { ascending: true })
        .limit(50),
      supabase.from("pcp_stages").select("key, sla_stuck_days").eq("owner_id", userId),
      supabase
        .from("prototypes")
        .select("id, code, stage, updated_at")
        .eq("owner_id", userId)
        .not("stage", "in", "(aprovado,reprovado)")
        .lt("updated_at", oldProtoCutoff)
        .order("updated_at", { ascending: true })
        .limit(20),
      supabase
        .from("quality_capa")
        .select("id, title, severity, status, due_date, created_at")
        .eq("owner_id", userId)
        .neq("status", "fechada")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("marketing_notifications")
        .select("id, kind, title, body, link, created_at, read_at")
        .eq("owner_id", userId)
        .is("read_at", null)
        .gte("created_at", sinceMkt)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("alert_dismissals")
        .select("alert_key, dismissed_until, resolved")
        .eq("user_id", userId),
    ]);

    const slaByStage = new Map<string, number>(
      (stages ?? []).map((s) => [s.key as string, Number(s.sla_stuck_days ?? 3)]),
    );

    const dismissed = new Map(
      (dism ?? []).map((d) => [d.alert_key as string, d as { dismissed_until: string | null; resolved: boolean }]),
    );
    const isHidden = (key: string) => {
      const d = dismissed.get(key);
      if (!d) return false;
      if (d.resolved) return true;
      if (d.dismissed_until && new Date(d.dismissed_until).getTime() > nowMs) return true;
      return false;
    };

    const alerts: CenterAlert[] = [];

    // 1. Estoque crítico
    for (const i of inv ?? []) {
      const bal = Number(i.balance ?? 0);
      const min = Number(i.minimum ?? 0);
      if (min <= 0 || bal > min) continue;
      const key = `inv:${i.id}`;
      if (isHidden(key)) continue;
      const ratio = min > 0 ? bal / min : 1;
      const severity: AlertSeverity =
        bal <= 0 ? "critica" : ratio < 0.5 ? "alta" : "media";
      alerts.push({
        key,
        category: "estoque",
        severity,
        title: `${i.name} abaixo do mínimo`,
        detail: `Saldo ${bal} ${i.unit ?? ""} · mínimo ${min}`,
        why:
          bal <= 0
            ? "Item zerado — qualquer OP que precise dele para hoje vai parar."
            : "Saldo abaixo do ponto de ressuprimento — risco de ruptura nas próximas OPs.",
        link: "/almoxarifado",
        ts: new Date().toISOString(),
      });
    }

    // 2. OPs atrasadas
    for (const o of overdueOps ?? []) {
      const key = `op-overdue:${o.id}`;
      if (isHidden(key)) continue;
      const daysLate = Math.floor(
        (nowMs - new Date(o.due_date as string).getTime()) / 86_400_000,
      );
      const severity: AlertSeverity =
        daysLate >= 7 ? "critica" : daysLate >= 2 ? "alta" : "media";
      alerts.push({
        key,
        category: "atraso",
        severity,
        title: `OP ${o.code} atrasada ${daysLate}d`,
        detail: `Prazo ${o.due_date} · ${o.progress ?? 0}% concluído`,
        why: `Prazo estourou há ${daysLate} dia(s). Quanto mais tempo parada, maior o custo de atraso e quebra de SLA.`,
        link: "/pcp",
        ts: o.updated_at as string,
      });
    }

    // 3. OPs paradas (gargalo) — usa SLA por estágio
    for (const o of stuckOps ?? []) {
      const days = (nowMs - new Date(o.stage_updated_at as string).getTime()) / 86_400_000;
      const sla = slaByStage.get(o.stage as string) ?? 3;
      if (days < sla) continue;
      const key = `op-stuck:${o.id}`;
      if (isHidden(key)) continue;
      const severity: AlertSeverity =
        days >= sla * 3 ? "critica" : days >= sla * 2 ? "alta" : "media";
      alerts.push({
        key,
        category: "parado",
        severity,
        title: `OP ${o.code} parada em ${o.stage}`,
        detail: `Sem movimento há ${Math.floor(days)}d (SLA do estágio: ${sla}d)`,
        why: "Lote ultrapassou o SLA do setor — possível gargalo, falta de material ou apontamento esquecido.",
        link: "/pcp-kanban",
        ts: o.stage_updated_at as string,
      });
    }

    // 4. Qualidade — CAPAs abertas/vencendo
    for (const c of capas ?? []) {
      const key = `capa:${c.id}`;
      if (isHidden(key)) continue;
      const due = c.due_date ? new Date(c.due_date as string) : null;
      const overdueDays = due ? Math.floor((nowMs - due.getTime()) / 86_400_000) : -1;
      const sevSrc = (c.severity ?? "media") as string;
      let severity: AlertSeverity =
        sevSrc === "critica" || sevSrc === "alta"
          ? (sevSrc as AlertSeverity)
          : sevSrc === "baixa"
            ? "baixa"
            : "media";
      if (overdueDays >= 7) severity = "critica";
      else if (overdueDays >= 1 && severity !== "critica") severity = "alta";
      alerts.push({
        key,
        category: "qualidade",
        severity,
        title: c.title as string,
        detail:
          overdueDays > 0
            ? `CAPA vencida há ${overdueDays}d · status ${c.status}`
            : `CAPA aberta · prazo ${c.due_date ?? "—"}`,
        why:
          overdueDays > 0
            ? "Ação corretiva passou do prazo — risco de reincidência do defeito."
            : "Causa raiz aberta. Fechar antes do prazo evita reincidência.",
        link: "/qualidade",
        ts: c.created_at as string,
      });
    }

    // 5. Protótipos paradas
    for (const p of oldProtos ?? []) {
      const key = `proto-stale:${p.id}`;
      if (isHidden(key)) continue;
      const days = Math.floor((nowMs - new Date(p.updated_at as string).getTime()) / 86_400_000);
      const severity: AlertSeverity =
        days >= 21 ? "alta" : days >= 14 ? "media" : "baixa";
      alerts.push({
        key,
        category: "proto",
        severity,
        title: `Protótipo ${p.code} sem evolução`,
        detail: `${p.stage} há ${days}d`,
        why: "Protótipo paralisado atrasa o lançamento da coleção inteira.",
        link: "/prototipos",
        ts: p.updated_at as string,
      });
    }

    // 6. Marketing
    for (const m of mkt ?? []) {
      const key = `mkt:${m.id}`;
      if (isHidden(key)) continue;
      alerts.push({
        key,
        category: "marketing",
        severity: "media",
        title: m.title as string,
        detail: (m.body as string) ?? "",
        why: "Sinal vindo do loop com PLM (nova coleção, brief, lançamento).",
        link: (m.link as string) || "/marketing",
        ts: m.created_at as string,
      });
    }

    // Ordena por severidade desc, depois por ts desc
    alerts.sort((a, b) => {
      const dw = sevWeight[b.severity] - sevWeight[a.severity];
      if (dw !== 0) return dw;
      return b.ts.localeCompare(a.ts);
    });

    return alerts;
  });

export const dismissAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { key: string; mode: "snooze" | "resolve" }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      user_id: userId,
      owner_id: userId,
      alert_key: data.key,
      resolved: data.mode === "resolve",
      dismissed_until:
        data.mode === "snooze" ? new Date(Date.now() + 7 * 86_400_000).toISOString() : null,
    };
    const { error } = await supabase
      .from("alert_dismissals")
      .upsert(payload, { onConflict: "user_id,alert_key" });
    if (error) throw error;
    return { ok: true };
  });
