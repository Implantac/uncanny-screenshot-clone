import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CalendarClock, CheckCircle2, Play, Plus, Loader2 } from "lucide-react";
import {
  listCollectionMilestones,
  initCollectionTimeline,
  markMilestoneDone,
  upsertMilestone,
  STAGE_LABELS,
} from "@/lib/collection-timeline.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_app/time-and-action")({
  component: TimeActionPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">Não encontrado</div>,
});

function TimeActionPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [collectionId, setCollectionId] = useState<string | null>(null);

  const { data: collections } = useQuery({
    queryKey: ["collections-list-ta"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collections")
        .select("id, name, season, year, status, launch_date")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const list = useServerFn(listCollectionMilestones);
  const init = useServerFn(initCollectionTimeline);
  const done = useServerFn(markMilestoneDone);
  const upsert = useServerFn(upsertMilestone);

  const { data: milestones, isLoading } = useQuery({
    queryKey: ["milestones", collectionId],
    queryFn: () => list({ data: { collectionId: collectionId! } }),
    enabled: !!collectionId,
  });

  const initMut = useMutation({
    mutationFn: () => init({ data: { collectionId: collectionId! } }),
    onSuccess: () => {
      toast.success("Cronograma criado");
      qc.invalidateQueries({ queryKey: ["milestones", collectionId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const doneMut = useMutation({
    mutationFn: (id: string) => done({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["milestones", collectionId] }),
  });

  const dateMut = useMutation({
    mutationFn: (vars: { stage: string; plannedDate: string }) =>
      upsert({
        data: {
          collectionId: collectionId!,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          stage: vars.stage as any,
          plannedDate: vars.plannedDate,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["milestones", collectionId] }),
  });

  const today = new Date().toISOString().slice(0, 10);
  const items = milestones ?? [];

  return (
    <div className="space-y-4 p-4">
      <header className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
          <CalendarClock className="size-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Time & Action</h1>
          <p className="text-sm text-muted-foreground">
            Cronograma de desenvolvimento da coleção — briefing → lançamento, com SLA por etapa.
          </p>
        </div>
      </header>

      <div className="glass rounded-2xl p-3 flex items-center gap-2 flex-wrap">
        <Select value={collectionId ?? ""} onValueChange={(v) => setCollectionId(v || null)}>
          <SelectTrigger className="w-[280px] h-9 text-sm">
            <SelectValue placeholder="Selecione uma coleção…" />
          </SelectTrigger>
          <SelectContent>
            {(collections ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} {c.season ? `· ${c.season}` : ""} {c.year ?? ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {collectionId && items.length === 0 && !isLoading && (
          <Button size="sm" onClick={() => initMut.mutate()} disabled={initMut.isPending}>
            {initMut.isPending ? (
              <Loader2 className="size-4 mr-1 animate-spin" />
            ) : (
              <Plus className="size-4 mr-1" />
            )}
            Gerar cronograma padrão
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => navigate({ to: "/colecoes" })}
        >
          Gerenciar coleções
        </Button>
      </div>

      {!collectionId ? (
        <p className="text-sm text-muted-foreground p-6">
          Selecione uma coleção para ver o cronograma.
        </p>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground p-6">Carregando…</p>
      ) : items.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center">
          <CalendarClock className="size-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">Cronograma ainda não gerado</p>
          <p className="text-xs text-muted-foreground mt-1">
            Clique em "Gerar cronograma padrão" para criar as 7 etapas com SLAs sugeridos.
          </p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Etapa</th>
                <th className="text-left px-3 py-2">SLA</th>
                <th className="text-left px-3 py-2">Planejado</th>
                <th className="text-left px-3 py-2">Real</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => {
                const overdue =
                  m.status !== "concluido" &&
                  m.planned_date &&
                  m.planned_date < today;
                const gap =
                  m.actual_date && m.planned_date
                    ? Math.round(
                        (new Date(m.actual_date).getTime() -
                          new Date(m.planned_date).getTime()) /
                          86400000,
                      )
                    : null;
                return (
                  <tr key={m.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{STAGE_LABELS[m.stage] ?? m.stage}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {m.sla_days ? `${m.sla_days}d` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="date"
                        value={m.planned_date ?? ""}
                        onChange={(e) =>
                          dateMut.mutate({ stage: m.stage, plannedDate: e.target.value })
                        }
                        className="h-7 w-[140px] text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-xs tabular-nums">
                      {m.actual_date ? (
                        <span>
                          {new Date(m.actual_date).toLocaleDateString("pt-BR")}
                          {gap !== null && (
                            <span
                              className={`ml-1 ${gap > 0 ? "text-destructive" : "text-emerald-600"}`}
                            >
                              ({gap > 0 ? `+${gap}` : gap}d)
                            </span>
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {m.status === "concluido" ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 border border-emerald-500/30">
                          Concluído
                        </span>
                      ) : overdue ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive border border-destructive/30">
                          Atrasado
                        </span>
                      ) : m.status === "em_andamento" ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-700 border border-blue-500/30">
                          Em andamento
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                          Pendente
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {m.status !== "concluido" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => doneMut.mutate(m.id)}
                          disabled={doneMut.isPending}
                        >
                          <CheckCircle2 className="size-3.5 mr-1" />
                          Concluir
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Suprime warning de import não usado em produção; mantido para extensibilidade futura.
void Play;
