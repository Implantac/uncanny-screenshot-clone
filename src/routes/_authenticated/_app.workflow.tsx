import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyWorkflowTasks, STEP_META } from "@/lib/product-workflow.functions";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Workflow, AlertTriangle, ArrowRight, ImageIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/workflow")({
  head: () => ({
    meta: [
      { title: "Meu Workflow · USE MODA PLM" },
      {
        name: "description",
        content:
          "Inbox pessoal do workflow do produto: etapas em andamento e bloqueadas do ciclo Design → Engenharia → PCP → Produção.",
      },
    ],
  }),
  component: WorkflowInbox,
});

function WorkflowInbox() {
  const list = useServerFn(listMyWorkflowTasks);
  const q = useQuery({
    queryKey: ["my-workflow-tasks"],
    queryFn: () => list(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const rows = q.data ?? [];
  const blocked = rows.filter((r) => r.status === "bloqueado");
  const active = rows.filter((r) => r.status === "em_andamento");

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="Meu Workflow"
        description="Etapas do ciclo do produto que dependem de você — bloqueadas primeiro, depois em andamento."
        actions={
          <div className="flex gap-2">
            <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/30">
              {blocked.length} bloqueadas
            </Badge>
            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
              {active.length} em andamento
            </Badge>
          </div>
        }
      />

      {q.isLoading ? (
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          Carregando…
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="Nenhuma etapa para você"
          description="Quando um produto avançar para uma etapa sob sua responsabilidade, ela aparece aqui."
        />
      ) : (
        <div className="space-y-3">
          {[...blocked, ...active].map((t) => {
            const meta = STEP_META[t.step];
            const isBlocked = t.status === "bloqueado";
            const blockers = (t.blocker_reason ?? "").split("\n").filter(Boolean);
            return (
              <Link
                key={t.id}
                to="/produto/$id"
                params={{ id: t.product_id }}
                className="block rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition"
              >
                <div className="flex items-start gap-4">
                  <div className="size-14 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
                    {t.product_image ? (
                      <img
                        src={t.product_image}
                        alt={t.product_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="size-5 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold truncate">
                        {t.product_name}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">
                        {t.product_sku}
                      </span>
                      {isBlocked ? (
                        <Badge className="bg-rose-500/15 text-rose-600 border-rose-500/30" variant="outline">
                          <AlertTriangle className="size-3 mr-1" /> Bloqueado
                        </Badge>
                      ) : (
                        <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30" variant="outline">
                          Em andamento
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Etapa {t.step_order} · {meta.label} · {meta.role}
                    </div>
                    {isBlocked && blockers.length > 0 && (
                      <ul className="mt-2 text-[11px] text-rose-700/90 dark:text-rose-300/90 list-disc pl-4 space-y-0.5">
                        {blockers.slice(0, 3).map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                        {blockers.length > 3 && (
                          <li className="list-none text-muted-foreground">
                            +{blockers.length - 3} outros bloqueios
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground shrink-0 mt-1" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
