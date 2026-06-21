import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listProductRoutings, saveProductRouting } from "@/lib/product-routing.functions";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Route as RouteIcon, GripVertical } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_app/product-routing")({
  head: () => ({
    meta: [
      { title: "Roteiro Produtivo (BOP) · USE MODA PLM" },
      { name: "description", content: "Defina o roteiro de estágios por produto ou família." },
    ],
  }),
  component: ProductRoutingPage,
});

type Step = {
  stage_key: string;
  sequence: number;
  sla_days: number;
  required: boolean;
  notes: string | null;
};

function ProductRoutingPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listProductRoutings);
  const saveFn = useServerFn(saveProductRouting);

  const { data, isLoading } = useQuery({
    queryKey: ["product-routings"],
    queryFn: () => listFn(),
  });

  const [scope, setScope] = useState<"product" | "family">("family");
  const [scopeId, setScopeId] = useState<string>("");
  const [steps, setSteps] = useState<Step[]>([]);

  const stages = data?.stages ?? [];
  const products = data?.products ?? [];
  const families = data?.families ?? [];

  // carrega roteiro do escopo selecionado
  useMemo(() => {
    if (!scopeId || !data) return;
    const filtered = data.routings.filter((r) =>
      scope === "product" ? r.product_id === scopeId : r.family_id === scopeId,
    );
    setSteps(
      filtered.map((r) => ({
        stage_key: r.stage_key,
        sequence: r.sequence,
        sla_days: r.sla_days,
        required: r.required,
        notes: r.notes,
      })),
    );
  }, [scopeId, scope, data]);

  const saveMut = useMutation({
    mutationFn: () => saveFn({ data: { scope, scopeId, steps } }),
    onSuccess: () => {
      toast.success("Roteiro salvo");
      qc.invalidateQueries({ queryKey: ["product-routings"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const addStep = () => {
    if (stages.length === 0) return;
    const used = new Set(steps.map((s) => s.stage_key));
    const next = stages.find((s) => !used.has(s.key)) ?? stages[0];
    setSteps((prev) => [
      ...prev,
      { stage_key: next.key, sequence: prev.length + 1, sla_days: 2, required: true, notes: null },
    ]);
  };
  const removeStep = (idx: number) =>
    setSteps((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, sequence: i + 1 })));
  const move = (idx: number, dir: -1 | 1) => {
    setSteps((prev) => {
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next.map((s, i) => ({ ...s, sequence: i + 1 }));
    });
  };

  // resumo: quantos itens já têm roteiro
  const summary = useMemo(() => {
    const r = data?.routings ?? [];
    const byProduct = new Set(r.filter((x) => x.product_id).map((x) => x.product_id));
    const byFamily = new Set(r.filter((x) => x.family_id).map((x) => x.family_id));
    return { products: byProduct.size, families: byFamily.size, total: r.length };
  }, [data]);

  return (
    <div className="space-y-4 p-4 max-w-5xl mx-auto">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <RouteIcon className="size-5 text-primary" />
          Roteiro Produtivo (BOP)
        </h1>
        <p className="text-xs text-muted-foreground">
          Defina a sequência real de estágios para cada produto ou família. Jeans usa lavanderia,
          malha pula — o Kanban PCP respeita esse roteiro. Sem roteiro definido, usa o fluxo global de estágios.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Cobertura</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4 text-xs">
          <div><Badge variant="outline">{summary.products}</Badge> produtos com roteiro</div>
          <div><Badge variant="outline">{summary.families}</Badge> famílias com roteiro</div>
          <div className="text-muted-foreground">· {summary.total} passos totais</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Editar roteiro</CardTitle>
          <CardDescription>Escolha um escopo, monte a sequência e salve.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Select value={scope} onValueChange={(v) => { setScope(v as "product" | "family"); setScopeId(""); setSteps([]); }}>
                  <SelectTrigger><SelectValue placeholder="Escopo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="family">Família de produtos</SelectItem>
                    <SelectItem value="product">Produto específico</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={scopeId} onValueChange={setScopeId}>
                  <SelectTrigger><SelectValue placeholder={scope === "family" ? "Selecione a família" : "Selecione o produto"} /></SelectTrigger>
                  <SelectContent>
                    {(scope === "family" ? families : products).map((it) => (
                      <SelectItem key={it.id} value={it.id}>
                        {scope === "family" ? it.name : `${(it as { sku?: string }).sku ?? ""} · ${it.name}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {scopeId && (
                <>
                  <div className="rounded-md border">
                    {steps.length === 0 ? (
                      <div className="p-6 text-center text-xs text-muted-foreground">
                        Nenhum passo definido. Clique em "Adicionar passo".
                      </div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50">
                          <tr className="text-left">
                            <th className="p-2 w-8"></th>
                            <th className="p-2">#</th>
                            <th className="p-2">Estágio</th>
                            <th className="p-2">SLA (dias)</th>
                            <th className="p-2">Obrigatório</th>
                            <th className="p-2">Notas</th>
                            <th className="p-2 w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {steps.map((s, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="p-1">
                                <div className="flex flex-col">
                                  <button onClick={() => move(idx, -1)} className="text-muted-foreground hover:text-foreground" title="subir">▲</button>
                                  <button onClick={() => move(idx, 1)} className="text-muted-foreground hover:text-foreground" title="descer">▼</button>
                                </div>
                              </td>
                              <td className="p-2 tabular-nums">{s.sequence}</td>
                              <td className="p-2">
                                <Select
                                  value={s.stage_key}
                                  onValueChange={(v) => setSteps((p) => p.map((x, i) => i === idx ? { ...x, stage_key: v } : x))}
                                >
                                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {stages.map((st) => <SelectItem key={st.key} value={st.key}>{st.label}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  className="h-7 w-20 text-xs"
                                  value={s.sla_days}
                                  onChange={(e) => setSteps((p) => p.map((x, i) => i === idx ? { ...x, sla_days: Number(e.target.value || 0) } : x))}
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="checkbox"
                                  checked={s.required}
                                  onChange={(e) => setSteps((p) => p.map((x, i) => i === idx ? { ...x, required: e.target.checked } : x))}
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  className="h-7 text-xs"
                                  value={s.notes ?? ""}
                                  onChange={(e) => setSteps((p) => p.map((x, i) => i === idx ? { ...x, notes: e.target.value || null } : x))}
                                  placeholder="opcional"
                                />
                              </td>
                              <td className="p-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeStep(idx)}>
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={addStep}>
                      <Plus className="size-3.5 mr-1" /> Adicionar passo
                    </Button>
                    <div className="flex-1" />
                    <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                      <Save className="size-3.5 mr-1" /> Salvar roteiro
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
