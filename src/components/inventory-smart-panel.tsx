import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Boxes,
  TrendingDown,
  ClipboardCheck,
  Check,
  Loader2,
  RefreshCw,
  Sliders,
  Sparkles,
} from "lucide-react";
import {
  getDynamicReorderSuggestions,
  applyReorderSuggestion,
  getCycleCountPlan,
  registerCycleCount,
  updateReorderParams,
  REORDER_DEFAULTS,
  REORDER_LIMITS,
} from "@/lib/inventory-smart.functions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";


export function InventorySmartPanel() {
  const qc = useQueryClient();
  const ropFn = useServerFn(getDynamicReorderSuggestions);
  const applyFn = useServerFn(applyReorderSuggestion);
  const cycleFn = useServerFn(getCycleCountPlan);
  const regFn = useServerFn(registerCycleCount);
  const paramsFn = useServerFn(updateReorderParams);

  const rop = useQuery({
    queryKey: ["inv-smart", "rop"],
    queryFn: () => ropFn({ data: { windowDays: 60 } }),
    refetchInterval: 60_000,
  });
  const cycle = useQuery({
    queryKey: ["inv-smart", "cycle"],
    queryFn: () => cycleFn({ data: { windowDays: 90 } }),
    refetchInterval: 120_000,
  });

  const apply = useMutation({
    mutationFn: (v: { itemId: string; minimum: number; maximum: number }) =>
      applyFn({ data: v }),
    onSuccess: () => {
      toast.success("Mínimo/máximo atualizados");
      qc.invalidateQueries({ queryKey: ["inv-smart"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  type RopItem = NonNullable<typeof rop.data>["items"][number];
  const [paramsTarget, setParamsTarget] = useState<RopItem | null>(null);
  const [formZ, setFormZ] = useState("");
  const [formS, setFormS] = useState("");
  const [formH, setFormH] = useState("");
  const [formSafetyDays, setFormSafetyDays] = useState("");

  const openParams = (it: RopItem) => {
    setParamsTarget(it);
    setFormZ(String(it.serviceFactorZ ?? 1.65));
    setFormS(String(it.costPerOrder ?? 0));
    setFormH(String(it.holdingCostAnnual ?? 0));
    setFormSafetyDays(String(it.safetyDays ?? 7));
  };

  const parseField = (raw: string, fallback: number) => {
    const trimmed = raw.trim();
    if (trimmed === "") return { value: fallback, empty: true, invalid: false };
    const n = Number(trimmed.replace(",", "."));
    if (!Number.isFinite(n)) return { value: fallback, empty: false, invalid: true };
    return { value: n, empty: false, invalid: false };
  };

  const validateRange = (
    raw: string,
    limit: { min: number; max: number; label: string },
    fallback: number,
  ): string | null => {
    const p = parseField(raw, fallback);
    if (p.empty) return null;
    if (p.invalid) return "Valor inválido — informe um número.";
    if (p.value < limit.min || p.value > limit.max)
      return `Fora da faixa: ${limit.min} a ${limit.max}. ${limit.label}`;
    return null;
  };

  const errZ = validateRange(formZ, REORDER_LIMITS.service_factor_z, REORDER_DEFAULTS.service_factor_z);
  const errS = validateRange(formS, REORDER_LIMITS.cost_per_order, REORDER_DEFAULTS.cost_per_order);
  const errH = validateRange(
    formH,
    REORDER_LIMITS.holding_cost_annual,
    REORDER_DEFAULTS.holding_cost_annual,
  );
  const errSafety = validateRange(formSafetyDays, REORDER_LIMITS.safety_days, REORDER_DEFAULTS.safety_days);
  const hasErrors = !!(errZ || errS || errH || errSafety);

  const saveParams = useMutation({
    mutationFn: () => {
      if (hasErrors) throw new Error("Corrija os campos destacados antes de salvar.");
      const pick = (raw: string, fallback: number) => parseField(raw, fallback).value;
      return paramsFn({
        data: {
          itemId: paramsTarget!.id,
          serviceFactorZ: pick(formZ, REORDER_DEFAULTS.service_factor_z),
          costPerOrder: pick(formS, REORDER_DEFAULTS.cost_per_order),
          holdingCostAnnual: pick(formH, REORDER_DEFAULTS.holding_cost_annual),
          safetyDays: Math.floor(pick(formSafetyDays, REORDER_DEFAULTS.safety_days)),
        },
      });
    },
    onSuccess: () => {
      toast.success("Parâmetros atualizados — recalculando…");
      setParamsTarget(null);
      qc.invalidateQueries({ queryKey: ["inv-smart"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });



  const [countTarget, setCountTarget] = useState<{
    itemId: string;
    sku: string;
    name: string;
    abc: "A" | "B" | "C";
    balance: number;
  } | null>(null);
  const [countValue, setCountValue] = useState("");
  const [adjust, setAdjust] = useState(true);

  const register = useMutation({
    mutationFn: () =>
      regFn({
        data: {
          itemId: countTarget!.itemId,
          abcClass: countTarget!.abc,
          countedBalance: Number(countValue),
          adjustStock: adjust,
        },
      }),
    onSuccess: (r) => {
      toast.success(
        `Contagem registrada (variância ${r.variance.toFixed(2)}${r.variancePct != null ? ` / ${r.variancePct.toFixed(1)}%` : ""})`,
      );
      setCountTarget(null);
      setCountValue("");
      qc.invalidateQueries({ queryKey: ["inv-smart"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Boxes className="size-4 text-primary" />
          <div>
            <div className="text-sm font-semibold leading-tight">Almoxarifado inteligente</div>
            <div className="text-[11px] text-muted-foreground">
              Reposição dinâmica + ABC + contagem cíclica
            </div>
          </div>
        </div>
        <button
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          onClick={() => {
            rop.refetch();
            cycle.refetch();
          }}
        >
          <RefreshCw className="size-3" /> atualizar
        </button>
      </div>

      <Tabs defaultValue="rop">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="rop" className="text-xs">
            <TrendingDown className="size-3 mr-1" />
            Reposição
            {rop.data?.counts?.critico ? (
              <Badge variant="destructive" className="ml-2 h-4 px-1 text-[10px]">
                {rop.data.counts.critico}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="cycle" className="text-xs">
            <ClipboardCheck className="size-3 mr-1" />
            Contagem cíclica
            {cycle.data?.counts?.overdue ? (
              <Badge variant="secondary" className="ml-2 h-4 px-1 text-[10px]">
                {cycle.data.counts.overdue}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rop" className="mt-3 space-y-2">
          {rop.isLoading ? (
            <div className="text-xs text-muted-foreground inline-flex items-center gap-2">
              <Loader2 className="size-3 animate-spin" /> Calculando ROP…
            </div>
          ) : rop.data && rop.data.items.length > 0 ? (
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
              {rop.data.items.slice(0, 25).map((it) => (
                <div
                  key={it.id}
                  className="rounded-lg border border-border/50 p-2.5 text-xs flex flex-col gap-2"
                >
                  <div className="flex items-start gap-3">
                    <Badge
                      variant={it.needsOrder ? "destructive" : "outline"}
                      className="h-5 text-[10px] uppercase shrink-0"
                    >
                      {it.needsOrder ? "Emitir Pedido" : "Estoque Ok"}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {it.sku} · {it.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{it.reason}</div>
                      <div className="text-[11px] mt-1 flex gap-3 flex-wrap">
                        <span>
                          Saldo: <b>{it.balance}</b> {it.unit}
                        </span>
                        <span>
                          ROP: <b>{it.rop}</b> · SS: <b>{it.safetyStock}</b>
                        </span>
                        <span>
                          LEC: <b>{it.eoq > 0 ? it.eoq : "—"}</b>
                        </span>
                        <span className="text-muted-foreground">
                          Lead {it.leadTimeDays}d · {it.supplier ?? "sem fornecedor"}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[11px]"
                        onClick={() => openParams(it)}
                        title="Editar Z, custo do pedido e custo de armazenagem"
                      >
                        <Sliders className="size-3 mr-1" /> params
                      </Button>
                      {it.currentMin !== it.suggestedMin && it.dailyConsumption > 0 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px]"
                          onClick={() =>
                            apply.mutate({
                              itemId: it.id,
                              minimum: it.suggestedMin,
                              maximum: it.suggestedMax,
                            })
                          }
                          disabled={apply.isPending}
                        >
                          <Check className="size-3 mr-1" /> aplicar
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {it.needsOrder && it.eoq > 0 ? (
                    <div className="rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-[11px] flex items-center gap-2">
                      <Sparkles className="size-3 text-primary shrink-0" />
                      <span>
                        Sugestão de compra ideal: comprar <b>{it.eoq}</b> {it.unit} para otimizar
                        custo de pedido vs. armazenagem (LEC).
                      </span>
                    </div>
                  ) : it.needsOrder ? (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-[11px] flex items-center gap-2">
                      <Sparkles className="size-3 text-amber-600 shrink-0" />
                      <span>
                        Defina <b>custo do pedido (S)</b> e <b>custo anual de armazenagem (H)</b>{" "}
                        em <i>params</i> para calcular o LEC.
                      </span>
                    </div>
                  ) : null}
                  {it.warnings && it.warnings.length > 0 ? (
                    <div className="rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1.5 text-[11px] text-destructive space-y-0.5">
                      {it.warnings.map((w, i) => (
                        <div key={i}>⚠ {w}</div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              Sem itens cadastrados ou sem consumo na janela.
            </div>
          )}
        </TabsContent>

        <TabsContent value="cycle" className="mt-3 space-y-2">
          {cycle.data?.counts ? (
            <div className="flex gap-2 text-[11px] text-muted-foreground mb-1">
              <span>A: {cycle.data.counts.A}</span>
              <span>B: {cycle.data.counts.B}</span>
              <span>C: {cycle.data.counts.C}</span>
              <span className="ml-auto text-destructive">
                {cycle.data.counts.overdue} em atraso
              </span>
            </div>
          ) : null}
          {cycle.isLoading ? (
            <div className="text-xs text-muted-foreground inline-flex items-center gap-2">
              <Loader2 className="size-3 animate-spin" /> Montando plano ABC…
            </div>
          ) : cycle.data && cycle.data.plan.length > 0 ? (
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
              {cycle.data.plan.map((it) => (
                <div
                  key={it.id}
                  className="rounded-lg border border-border/50 p-2.5 text-xs flex items-center gap-3"
                >
                  <Badge variant={it.overdue ? "destructive" : "outline"} className="h-5 shrink-0">
                    {it.abc}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {it.sku} · {it.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Saldo {it.balance} {it.unit} · cadência {it.cadenceDays}d ·{" "}
                      {it.lastCountedAt
                        ? `última há ${it.daysSinceLastCount}d`
                        : "nunca contado"}
                      {it.lastVariance != null
                        ? ` · variância anterior ${it.lastVariance.toFixed(1)}`
                        : ""}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={it.overdue ? "default" : "outline"}
                    className="h-7 text-[11px] shrink-0"
                    onClick={() =>
                      setCountTarget({
                        itemId: it.id,
                        sku: it.sku,
                        name: it.name,
                        abc: it.abc,
                        balance: it.balance,
                      })
                    }
                  >
                    contar
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">Sem itens para classificar.</div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!countTarget} onOpenChange={(o) => !o && setCountTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Contagem cíclica</DialogTitle>
            <DialogDescription>
              {countTarget?.sku} · {countTarget?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="text-xs text-muted-foreground">
              Saldo esperado: <b>{countTarget?.balance}</b>
            </div>
            <div>
              <label className="text-xs font-medium">Saldo contado</label>
              <Input
                type="number"
                step="0.01"
                value={countValue}
                onChange={(e) => setCountValue(e.target.value)}
                autoFocus
              />
            </div>
            <label className="text-xs flex items-center gap-2">
              <input
                type="checkbox"
                checked={adjust}
                onChange={(e) => setAdjust(e.target.checked)}
              />
              Ajustar saldo automaticamente se houver variância
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCountTarget(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => register.mutate()}
              disabled={register.isPending || !countValue}
            >
              {register.isPending ? <Loader2 className="size-3 animate-spin" /> : null}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!paramsTarget} onOpenChange={(o) => !o && setParamsTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Parâmetros de reposição</DialogTitle>
            <DialogDescription>
              {paramsTarget?.sku} · {paramsTarget?.name}
            </DialogDescription>
          </DialogHeader>
          {paramsTarget ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-md bg-muted/40 p-2.5 text-[11px] space-y-0.5">
                <div>
                  Consumo médio: <b>{paramsTarget.dailyConsumption}</b> {paramsTarget.unit}/dia ·
                  σ <b>{paramsTarget.sigmaDaily}</b>
                </div>
                <div>
                  Lead time fornecedor: <b>{paramsTarget.leadTimeDays}d</b> · Demanda anual estim.:{" "}
                  <b>{paramsTarget.annualDemand}</b>
                </div>
                <div>
                  ROP atual: <b>{paramsTarget.rop}</b> · SS: <b>{paramsTarget.safetyStock}</b> ·
                  LEC: <b>{paramsTarget.eoq > 0 ? paramsTarget.eoq : "—"}</b>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">Fator de serviço Z</label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={formZ}
                    placeholder={String(REORDER_DEFAULTS.service_factor_z)}
                    onChange={(e) => setFormZ(e.target.value)}
                  />
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    1.28=90% · 1.65=95% · 2.33=99% · vazio = {REORDER_DEFAULTS.service_factor_z}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium">Dias de segurança (fallback)</label>
                  <Input
                    type="number"
                    step="1"
                    min={0}
                    value={formSafetyDays}
                    placeholder={String(REORDER_DEFAULTS.safety_days)}
                    onChange={(e) => setFormSafetyDays(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Custo por pedido (S)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={formS}
                    placeholder="0,00"
                    onChange={(e) => setFormS(e.target.value)}
                  />
                  <div className="text-[10px] text-muted-foreground mt-0.5">R$ operacional · vazio desativa LEC</div>
                </div>
                <div>
                  <label className="text-xs font-medium">Custo anual armazenagem (H)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={formH}
                    placeholder="0,00"
                    onChange={(e) => setFormH(e.target.value)}
                  />
                  <div className="text-[10px] text-muted-foreground mt-0.5">R$ por unidade/ano</div>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setParamsTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={() => saveParams.mutate()} disabled={saveParams.isPending}>
              {saveParams.isPending ? <Loader2 className="size-3 mr-1 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
