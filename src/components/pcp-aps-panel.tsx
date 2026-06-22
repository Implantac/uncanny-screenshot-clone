import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ListOrdered, AlarmClock, Loader2, ArrowRight, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { getApsSuggestion, getStalledOrders } from "@/lib/pcp-aps.functions";
import { applyApsSequence } from "@/lib/pcp-aps-apply.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ApsRow = Awaited<ReturnType<typeof getApsSuggestion>>[number];
type StallRow = Awaited<ReturnType<typeof getStalledOrders>>[number];

export function PcpApsPanel() {
  const qc = useQueryClient();
  const apsFn = useServerFn(getApsSuggestion);
  const stallFn = useServerFn(getStalledOrders);
  const applyFn = useServerFn(applyApsSequence);

  const aps = useQuery({
    queryKey: ["pcp-aps-suggestion"],
    queryFn: () => apsFn() as Promise<ApsRow[]>,
    refetchInterval: 60_000,
  });
  const stall = useQuery({
    queryKey: ["pcp-stalled-orders"],
    queryFn: () => stallFn() as Promise<StallRow[]>,
    refetchInterval: 60_000,
  });

  const applyMut = useMutation({
    mutationFn: () =>
      applyFn({ data: { orderedOpIds: (aps.data ?? []).map((r) => r.id) } }) as Promise<{
        updated: number;
        total: number;
      }>,
    onSuccess: (r) => {
      toast.success(`${r.updated}/${r.total} OPs reordenadas conforme APS.`);
      qc.invalidateQueries({ queryKey: ["pcp-aps-suggestion"] });
      qc.invalidateQueries({ queryKey: ["production_orders"] });
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao aplicar sequenciamento"),
  });


  const stallCount = stall.data?.length ?? 0;

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4 text-primary" />
          APS · Sequenciamento e alertas
        </div>
        <div className="flex items-center gap-2">
          {stallCount > 0 && (
            <Badge variant="outline" className="gap-1 bg-destructive/10 text-destructive border-destructive/30">
              <AlarmClock className="size-3" /> {stallCount} parado{stallCount > 1 ? "s" : ""} &gt;4h
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1 h-7 text-xs"
            disabled={!aps.data?.length || applyMut.isPending}
            onClick={() => applyMut.mutate()}
            title="Persiste a fila como priority nas OPs"
          >
            {applyMut.isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Wand2 className="size-3" />
            )}
            Aplicar sequenciamento
          </Button>
        </div>
      </div>

      <Tabs defaultValue="aps" className="px-4 pb-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="aps" className="gap-1">
            <ListOrdered className="size-3.5" /> Próximos da fila
          </TabsTrigger>
          <TabsTrigger value="stall" className="gap-1">
            <AlarmClock className="size-3.5" /> Lotes parados ({stallCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="aps" className="mt-3">
          {aps.isLoading ? (
            <Loading />
          ) : !aps.data?.length ? (
            <Empty text="Sem OPs ativas para sequenciar." />
          ) : (
            <ol className="space-y-1.5">
              {aps.data.map((r, i) => (
                <li
                  key={r.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-background/40 p-2.5 text-sm"
                >
                  <div className="grid size-7 place-items-center rounded-md bg-primary/10 text-xs font-bold text-primary shrink-0">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs">{r.code}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {r.product_name ?? r.product_sku ?? "—"}
                      </span>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {r.stage ?? "—"}
                      </Badge>
                      {r.priority >= 4 && (
                        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                          P{r.priority}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <ArrowRight className="size-3" /> {r.reason}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-semibold">{r.score}</div>
                    <div className="text-[10px] text-muted-foreground">score</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </TabsContent>

        <TabsContent value="stall" className="mt-3">
          {stall.isLoading ? (
            <Loading />
          ) : !stall.data?.length ? (
            <Empty text="Nenhum lote parado há mais de 4 horas. Fluxo limpo." />
          ) : (
            <ul className="space-y-1.5">
              {stall.data.map((r) => (
                <li
                  key={r.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-background/40 p-2.5 text-sm"
                >
                  <AlarmClock
                    className={`size-4 mt-0.5 shrink-0 ${
                      r.severity === "critica"
                        ? "text-destructive"
                        : r.severity === "alta"
                          ? "text-amber-500"
                          : "text-muted-foreground"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs">{r.code}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {r.product_name ?? r.product_sku ?? "—"}
                      </span>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {r.stage ?? "—"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Sem movimentação há{" "}
                      <span className="font-semibold text-foreground">{r.stall_hours}h</span>
                      {r.due_date && ` · entrega ${new Date(r.due_date).toLocaleDateString("pt-BR")}`}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] capitalize ${
                      r.severity === "critica"
                        ? "bg-destructive/10 text-destructive border-destructive/30"
                        : r.severity === "alta"
                          ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                          : ""
                    }`}
                  >
                    {r.severity}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
      <Loader2 className="size-3.5 animate-spin" /> Calculando…
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-xs text-muted-foreground py-4">{text}</div>;
}
