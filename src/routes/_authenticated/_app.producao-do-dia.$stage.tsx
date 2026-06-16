import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listDayProduction } from "@/lib/pcp-ops.functions";
import { AlertTriangle, Clock, Factory, Truck } from "lucide-react";
import { QuickPassButton } from "@/components/quick-pass";
import { AICoordinatorPanel } from "@/components/ai-coordinator-panel";

export const Route = createFileRoute("/_authenticated/_app/producao-do-dia/$stage")({
  head: ({ params }) => ({
    meta: [{ title: `Produção do dia · ${params.stage} · USE MODA` }],
  }),
  component: DayProductionPage,
});

const NEXT_STAGE: Record<string, string> = {
  cad: "corte",
  corte: "costura",
  costura: "acabamento",
  acabamento: "qualidade",
  qualidade: "embalagem",
  embalagem: "entregue",
};

const PRIORITY_LABEL: Record<number, { label: string; cls: string }> = {
  3: { label: "Urgente", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  2: { label: "Alta", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  1: { label: "Normal", cls: "bg-muted text-muted-foreground border-border" },
  0: { label: "Baixa", cls: "bg-muted/40 text-muted-foreground border-border" },
};

function DayProductionPage() {
  const { stage } = useParams({ from: "/_authenticated/_app/producao-do-dia/$stage" });
  const fetchDay = useServerFn(listDayProduction);
  const { data, isLoading } = useQuery({
    queryKey: ["day-production", stage],
    queryFn: () => fetchDay({ data: { stage } }),
    refetchInterval: 30_000,
  });

  const today = new Date().toISOString().slice(0, 10);
  const overdue = (data ?? []).filter((r: any) => r.due_date && r.due_date < today).length;

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
            <Factory className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight capitalize">Produção do dia · {stage}</h1>
            <p className="text-xs text-muted-foreground">O que este setor precisa entregar agora. Atualiza a cada 30s.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-md glass">{data?.length ?? 0} OPs ativas</span>
          {overdue > 0 && (
            <span className="px-3 py-1.5 rounded-md bg-destructive/15 text-destructive border border-destructive/30 inline-flex items-center gap-1">
              <AlertTriangle className="size-3" /> {overdue} atrasada(s)
            </span>
          )}
        </div>
      </header>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Score</th>
              <th className="text-left px-4 py-3">Prioridade</th>
              <th className="text-left px-4 py-3">OP / Lote</th>
              <th className="text-left px-4 py-3">Produto</th>
              <th className="text-left px-4 py-3">Fornecedor</th>
              <th className="text-right px-4 py-3">Qtd</th>
              <th className="text-left px-4 py-3">Entrega</th>
              <th className="text-left px-4 py-3">Tempo no setor</th>
              <th className="text-right px-4 py-3">Passar →</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">Carregando…</td></tr>}
            {!isLoading && (data?.length ?? 0) === 0 && <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">Nada para produzir neste setor hoje.</td></tr>}
            {data?.map((r: any) => {
              const prio = PRIORITY_LABEL[r.priority ?? 1] ?? PRIORITY_LABEL[1];
              const isLate = r.due_date && r.due_date < today;
              const daysInStage = r.stage_updated_at
                ? Math.floor((Date.now() - new Date(r.stage_updated_at).getTime()) / 86400000)
                : 0;
              const score = Math.round(r.score ?? 0);
              const scoreCls =
                score >= 70 ? "bg-destructive/15 text-destructive border-destructive/30"
                : score >= 40 ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
                : "bg-muted text-muted-foreground border-border";
              return (
                <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded border ${scoreCls}`} title={(r.score_reasons ?? []).join(" · ")}>
                      {score}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${prio.cls}`}>{prio.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.code}</div>
                    {r.batch_code && <div className="text-xs text-muted-foreground">Lote {r.batch_code}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {r.products?.image_url ? (
                        <img
                          src={r.products.image_url}
                          alt={r.products?.name ?? ""}
                          loading="lazy"
                          className="size-10 rounded-md object-cover border border-border flex-shrink-0"
                        />
                      ) : (
                        <div className="size-10 rounded-md bg-muted/40 border border-border flex-shrink-0 grid place-items-center text-[9px] text-muted-foreground">
                          s/foto
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="truncate">{r.products?.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground font-mono">{r.products?.sku}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="inline-flex items-center gap-1">
                      {r.outsourced && <Truck className="size-3 text-amber-600" />}
                      {r.suppliers?.name ?? <span className="text-muted-foreground">Interno</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{r.quantity}</td>
                  <td className={`px-4 py-3 ${isLate ? "text-destructive font-medium" : ""}`}>{r.due_date ?? "—"}</td>
                  <td className="px-4 py-3 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" /> {daysInStage}d
                  </td>
                  <td className="px-4 py-3 text-right">
                    {NEXT_STAGE[stage] && r.owner_id ? (
                      <QuickPassButton
                        orderId={r.id}
                        orderCode={r.code}
                        ownerId={r.owner_id}
                        fromStage={stage}
                        toStage={NEXT_STAGE[stage]}
                        remaining={r.quantity}
                      />
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-muted-foreground">
        <Link to="/pcp-kanban" className="hover:underline">← Voltar ao Kanban PCP</Link>
      </div>
    </div>
  );
}
