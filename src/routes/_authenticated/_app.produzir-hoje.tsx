import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { Factory, AlertTriangle, Flame, ArrowRight, ImageIcon, Clock } from "lucide-react";
import { AICoordinatorPanel } from "@/components/ai-coordinator-panel";

export const Route = createFileRoute("/_authenticated/_app/produzir-hoje")({
  head: () => ({
    meta: [
      { title: "Produzir Hoje · USE MODA PLM" },
      { name: "description", content: "O que o operador precisa fazer hoje. Sem filtros, sem busca." },
    ],
  }),
  component: ProduzirHoje,
});

type Stage = { key: string; label: string; color: string | null; position: number };
type Op = {
  id: string;
  code: string;
  stage: string | null;
  status: string;
  priority: number | null;
  due_date: string | null;
  quantity: number;
  stage_updated_at: string | null;
  batch_code: string | null;
  products: { name: string | null; sku: string | null; image_url: string | null } | null;
  suppliers: { name: string | null } | null;
};

function ProduzirHoje() {
  const { data, isLoading } = useQuery({
    queryKey: ["produzir-hoje"],
    queryFn: async () => {
      const [stagesR, opsR] = await Promise.all([
        supabase.from("pcp_stages").select("key,label,color,position").eq("active", true).order("position"),
        supabase
          .from("production_orders")
          .select("id, code, stage, status, priority, due_date, quantity, stage_updated_at, batch_code, products(name, sku, image_url), suppliers(name)")
          .neq("status", "cancelada")
          .neq("status", "concluida")
          .neq("stage", "entregue")
          .limit(500),
      ]);
      return { stages: (stagesR.data ?? []) as Stage[], ops: (opsR.data ?? []) as Op[] };
    },
    refetchInterval: 60_000,
  });

  const grouped = useMemo(() => {
    const stages = data?.stages ?? [];
    const ops = data?.ops ?? [];
    const now = Date.now();

    const score = (o: Op) => {
      const prio = o.priority ?? 3;
      const dueDays = o.due_date ? (new Date(o.due_date).getTime() - now) / 86_400_000 : 999;
      // menor = mais urgente
      return prio * 100 + dueDays;
    };

    return stages.map((s) => {
      const list = ops
        .filter((o) => o.stage === s.key)
        .sort((a, b) => score(a) - score(b));
      return { stage: s, ops: list };
    });
  }, [data]);

  const totalUrgentes = useMemo(
    () =>
      (data?.ops ?? []).filter(
        (o) =>
          (o.priority ?? 3) <= 2 ||
          (o.due_date && new Date(o.due_date).getTime() < Date.now())
      ).length,
    [data]
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Operação · Produzir Hoje</div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Factory className="size-7 text-primary" /> O que produzir agora
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Top 3 OPs por setor — já ordenadas por prioridade e prazo. Sem busca, sem filtro.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive">
          <Flame className="size-3.5" /> {totalUrgentes} urgentes agora
        </div>
      </header>

      <AICoordinatorPanel
        persona="pcp"
        title="Coordenador de PCP · briefing do dia"
        question="Em 5 linhas: qual setor é o gargalo, qual lote está parado, o que priorizar nas próximas 4 horas e por quê?"
      />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : grouped.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhuma etapa ativa configurada. <Link to="/pcp-stages" className="text-primary hover:underline ml-1">Configurar etapas →</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {grouped.map(({ stage, ops }) => (
            <div key={stage.key} className="glass rounded-xl p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: stage.color ?? "oklch(0.72 0.18 295)" }}
                  />
                  <div className="text-sm font-semibold">{stage.label}</div>
                  <span className="text-[10px] text-muted-foreground tabular-nums">({ops.length})</span>
                </div>
                <Link
                  to="/producao-do-dia/$stage"
                  params={{ stage: stage.key }}
                  className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                >
                  ver tudo <ArrowRight className="size-3" />
                </Link>
              </div>

              {ops.length === 0 ? (
                <div className="text-xs text-success">✓ Nada pendente neste setor.</div>
              ) : (
                <ul className="space-y-2 flex-1">
                  {ops.slice(0, 3).map((o) => {
                    const dueMs = o.due_date ? new Date(o.due_date).getTime() : null;
                    const overdue = dueMs !== null && dueMs < Date.now();
                    const urgent = (o.priority ?? 3) <= 2;
                    const stuckDays = o.stage_updated_at
                      ? Math.floor((Date.now() - new Date(o.stage_updated_at).getTime()) / 86_400_000)
                      : 0;
                    return (
                      <li
                        key={o.id}
                        className={`rounded-lg border p-3 flex gap-3 ${overdue ? "border-destructive/50 bg-destructive/5" : urgent ? "border-warning/40 bg-warning/5" : "border-border bg-muted/10"}`}
                      >
                        <div className="size-12 rounded-md border border-border bg-muted/40 overflow-hidden shrink-0 grid place-items-center">
                          {o.products?.image_url ? (
                            <img src={o.products.image_url} alt="" className="size-full object-cover" loading="lazy" />
                          ) : (
                            <ImageIcon className="size-4 text-muted-foreground/60" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-mono text-[11px] text-muted-foreground">{o.code}</div>
                            <div className="flex items-center gap-1">
                              {urgent && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded border border-destructive/30 bg-destructive/10 text-destructive">P{o.priority ?? 3}</span>
                              )}
                              {o.batch_code && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary">
                                  Lote {o.batch_code}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-sm font-medium truncate">{o.products?.name ?? "—"}</div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {o.quantity} pç · {o.suppliers?.name ?? "interno"}
                          </div>
                          <div className="flex items-center justify-between mt-1.5 text-[10px]">
                            {o.due_date ? (
                              <span className={overdue ? "text-destructive font-medium inline-flex items-center gap-1" : "text-muted-foreground inline-flex items-center gap-1"}>
                                <Clock className="size-3" />
                                {overdue ? `venceu ${new Date(o.due_date).toLocaleDateString("pt-BR")}` : `prazo ${new Date(o.due_date).toLocaleDateString("pt-BR")}`}
                              </span>
                            ) : <span className="text-muted-foreground">sem prazo</span>}
                            {stuckDays >= 3 && (
                              <span className="text-warning inline-flex items-center gap-1">
                                <AlertTriangle className="size-3" /> parada {stuckDays}d
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Link
                to="/pcp-kanban"
                className="mt-3 text-xs text-center py-1.5 rounded-md border border-border hover:border-primary hover:text-primary transition-colors"
              >
                Abrir Kanban
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
