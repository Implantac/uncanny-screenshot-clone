import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Bottleneck = {
  id: string;
  module: "pcp" | "qualidade" | "desenvolvimento" | "custo" | "marketing";
  severity: "critica" | "alta" | "media";
  title: string;
  detail: string;
  metric?: string;
  action: {
    kind: "open_route" | "advance_stage" | "open_capa" | "open_brief";
    label: string;
    route?: string;
    refId?: string;
  };
};

const SEV_RANK = { critica: 0, alta: 1, media: 2 } as const;

export const getWarRoomBottlenecks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Bottleneck[]> => {
    const { supabase, userId } = context;
    const today = new Date().toISOString().slice(0, 10);
    const d7 = new Date(Date.now() - 7 * 86400_000).toISOString();

    const [orders, protos, capa, camps, costs, targets] = await Promise.all([
      supabase
        .from("production_orders")
        .select("id, code, status, due_date, stage, product_id, products(name)")
        .eq("owner_id", userId)
        .neq("status", "concluida")
        .neq("status", "cancelada"),
      supabase
        .from("prototypes")
        .select("id, code, name, stage, updated_at")
        .eq("owner_id", userId)
        .not("stage", "in", '("aprovado","rejeitado")')
        .lt("updated_at", d7),
      supabase
        .from("quality_capa")
        .select("id, title, severity, status, due_date")
        .eq("owner_id", userId)
        .eq("status", "aberta"),
      supabase
        .from("marketing_campaigns")
        .select("id, name, status, roas, investment")
        .eq("owner_id", userId)
        .eq("status", "ativa"),
      supabase
        .from("tech_sheets")
        .select("product_id, cost_price, products(name)")
        .eq("owner_id", userId)
        .eq("status", "aprovada"),
      supabase.from("product_target_costs").select("product_id, target_cost").eq("owner_id", userId),
    ]);

    const out: Bottleneck[] = [];

    // PCP — OPs atrasadas
    (orders.data ?? []).forEach((o: any) => {
      if (o.due_date && o.due_date < today) {
        const daysLate = Math.floor(
          (Date.parse(today) - Date.parse(o.due_date)) / 86400_000,
        );
        out.push({
          id: `op-${o.id}`,
          module: "pcp",
          severity: daysLate > 7 ? "critica" : daysLate > 2 ? "alta" : "media",
          title: `OP ${o.code} atrasada`,
          detail: `${o.products?.name ?? "Produto"} · estágio ${o.stage ?? "—"}`,
          metric: `${daysLate}d`,
          action: {
            kind: "open_route",
            label: "Abrir OP",
            route: `/lote/${o.id}`,
            refId: o.id,
          },
        });
      }
    });

    // Desenvolvimento — protótipos parados >7d
    (protos.data ?? []).forEach((p: any) => {
      const days = Math.floor((Date.now() - Date.parse(p.updated_at)) / 86400_000);
      out.push({
        id: `proto-${p.id}`,
        module: "desenvolvimento",
        severity: days > 21 ? "critica" : days > 14 ? "alta" : "media",
        title: `Protótipo ${p.code} parado`,
        detail: `${p.name ?? ""} · ${p.stage}`,
        metric: `${days}d sem mover`,
        action: { kind: "open_route", label: "Destravar", route: "/prototipos", refId: p.id },
      });
    });

    // Qualidade — CAPA aberta
    (capa.data ?? []).forEach((c: any) => {
      const overdue = c.due_date && c.due_date < today;
      out.push({
        id: `capa-${c.id}`,
        module: "qualidade",
        severity:
          c.severity === "critica"
            ? "critica"
            : c.severity === "alta" || overdue
              ? "alta"
              : "media",
        title: c.title ?? "CAPA aberta",
        detail: overdue ? `Vencida em ${c.due_date}` : `Prazo ${c.due_date ?? "—"}`,
        action: { kind: "open_route", label: "Tratar CAPA", route: "/quality", refId: c.id },
      });
    });

    // Custo — overrun >10%
    const tgt = new Map<string, number>();
    (targets.data ?? []).forEach((t: any) => t.product_id && tgt.set(t.product_id, Number(t.target_cost)));
    (costs.data ?? []).forEach((c: any) => {
      const t = tgt.get(c.product_id);
      if (!t || !c.cost_price) return;
      const gap = ((Number(c.cost_price) - t) / t) * 100;
      if (gap > 10) {
        out.push({
          id: `cost-${c.product_id}`,
          module: "custo",
          severity: gap > 25 ? "critica" : gap > 15 ? "alta" : "media",
          title: `Custo estourado: ${c.products?.name ?? "produto"}`,
          detail: `Atual acima do target`,
          metric: `+${gap.toFixed(1)}%`,
          action: { kind: "open_route", label: "Rever ficha", route: "/target-costing" },
        });
      }
    });

    // Marketing — ROAS baixo
    (camps.data ?? []).forEach((c: any) => {
      const roas = Number(c.roas ?? 0);
      if (roas > 0 && roas < 1.5 && Number(c.investment ?? 0) > 0) {
        out.push({
          id: `camp-${c.id}`,
          module: "marketing",
          severity: roas < 1 ? "critica" : "alta",
          title: `Campanha "${c.name}" abaixo do alvo`,
          detail: `ROAS ${roas.toFixed(2)} · realocar verba`,
          metric: `ROAS ${roas.toFixed(2)}`,
          action: { kind: "open_route", label: "Ajustar", route: "/campaigns", refId: c.id },
        });
      }
    });

    out.sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]);
    return out.slice(0, 30);
  });

const AdvanceInput = z.object({
  order_id: z.string().uuid(),
  to_stage: z.string().min(1).max(40),
});

export const advanceProductionStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => AdvanceInput.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("production_orders")
      .update({ stage: data.to_stage })
      .eq("id", data.order_id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
