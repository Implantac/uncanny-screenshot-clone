import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, Trophy } from "lucide-react";
import {
  getCrossKPIs,
  getVitalFewInsight,
  type KpiCell,
  type CollectionRow,
} from "@/lib/executive-cross-kpis.functions";
import { ExecutiveKpisPanel } from "@/components/executive-kpis-panel";
import { WarRoomPanel } from "@/components/war-room-panel";

export const Route = createFileRoute("/_authenticated/_app/executivo")({
  head: () => ({
    meta: [
      { title: "Executivo · USE MODA PLM" },
      { name: "description", content: "Dashboard executivo cruzado: coleção × KPI com IA." },
    ],
  }),
  component: ExecutivoPage,
});

const KPI_LABELS = {
  fpy: "FPY %",
  costGap: "Gap custo %",
  otd: "OTD %",
  markdown: "Markdown %",
  sellThrough: "Sell-through %",
} as const;

function cellClasses(status: KpiCell["status"]) {
  switch (status) {
    case "green":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "amber":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "red":
      return "bg-red-500/15 text-red-300 border-red-500/30";
    default:
      return "bg-muted/40 text-muted-foreground border-border/40";
  }
}

function formatCell(c: KpiCell) {
  if (c.value === null) return "—";
  const sign = c.status === "red" && c.value > 0 ? "+" : "";
  return `${sign}${c.value.toFixed(0)}%`;
}

function ExecutivoPage() {
  const [windowDays, setWindowDays] = useState(90);
  const fn = useServerFn(getCrossKPIs);
  const aiFn = useServerFn(getVitalFewInsight);

  const { data, isLoading } = useQuery({
    queryKey: ["cross-kpis", windowDays],
    queryFn: () => fn({ data: { windowDays } }),
    refetchInterval: 120_000,
  });

  const { data: aiData, isLoading: aiLoading } = useQuery({
    queryKey: ["cross-kpis-ai", windowDays, data?.totals.collections],
    queryFn: () => aiFn({ data: { payload: data! } }),
    enabled: !!data && data.rows.length > 0,
    staleTime: 5 * 60_000,
  });

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Executivo</h1>
          <p className="text-sm text-muted-foreground">
            Coleção × KPI com semáforo. Decisões em 1 olhada.
          </p>
        </div>
        <Select value={String(windowDays)} onValueChange={(v) => setWindowDays(Number(v))}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="60">Últimos 60 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="180">Últimos 180 dias</SelectItem>
          </SelectContent>
        </Select>
      </header>

      <WarRoomPanel />

      <ExecutiveKpisPanel />

      <Card className="p-4">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Matriz Coleção × KPI</h2>
          {data && (
            <span className="text-xs text-muted-foreground">
              {data.totals.collections} coleções · {data.totals.products} produtos
            </span>
          )}
        </header>

        {isLoading || !data ? (
          <div className="h-40 animate-pulse rounded bg-muted/30" />
        ) : data.rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Sem coleções no período.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-4">Coleção</th>
                  <th className="py-2 pr-4">Produtos</th>
                  {(Object.keys(KPI_LABELS) as Array<keyof typeof KPI_LABELS>).map((k) => (
                    <th key={k} className="py-2 pr-4">
                      {KPI_LABELS[k]}
                    </th>
                  ))}
                  <th className="py-2 pr-4 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <CollectionRowView key={r.collectionId} row={r} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <header className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <h2 className="text-base font-semibold">No vermelho (≥2 KPIs ruins)</h2>
          </header>
          {data?.red.length ? (
            <ul className="space-y-2">
              {data.red.map((r) => (
                <li
                  key={r.collectionId}
                  className="flex items-center justify-between rounded border border-red-500/30 bg-red-500/5 p-2 text-sm"
                >
                  <Link
                    to="/colecoes"
                    className="font-medium hover:underline"
                  >
                    {r.name}
                  </Link>
                  <Badge variant="outline" className="border-red-500/40 text-red-300">
                    score {r.score}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma coleção crítica.</p>
          )}
        </Card>

        <Card className="p-4">
          <header className="mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-emerald-400" />
            <h2 className="text-base font-semibold">Estrelas (≥3 KPIs verdes)</h2>
          </header>
          {data?.star.length ? (
            <ul className="space-y-2">
              {data.star.map((r) => (
                <li
                  key={r.collectionId}
                  className="flex items-center justify-between rounded border border-emerald-500/30 bg-emerald-500/5 p-2 text-sm"
                >
                  <Link
                    to="/colecoes"
                    className="font-medium hover:underline"
                  >
                    {r.name}
                  </Link>
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">
                    score +{r.score}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sem coleções estrela ainda.</p>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <header className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-400" />
          <h2 className="text-base font-semibold">Vital Few — leitura executiva</h2>
        </header>
        {aiLoading || !aiData ? (
          <div className="h-16 animate-pulse rounded bg-muted/30" />
        ) : (
          <div className="space-y-3 text-sm">
            <p className="leading-relaxed">{aiData.summary || "Sem leitura disponível."}</p>
            {aiData.movers.length > 0 && (
              <ul className="space-y-1">
                {aiData.movers.map((m, i) => (
                  <li key={i} className="flex gap-2">
                    <TrendingUp className="mt-0.5 h-3 w-3 shrink-0 text-violet-400" />
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function CollectionRowView({ row }: { row: CollectionRow }) {
  return (
    <tr className="border-b border-border/20 hover:bg-muted/20">
      <td className="py-2 pr-4">
        <Link to="/colecoes" className="font-medium hover:underline">
          {row.name}
        </Link>
        <div className="text-xs text-muted-foreground">
          {[row.season, row.year].filter(Boolean).join(" · ")} · {row.status}
        </div>
      </td>
      <td className="py-2 pr-4 text-muted-foreground">{row.productsCount}</td>
      {(["fpy", "costGap", "otd", "markdown", "sellThrough"] as const).map((k) => (
        <td key={k} className="py-2 pr-4">
          <span
            className={`inline-block min-w-[64px] rounded border px-2 py-0.5 text-center text-xs ${cellClasses(
              row[k].status,
            )}`}
          >
            {formatCell(row[k])}
          </span>
        </td>
      ))}
      <td className="py-2 pr-4 text-right font-semibold">
        {row.score > 0 ? (
          <span className="inline-flex items-center gap-1 text-emerald-400">
            <TrendingUp className="h-3 w-3" />+{row.score}
          </span>
        ) : row.score < 0 ? (
          <span className="inline-flex items-center gap-1 text-red-400">
            <TrendingDown className="h-3 w-3" />
            {row.score}
          </span>
        ) : (
          <span className="text-muted-foreground">0</span>
        )}
      </td>
    </tr>
  );
}
