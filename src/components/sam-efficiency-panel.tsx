import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, AlertTriangle, Clock, TrendingDown } from "lucide-react";
import { getSamEfficiency, type OpSamEfficiency } from "@/lib/pcp-advanced.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const STATUS_TONE: Record<OpSamEfficiency["status"], string> = {
  critico: "bg-destructive/15 text-destructive border-destructive/30",
  abaixo: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  em_curso: "bg-sky-500/10 text-sky-600 border-sky-500/30",
  sem_sam: "bg-muted text-muted-foreground border-border",
  ok: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
};

const STATUS_LABEL: Record<OpSamEfficiency["status"], string> = {
  critico: "Crítico",
  abaixo: "Abaixo",
  em_curso: "Em curso",
  sem_sam: "Sem SAM",
  ok: "OK",
};

export function SamEfficiencyPanel() {
  const [days, setDays] = useState(30);
  const fetchFn = useServerFn(getSamEfficiency);
  const { data, isLoading } = useQuery({
    queryKey: ["sam-efficiency", days],
    queryFn: () => fetchFn({ data: { days } }),
  });

  const orders = data?.orders ?? [];
  const stats = {
    total: orders.length,
    critico: orders.filter((o) => o.status === "critico").length,
    abaixo: orders.filter((o) => o.status === "abaixo").length,
    semSam: orders.filter((o) => o.status === "sem_sam").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">Eficiência SAM por OP</h3>
          <span className="text-xs text-muted-foreground">
            Tempo padrão (SAM × produzido) vs tempo real (entre apontamentos)
          </span>
        </div>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="15">Últimos 15 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="60">Últimos 60 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="OPs analisadas" value={stats.total} icon={<Activity className="size-4" />} />
        <StatCard
          label="Críticos"
          value={stats.critico}
          icon={<AlertTriangle className="size-4 text-destructive" />}
          tone="critical"
        />
        <StatCard
          label="Abaixo do padrão"
          value={stats.abaixo}
          icon={<TrendingDown className="size-4 text-amber-600" />}
        />
        <StatCard
          label="Sem SAM"
          value={stats.semSam}
          icon={<Clock className="size-4 text-muted-foreground" />}
        />
      </div>

      {data?.insights?.length ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1">
          {data.insights.map((i, idx) => (
            <p key={idx} className="text-xs text-foreground/90">
              • {i}
            </p>
          ))}
        </div>
      ) : null}

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">OP / Produto</th>
              <th className="text-right px-3 py-2">SAM/pç</th>
              <th className="text-right px-3 py-2">Produzido</th>
              <th className="text-right px-3 py-2">Min. padrão</th>
              <th className="text-right px-3 py-2">Min. real</th>
              <th className="text-right px-3 py-2">Eficiência</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Recomendação</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  Calculando…
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  Nenhuma OP na janela.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.orderId} className="border-t border-border hover:bg-muted/20">
                  <td className="px-3 py-2">
                    <div className="font-mono text-xs">{o.code}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {o.productName ?? "—"}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{o.samPerPiece || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {o.producedQty}/{o.quantity}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {o.plannedMinutes || "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {o.elapsedMinutes || "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">
                    {o.efficiencyPct ? `${o.efficiencyPct}%` : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className={STATUS_TONE[o.status]}>
                      {STATUS_LABEL[o.status]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground max-w-[280px]">
                    {o.hint}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: "critical";
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${tone === "critical" && value > 0 ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}`}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}
