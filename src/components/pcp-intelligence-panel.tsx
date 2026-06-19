import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPcpIntelligence, applyRebalanceSuggestion } from "@/lib/pcp-intelligence.functions";
import { Activity, AlertTriangle, ArrowRight, Gauge, Sparkles, TrendingUp, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function PcpIntelligencePanel() {
  const fn = useServerFn(getPcpIntelligence);
  const applyFn = useServerFn(applyRebalanceSuggestion);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["pcp-intelligence"],
    queryFn: () => fn({ data: {} }),
    refetchOnWindowFocus: false,
  });
  const apply = useMutation({
    mutationFn: (vars: {
      orderId: string;
      toSupplierId: string;
      fromSupplier: string;
      toSupplier: string;
    }) => applyFn({ data: vars }),
    onSuccess: (res) => {
      toast.success(`OP ${res.code ?? ""} realocada`);
      qc.invalidateQueries({ queryKey: ["pcp-intelligence"] });
      qc.invalidateQueries({ queryKey: ["capacity"] });
      qc.invalidateQueries({ queryKey: ["production-orders"] });
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao realocar"),
  });

  if (isLoading || !data) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Calculando capacidade finita…
      </div>
    );
  }

  const { kpis, suppliers, suggestions } = data;

  return (
    <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <div className="font-medium text-sm">IA-PCP · Capacidade finita</div>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">
          horizonte 4 semanas
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-5">
        <Kpi
          icon={<Gauge className="size-4" />}
          label="Ocupação média"
          value={`${kpis.avg_occupancy_pct}%`}
          tone={
            kpis.avg_occupancy_pct >= 100 ? "destructive" : kpis.avg_occupancy_pct >= 80 ? "warning" : "success"
          }
        />
        <Kpi
          icon={<TrendingUp className="size-4" />}
          label="WIP (peças)"
          value={kpis.wip_total.toLocaleString("pt-BR")}
        />
        <Kpi
          icon={<AlertTriangle className="size-4" />}
          label="OPs em risco"
          value={kpis.late_forecasts}
          tone={kpis.late_forecasts > 0 ? "destructive" : "default"}
        />
        <Kpi
          icon={<Activity className="size-4" />}
          label="Sem capacidade cadastrada"
          value={kpis.unmapped_capacity}
          tone={kpis.unmapped_capacity > 0 ? "warning" : "default"}
        />
      </div>

      {suggestions.length > 0 && (
        <div className="mx-5 mb-5 rounded-lg border border-warning/40 bg-warning/5 p-4">
          <div className="text-xs uppercase tracking-widest text-warning font-medium mb-2">
            Sugestões de rebalanceamento
          </div>
          <ul className="space-y-2 text-sm">
            {suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <ArrowRight className="size-4 mt-0.5 shrink-0 text-warning" />
                <div className="flex-1">
                  <div>
                    Mover <span className="font-mono text-xs">{s.order_code ?? s.order_id.slice(0, 6)}</span>{" "}
                    ({s.pieces} pç) de <strong>{s.from_supplier}</strong> para{" "}
                    <strong>{s.to_supplier}</strong>
                  </div>
                  <div className="text-xs text-muted-foreground">{s.reason}</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0"
                  disabled={apply.isPending}
                  onClick={() =>
                    apply.mutate({
                      orderId: s.order_id,
                      toSupplierId: s.to_supplier_id,
                      fromSupplier: s.from_supplier,
                      toSupplier: s.to_supplier,
                    })
                  }
                >
                  <Check className="size-3 mr-1" /> Aplicar
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-border">
        <div className="px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground">
          Carga por fornecedor (com previsão)
        </div>
        <div className="divide-y divide-border">
          {suppliers.length === 0 && (
            <div className="px-5 py-6 text-sm text-muted-foreground text-center">
              Cadastre a capacidade diária dos fornecedores para ativar a previsão de entrega.
            </div>
          )}
          {suppliers.map((s) => (
            <div key={s.supplier_id} className="px-5 py-3">
              <div className="flex items-center justify-between text-sm">
                <div className="font-medium">{s.supplier_name}</div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {s.wip_pieces.toLocaleString("pt-BR")} pç /{" "}
                  {s.pieces_per_day > 0 ? `${s.pieces_per_day} pç/dia` : "sem capacidade"}
                  {s.pieces_per_day > 0 && (
                    <>
                      {" · "}
                      <span
                        className={
                          s.occupancy_pct >= 100
                            ? "text-destructive font-medium"
                            : s.occupancy_pct >= 80
                              ? "text-warning"
                              : "text-success"
                        }
                      >
                        {s.occupancy_pct}%
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="h-1.5 mt-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    s.occupancy_pct >= 100
                      ? "bg-destructive"
                      : s.occupancy_pct >= 80
                        ? "bg-warning"
                        : "bg-success"
                  }`}
                  style={{ width: `${Math.min(100, s.occupancy_pct)}%` }}
                />
              </div>
              {s.next_orders.slice(0, 3).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {s.next_orders.slice(0, 3).map((o) => (
                    <span
                      key={o.id}
                      className={`text-[10px] px-2 py-0.5 rounded-full border ${
                        o.risk === "late"
                          ? "border-destructive/40 bg-destructive/10 text-destructive"
                          : o.risk === "tight"
                            ? "border-warning/40 bg-warning/10 text-warning"
                            : "border-success/40 bg-success/10 text-success"
                      }`}
                      title={
                        o.due_date
                          ? `Entrega: ${new Date(o.due_date).toLocaleDateString("pt-BR")}`
                          : "Sem prazo"
                      }
                    >
                      {o.code ?? o.id.slice(0, 6)} → {o.forecast_done}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning" | "destructive";
}) {
  const cls = {
    default: "",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  }[tone];
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}
