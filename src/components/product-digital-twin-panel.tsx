/**
 * Wave 21 — Digital Twin ampliado (fábrica em tempo real por produto).
 *
 * Assina postgres_changes de production_orders/material_reservations/
 * production_occurrences filtrados por product_id e revalida a query.
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  Boxes,
  Clock,
  Factory,
  Radio,
} from "lucide-react";
import { getProductDigitalTwin } from "@/lib/product-digital-twin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";

export function ProductDigitalTwinPanel({ productId }: { productId: string }) {
  const fetchTwin = useServerFn(getProductDigitalTwin);
  const qc = useQueryClient();
  const queryKey = ["product-digital-twin", productId] as const;

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchTwin({ data: { productId } }),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const invalidate = () => qc.invalidateQueries({ queryKey });
    const ch = supabase
      .channel(`twin-${productId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "production_orders",
          filter: `product_id=eq.${productId}`,
        },
        invalidate,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "material_reservations" },
        invalidate,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "production_occurrences" },
        invalidate,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [productId, qc, queryKey]);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!data) return null;

  if (data.total_open === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <EmptyState
          icon={Factory}
          title="Sem lotes ativos"
          description="Nenhuma OP aberta para acompanhar em tempo real."
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-primary animate-pulse" />
          <h3 className="text-sm font-semibold">Digital Twin — fábrica em tempo real</h3>
        </div>
        <span className="text-[10px] text-muted-foreground">
          atualizado {new Date(data.generated_at).toLocaleTimeString("pt-BR")}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Kpi icon={Boxes} label="Lotes ativos" value={data.total_open} />
        <Kpi icon={Activity} label="Qtd em WIP" value={data.total_qty} />
        <Kpi
          icon={Clock}
          label="Estouros de SLA"
          value={data.breach_count}
          tone={data.breach_count > 0 ? "warn" : undefined}
        />
        <Kpi
          icon={AlertTriangle}
          label="Atrasados"
          value={data.late_count}
          tone={data.late_count > 0 ? "danger" : undefined}
        />
      </div>

      {/* Esteira por etapa */}
      <div className="overflow-x-auto">
        <div className="flex gap-2 min-w-max pb-1">
          {data.stage_summary
            .filter((s) => s.wip_orders > 0)
            .map((s) => (
              <div
                key={s.stage_key}
                className="min-w-[120px] rounded-lg border border-border bg-muted/40 px-3 py-2"
              >
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {s.stage_label}
                </div>
                <div className="text-lg font-semibold">{s.wip_orders}</div>
                <div className="text-[10px] text-muted-foreground">
                  {s.wip_qty} pçs
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Lista de lotes com status ao vivo */}
      <div className="space-y-2">
        {data.lots.map((l) => (
          <Link
            key={l.id}
            to="/lote/$id"
            params={{ id: l.id }}
            className="flex items-center justify-between border border-border rounded-lg px-3 py-2 hover:bg-muted transition text-sm"
          >
            <div className="flex flex-col">
              <span className="font-medium">{l.code}</span>
              <span className="text-[11px] text-muted-foreground">
                {l.stage_label}
                {l.next_stage_label ? ` → ${l.next_stage_label}` : ""} · {l.quantity} pçs
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {l.dwell_days != null && (
                <Badge
                  variant="outline"
                  className={`text-[10px] ${l.breach ? "border-destructive text-destructive" : ""}`}
                >
                  {l.dwell_days}d{l.sla_days ? ` / SLA ${l.sla_days}d` : ""}
                </Badge>
              )}
              {l.material_coverage_pct != null && l.material_coverage_pct < 100 && (
                <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600">
                  Material {l.material_coverage_pct}%
                </Badge>
              )}
              {l.material_shortage_items > 0 && (
                <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600">
                  {l.material_shortage_items} falta(s)
                </Badge>
              )}
              {l.recent_occurrences > 0 && (
                <Badge variant="outline" className="text-[10px] border-orange-500 text-orange-600">
                  {l.recent_occurrences} ocorr.
                </Badge>
              )}
              {l.late && (
                <Badge variant="destructive" className="text-[10px]">
                  Atrasado
                </Badge>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Boxes;
  label: string;
  value: number;
  tone?: "warn" | "danger";
}) {
  const color =
    tone === "danger"
      ? "text-destructive"
      : tone === "warn"
      ? "text-amber-600"
      : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className={`text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}
