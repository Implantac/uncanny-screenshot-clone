import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Boxes, AlertTriangle, CheckCircle2, RefreshCw, Package } from "lucide-react";
import { computeMaterialNeeds } from "@/lib/pcp-mrp.functions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function PcpMrpPanel() {
  const [horizon, setHorizon] = useState<string>("all");
  const compute = useServerFn(computeMaterialNeeds);
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["pcp-mrp", horizon],
    queryFn: () =>
      compute({ data: horizon === "all" ? {} : { horizonDays: Number(horizon) } }),
    staleTime: 60_000,
  });

  const items = data?.items ?? [];
  const critical = items.filter((i) => i.deficit > 0);
  const ok = items.length - critical.length;

  return (
    <section className="glass rounded-2xl p-4 space-y-3">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
            <Boxes className="size-4 text-primary-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">MRP · Necessidade de materiais</h3>
            <p className="text-xs text-muted-foreground">
              Explosão de BOM das OPs ativas × estoque × pedidos em aberto
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={horizon} onValueChange={setHorizon}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as OPs</SelectItem>
              <SelectItem value="7">Vence em 7 dias</SelectItem>
              <SelectItem value="15">Vence em 15 dias</SelectItem>
              <SelectItem value="30">Vence em 30 dias</SelectItem>
              <SelectItem value="60">Vence em 60 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <Stat icon={<Package className="size-3.5" />} label="OPs analisadas" value={data?.totalOps ?? 0} />
        <Stat icon={<AlertTriangle className="size-3.5 text-amber-500" />} label="Em falta" value={critical.length} accent="amber" />
        <Stat icon={<CheckCircle2 className="size-3.5 text-emerald-500" />} label="Coberto" value={ok} accent="emerald" />
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">
          {isFetching
            ? "Calculando…"
            : "Nenhum material para planejar. Vincule fichas técnicas aprovadas e inventory_items às OPs."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs min-w-[700px]">
            <thead className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Material</th>
                <th className="text-right px-2 py-2">Necessário</th>
                <th className="text-right px-2 py-2">Estoque</th>
                <th className="text-right px-2 py-2">Em pedido</th>
                <th className="text-right px-2 py-2">Falta</th>
                <th className="text-left px-2 py-2">Cobertura</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 30).map((it) => {
                const pct = it.coveragePct;
                const tone =
                  pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-destructive";
                return (
                  <tr key={it.inventoryItemId} className="border-t border-border">
                    <td className="px-3 py-2">
                      <div className="font-medium">{it.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {it.sku} · {it.unit}
                      </div>
                      {it.contributingOps.length > 0 && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {it.contributingOps.map((o) => o.code).join(" · ")}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{it.required}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{it.balance}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{it.onOrder}</td>
                    <td className={`px-2 py-2 text-right tabular-nums font-semibold ${it.deficit > 0 ? "text-destructive" : "text-emerald-500"}`}>
                      {it.deficit > 0 ? it.deficit : "—"}
                    </td>
                    <td className="px-2 py-2 w-[140px]">
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{pct}%</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Stat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: "amber" | "emerald";
}) {
  const ring =
    accent === "amber"
      ? "ring-amber-500/30"
      : accent === "emerald"
        ? "ring-emerald-500/30"
        : "ring-border";
  return (
    <div className={`rounded-lg border border-border bg-muted/20 px-3 py-2 ring-1 ${ring}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-lg font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
