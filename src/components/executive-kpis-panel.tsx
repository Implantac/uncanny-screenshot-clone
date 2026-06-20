import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Palette,
  Factory,
  ShieldCheck,
  DollarSign,
  Megaphone,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { getExecutiveKpis } from "@/lib/executive-kpis.functions";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function ExecutiveKpisPanel() {
  const fn = useServerFn(getExecutiveKpis);
  const { data, isLoading } = useQuery({
    queryKey: ["executive-kpis"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
  });

  if (isLoading || !data) {
    return (
      <Card className="p-4 animate-pulse h-32 bg-muted/30" />
    );
  }

  const blocks = [
    {
      title: "Desenvolvimento",
      icon: Palette,
      color: "text-violet-400",
      kpis: [
        { label: "Protótipos abertos", value: data.development.prototypesOpen },
        { label: "Aprovados (30d)", value: data.development.prototypesApproved30d },
        { label: "Lead médio", value: `${data.development.avgLeadDays.toFixed(0)}d` },
      ],
    },
    {
      title: "Produção",
      icon: Factory,
      color: "text-sky-400",
      kpis: [
        { label: "OPs abertas", value: data.production.openOrders },
        {
          label: "Atrasadas",
          value: data.production.delayedOrders,
          alert: data.production.delayedOrders > 0,
        },
        { label: "On-time", value: `${data.production.onTimePct.toFixed(0)}%` },
      ],
    },
    {
      title: "Qualidade",
      icon: ShieldCheck,
      color: "text-emerald-400",
      kpis: [
        { label: "Inspeções (30d)", value: data.quality.inspections30d },
        {
          label: "Reprovação",
          value: `${data.quality.rejectRate.toFixed(1)}%`,
          alert: data.quality.rejectRate > 5,
        },
        { label: "CAPA abertas", value: data.quality.openCapa, alert: data.quality.openCapa > 0 },
      ],
    },
    {
      title: "Custo",
      icon: DollarSign,
      color: "text-amber-400",
      kpis: [
        {
          label: "Gap médio",
          value: `${data.cost.avgGapPct >= 0 ? "+" : ""}${data.cost.avgGapPct.toFixed(1)}%`,
          alert: data.cost.avgGapPct > 10,
        },
        { label: "Estouros", value: data.cost.overruns, alert: data.cost.overruns > 0 },
      ],
    },
    {
      title: "Marketing",
      icon: Megaphone,
      color: "text-pink-400",
      kpis: [
        { label: "Campanhas ativas", value: data.marketing.activeCampaigns },
        { label: "Investimento (30d)", value: brl(data.marketing.investment30d) },
        {
          label: "ROAS médio",
          value: data.marketing.avgRoas.toFixed(2),
          alert: data.marketing.avgRoas > 0 && data.marketing.avgRoas < 1.5,
        },
      ],
    },
  ];

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-widest">
            Dashboard Executivo
          </h3>
        </div>
        <Badge variant="outline" className="text-[10px]">cross-módulo · 30d</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {blocks.map((b) => {
          const Icon = b.icon;
          return (
            <div key={b.title} className="rounded-md border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Icon className={`size-4 ${b.color}`} />
                <span className="text-xs font-semibold uppercase tracking-wider">{b.title}</span>
              </div>
              <div className="space-y-1">
                {b.kpis.map((k) => (
                  <div key={k.label} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{k.label}</span>
                    <span
                      className={`font-mono font-semibold ${
                        "alert" in k && (k as { alert?: boolean }).alert
                          ? "text-red-400"
                          : "text-foreground"
                      }`}
                    >
                      {k.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {data.insights.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Insights da IA
          </div>
          {data.insights.map((ins, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <AlertTriangle className="size-3.5 text-amber-400 mt-0.5 shrink-0" />
              <span>{ins}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
