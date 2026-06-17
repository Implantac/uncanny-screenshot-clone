import { useMemo, useState } from "react";
import { Sparkles, Calendar, Hash, CheckCircle2, AlertTriangle } from "lucide-react";

type Order = { id: string; status: string; quantity: number; progress: number; due_date: string | null };

/**
 * Simulador de capacidade — responde "consigo entregar X peças até Y?"
 * Heurística:
 *   - Throughput diário = peças concluídas nas OPs ativas + concluídas recentes / janela observada.
 *   - WIP remanescente = soma de (quantity * (1 - progress/100)) das OPs ativas.
 *   - Capacidade disponível = throughput * dias úteis restantes.
 *   - Veredito = capacidade - WIP - meta solicitada.
 */
export function CapacitySimulator({ orders }: { orders: Order[] }) {
  const [target, setTarget] = useState<number>(500);
  const today = new Date();
  const defaultDate = new Date(today.getTime() + 14 * 86400000).toISOString().slice(0, 10);
  const [until, setUntil] = useState<string>(defaultDate);

  const calc = useMemo(() => {
    const active = orders.filter((o) => o.status !== "concluida" && o.status !== "cancelada");
    const wipRemaining = active.reduce((s, o) => s + Math.round(o.quantity * (1 - (o.progress ?? 0) / 100)), 0);
    const totalProduced = orders.reduce((s, o) => s + Math.round((o.quantity * (o.progress ?? 0)) / 100), 0);
    // janela observada = 30 dias
    const observedDays = 30;
    const dailyThroughput = totalProduced > 0 ? totalProduced / observedDays : Math.max(50, wipRemaining / 60);

    const untilDate = new Date(until + "T23:59:59");
    let workdays = 0;
    const cursor = new Date(today);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= untilDate) {
      const dow = cursor.getDay();
      if (dow !== 0 && dow !== 6) workdays += 1;
      cursor.setDate(cursor.getDate() + 1);
    }
    const capacity = Math.round(dailyThroughput * workdays);
    const free = capacity - wipRemaining;
    const fits = free >= target;
    const lackingDays = fits ? 0 : Math.ceil((target - free) / Math.max(dailyThroughput, 1));
    return { wipRemaining, dailyThroughput: Math.round(dailyThroughput), workdays, capacity, free, fits, lackingDays };
  }, [orders, target, until]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="size-4 text-primary" /> Simulador de capacidade — "consigo entregar até essa data?"
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <label className="text-xs space-y-1">
          <span className="text-muted-foreground flex items-center gap-1"><Hash className="size-3" /> Peças desejadas</span>
          <input
            type="number"
            min={1}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value || 0))}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs space-y-1">
          <span className="text-muted-foreground flex items-center gap-1"><Calendar className="size-3" /> Até a data</span>
          <input
            type="date"
            value={until}
            min={today.toISOString().slice(0, 10)}
            onChange={(e) => setUntil(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <div className="text-xs space-y-1">
          <span className="text-muted-foreground">Throughput estimado</span>
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm tabular-nums">
            {calc.dailyThroughput} pç/dia · {calc.workdays} dias úteis
          </div>
        </div>
      </div>

      <div className={`rounded-lg p-3 text-sm flex items-start gap-2 ${calc.fits ? "bg-success/10 border border-success/30" : "bg-destructive/10 border border-destructive/30"}`}>
        {calc.fits ? <CheckCircle2 className="size-4 text-success mt-0.5" /> : <AlertTriangle className="size-4 text-destructive mt-0.5" />}
        <div className="flex-1">
          <div className="font-medium">
            {calc.fits
              ? `Sim — cabe na janela. Sobra ${(calc.free - target).toLocaleString("pt-BR")} pç de folga.`
              : `Não cabe. Faltam ${(target - calc.free).toLocaleString("pt-BR")} pç (~${calc.lackingDays} dias úteis a mais ou aumentar capacidade).`}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Capacidade total na janela: <span className="font-semibold tabular-nums">{calc.capacity.toLocaleString("pt-BR")}</span> pç ·
            WIP em aberto: <span className="font-semibold tabular-nums">{calc.wipRemaining.toLocaleString("pt-BR")}</span> pç ·
            Livre p/ novos pedidos: <span className="font-semibold tabular-nums">{Math.max(calc.free, 0).toLocaleString("pt-BR")}</span> pç
          </div>
        </div>
      </div>
    </div>
  );
}
