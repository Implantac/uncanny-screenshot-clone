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

const STATUS_VARIANT: Record<string, "destructive" | "secondary" | "outline"> = {
  critico: "destructive",
  rever: "secondary",
  ok: "outline",
};

export function InventorySmartPanel() {
  const qc = useQueryClient();
  const ropFn = useServerFn(getDynamicReorderSuggestions);
  const applyFn = useServerFn(applyReorderSuggestion);
  const cycleFn = useServerFn(getCycleCountPlan);
  const regFn = useServerFn(registerCycleCount);

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
                  className="rounded-lg border border-border/50 p-2.5 text-xs flex items-start gap-3"
                >
                  <Badge
                    variant={STATUS_VARIANT[it.status]}
                    className="h-5 text-[10px] uppercase shrink-0"
                  >
                    {it.status}
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
                        Mín atual: <b>{it.currentMin}</b> → sugerido <b>{it.suggestedMin}</b>
                      </span>
                      <span className="text-muted-foreground">
                        Máx: {it.suggestedMax} · {it.supplier ?? "sem fornecedor"}
                      </span>
                    </div>
                  </div>
                  {it.currentMin !== it.suggestedMin && it.dailyConsumption > 0 ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] shrink-0"
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
    </div>
  );
}
