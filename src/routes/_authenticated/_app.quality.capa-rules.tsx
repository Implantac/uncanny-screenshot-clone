import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getCapaRules,
  saveCapaRules,
  simulateCapaRules,
  type CapaRules,
} from "@/lib/quality-capa-rules.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Sliders, Play, Save, ArrowLeft, AlertTriangle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/quality/capa-rules")({
  head: () => ({
    meta: [
      { title: "Regras de CAPA automática · USE MODA PLM" },
      { name: "description", content: "Ajuste e simule os critérios que disparam CAPA em envios a influenciadores." },
    ],
  }),
  component: CapaRulesPage,
});

function CapaRulesPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getCapaRules);
  const saveFn = useServerFn(saveCapaRules);
  const simFn = useServerFn(simulateCapaRules);

  const { data: loaded } = useQuery({
    queryKey: ["capa-rules"],
    queryFn: () => getFn(),
  });

  const [rules, setRules] = useState<CapaRules | null>(null);
  const current = rules ?? loaded ?? null;

  const setField = <K extends keyof CapaRules>(k: K, v: CapaRules[K]) => {
    setRules({ ...(current as CapaRules), [k]: v });
  };

  const sim = useMutation({
    mutationFn: () => simFn({ data: current! }),
  });

  const save = useMutation({
    mutationFn: () => saveFn({ data: current! }),
    onSuccess: () => {
      toast.success("Regras salvas. A automação já passa a usar os novos critérios.");
      qc.invalidateQueries({ queryKey: ["capa-rules"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });

  if (!current) {
    return (
      <div className="p-6">
        <div className="h-4 w-40 bg-muted/40 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            to="/quality"
            className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft className="size-3" /> Voltar ao Centro de Qualidade
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2 mt-1">
            <Sliders className="size-6 text-cyan-600" /> Regras de CAPA automática
          </h1>
          <p className="text-muted-foreground text-sm">
            Defina quando um envio a influenciador deve abrir uma CAPA. Teste antes de salvar.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Critérios</CardTitle>
              <CardDescription>
                Um produto é considerado crítico se atender qualquer um dos gatilhos abaixo.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="enabled" className="text-sm">
                Automação ativa
              </Label>
              <Switch
                id="enabled"
                checked={current.enabled}
                onCheckedChange={(v) => setField("enabled", v)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-5">
          <Field
            label="FPY mínimo (%)"
            hint="Abaixo desse FPY o produto é crítico."
            value={current.fpy_threshold}
            min={0}
            max={100}
            step={1}
            onChange={(v) => setField("fpy_threshold", v)}
          />
          <Field
            label="Inspeções mínimas p/ avaliar FPY"
            hint="Evita falso positivo com poucas amostras."
            value={current.min_inspections}
            min={1}
            onChange={(v) => setField("min_inspections", v)}
          />
          <Field
            label="Defeitos críticos tolerados"
            hint="Acima deste número, dispara CAPA."
            value={current.max_critical_defects}
            min={0}
            onChange={(v) => setField("max_critical_defects", v)}
          />
          <Field
            label="Ocorrências de produção (gatilho)"
            hint="Refugo / retrabalho contam aqui."
            value={current.min_occurrences}
            min={1}
            onChange={(v) => setField("min_occurrences", v)}
          />
          <Field
            label="Janela de análise (dias)"
            hint="Período retroativo considerado."
            value={current.window_days}
            min={7}
            max={365}
            onChange={(v) => setField("window_days", v)}
          />
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => sim.mutate()}
          disabled={sim.isPending}
        >
          <Play className="size-4 mr-1" />
          {sim.isPending ? "Simulando…" : "Testar regras"}
        </Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="size-4 mr-1" />
          {save.isPending ? "Salvando…" : "Salvar"}
        </Button>
      </div>

      {sim.data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Simulação</CardTitle>
            <CardDescription>
              Resultado se as regras atuais fossem aplicadas aos últimos {current.window_days} dias.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Kpi label="Produtos analisados" value={sim.data.summary.totalProducts} />
              <Kpi
                label="Produtos críticos"
                value={sim.data.summary.triggered}
                tone={sim.data.summary.triggered ? "danger" : "ok"}
              />
              <Kpi
                label="Envios afetados"
                value={sim.data.summary.shipmentsAffected}
                tone={sim.data.summary.shipmentsAffected ? "warn" : "ok"}
              />
            </div>

            {sim.data.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum produto com sinais no período.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                    <tr className="border-b">
                      <th className="text-left py-2">Produto</th>
                      <th className="text-right">FPY</th>
                      <th className="text-right">Insp.</th>
                      <th className="text-right">Crít.</th>
                      <th className="text-right">Ocorr.</th>
                      <th className="text-right">Envios</th>
                      <th className="text-left pl-3">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sim.data.rows.map((r) => (
                      <tr key={r.productId} className="border-b last:border-0">
                        <td className="py-2">
                          <div className="font-medium leading-tight">{r.productName}</div>
                          {r.sku && (
                            <div className="text-[11px] text-muted-foreground font-mono">{r.sku}</div>
                          )}
                        </td>
                        <td
                          className={`text-right tabular-nums ${
                            r.fpy < current.fpy_threshold && r.inspections >= current.min_inspections
                              ? "text-destructive font-semibold"
                              : ""
                          }`}
                        >
                          {r.fpy.toFixed(0)}%
                        </td>
                        <td className="text-right tabular-nums">{r.inspections}</td>
                        <td
                          className={`text-right tabular-nums ${
                            r.criticalDefects > current.max_critical_defects ? "text-destructive font-semibold" : ""
                          }`}
                        >
                          {r.criticalDefects}
                        </td>
                        <td
                          className={`text-right tabular-nums ${
                            r.occurrences >= current.min_occurrences ? "text-destructive font-semibold" : ""
                          }`}
                        >
                          {r.occurrences}
                        </td>
                        <td className="text-right tabular-nums">{r.shipmentsInWindow}</td>
                        <td className="pl-3">
                          {r.wouldTrigger ? (
                            <div className="space-y-1">
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="size-3" /> Dispara CAPA
                              </Badge>
                              <div className="text-[11px] text-muted-foreground leading-tight">
                                {r.reasons.join(" · ")}
                              </div>
                            </div>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <CheckCircle2 className="size-3" /> OK
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step ?? 1}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Kpi({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  tone?: "neutral" | "ok" | "warn" | "danger";
}) {
  const cls =
    tone === "danger"
      ? "text-destructive"
      : tone === "warn"
        ? "text-amber-600"
        : tone === "ok"
          ? "text-emerald-600"
          : "text-foreground";
  return (
    <div className="rounded-xl border bg-muted/10 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums mt-0.5 ${cls}`}>{value}</div>
    </div>
  );
}
