import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { BRAZIL_VIEWBOX, BRAZIL_PATHS } from "@/lib/brazil-map-paths";

const searchSchema = z.object({ uf: z.string().length(2).optional().catch(undefined) });

export const Route = createFileRoute("/_authenticated/_app/geo-sales")({
  component: GeoSales,
  validateSearch: zodValidator(searchSchema),
});

const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];
const REGIONS: Record<string, string> = {
  N: "AC AM AP PA RO RR TO",
  NE: "AL BA CE MA PB PE PI RN SE",
  CO: "DF GO MT MS",
  SE_R: "ES MG RJ SP",
  S: "PR RS SC",
};

type UFStat = { uf: string; revenue: number; qty: number; orders: number };

async function loadGeo(): Promise<UFStat[]> {
  const since = new Date(Date.now() - 90 * 86400000).toISOString();
  const [{ data: nativeRows }, { data: erpRows }] = await Promise.all([
    supabase.from("sales").select("uf, quantity, total").gte("sold_at", since),
    supabase.from("erp_sales_mirror").select("region, quantity, total_value").gte("sold_at", since),
  ]);
  const map = new Map<string, UFStat>();
  UFS.forEach((u) => map.set(u, { uf: u, revenue: 0, qty: 0, orders: 0 }));
  (nativeRows ?? []).forEach((s) => {
    if (!s.uf) return;
    const cur = map.get(s.uf) ?? { uf: s.uf, revenue: 0, qty: 0, orders: 0 };
    cur.revenue += Number(s.total);
    cur.qty += s.quantity;
    cur.orders += 1;
    map.set(s.uf, cur);
  });
  (erpRows ?? []).forEach((s) => {
    const uf = (s.region ?? "").toUpperCase();
    if (!UFS.includes(uf)) return;
    const cur = map.get(uf) ?? { uf, revenue: 0, qty: 0, orders: 0 };
    cur.revenue += Number(s.total_value ?? 0);
    cur.qty += Number(s.quantity ?? 0);
    cur.orders += 1;
    map.set(uf, cur);
  });
  return Array.from(map.values());
}

function GeoSales() {
  const { data: stats = [], isLoading } = useQuery({ queryKey: ["geo-sales"], queryFn: loadGeo });
  const navigate = useNavigate({ from: Route.fullPath });
  const { uf: selectedUf } = Route.useSearch();
  const [hoverUf, setHoverUf] = useState<string | null>(null);
  const maxRevenue = useMemo(() => Math.max(1, ...stats.map((s) => s.revenue)), [stats]);
  const sorted = useMemo(() => [...stats].sort((a, b) => b.revenue - a.revenue), [stats]);
  const totalRev = useMemo(() => stats.reduce((a, s) => a + s.revenue, 0), [stats]);
  const statsByUf = useMemo(() => {
    const m = new Map<string, UFStat>();
    stats.forEach((s) => m.set(s.uf, s));
    return m;
  }, [stats]);

  const byRegion = useMemo(
    () =>
      Object.entries(REGIONS)
        .map(([r, list]) => {
          const ufs = list.split(" ");
          const rev = stats.filter((s) => ufs.includes(s.uf)).reduce((a, s) => a + s.revenue, 0);
          return { region: r, revenue: rev };
        })
        .sort((a, b) => b.revenue - a.revenue),
    [stats],
  );

  const heatFill = (v: number) => {
    const t = v / maxRevenue;
    if (t === 0) return "hsl(var(--muted) / 0.5)";
    if (t < 0.15) return "hsl(var(--primary) / 0.15)";
    if (t < 0.4) return "hsl(var(--primary) / 0.4)";
    if (t < 0.7) return "hsl(var(--primary) / 0.7)";
    return "hsl(var(--primary))";
  };

  const activeUf = hoverUf ?? selectedUf ?? null;
  const activeStat = activeUf ? statsByUf.get(activeUf) : null;
  const activeName = activeUf ? BRAZIL_PATHS.find((p) => p.uf === activeUf)?.name ?? activeUf : null;
  const setSelectedUf = (uf: string | undefined) =>
    navigate({
      search: (prev: { uf?: string }) => ({ ...prev, uf }),
      replace: true,
    });

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Geo Sales Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Aceitação por estado e região nos últimos 90 dias.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {byRegion.map((r) => (
          <div key={r.region} className="rounded-xl border border-border p-3 bg-card">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Região {r.region.replace("_R", "")}
            </div>
            <div className="mt-1 text-xl font-semibold">
              {r.revenue.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
                maximumFractionDigits: 0,
              })}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {totalRev > 0 ? Math.round((r.revenue / totalRev) * 100) : 0}% do total
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-primary" />
            <span className="font-medium">Mapa de calor por UF</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>Baixo</span>
            {[0.1, 0.3, 0.55, 0.85].map((t) => (
              <span
                key={t}
                className="inline-block w-4 h-3 rounded-sm border border-border"
                style={{ background: heatFill(t * maxRevenue) }}
              />
            ))}
            <span>Alto</span>
            {selectedUf && (
              <button
                type="button"
                onClick={() => setSelectedUf(undefined)}
                className="ml-2 px-2 py-0.5 rounded border border-border hover:bg-muted/50"
              >
                Limpar seleção
              </button>
            )}
          </div>
        </div>
        {isLoading ? (
          <div className="text-muted-foreground">Carregando…</div>
        ) : (
          <div className="grid md:grid-cols-[2fr_1fr] gap-4 items-start">
            <div className="relative">
              <svg
                viewBox={BRAZIL_VIEWBOX}
                className="w-full h-auto max-h-[520px]"
                role="img"
                aria-label="Mapa de calor de receita por UF do Brasil"
              >
                {BRAZIL_PATHS.map((p) => {
                  const s = statsByUf.get(p.uf);
                  const rev = s?.revenue ?? 0;
                  const isActive = activeUf === p.uf;
                  const isSelected = selectedUf === p.uf;
                  return (
                    <path
                      key={p.uf}
                      d={p.d}
                      fill={heatFill(rev)}
                      stroke={isSelected ? "hsl(var(--ring))" : "hsl(var(--border))"}
                      strokeWidth={isSelected ? 1.5 : isActive ? 1 : 0.5}
                      className="cursor-pointer transition-opacity hover:opacity-80 focus:outline-none"
                      tabIndex={0}
                      onMouseEnter={() => setHoverUf(p.uf)}
                      onMouseLeave={() => setHoverUf((cur) => (cur === p.uf ? null : cur))}
                      onFocus={() => setHoverUf(p.uf)}
                      onBlur={() => setHoverUf((cur) => (cur === p.uf ? null : cur))}
                      onClick={() => setSelectedUf(selectedUf === p.uf ? undefined : p.uf)}
                    >
                      <title>{`${p.uf} · ${p.name} — ${rev.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}`}</title>
                    </path>
                  );
                })}
              </svg>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm min-h-[180px]">
              {activeUf && activeStat ? (
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-lg font-semibold">{activeUf}</span>
                    <span className="text-xs text-muted-foreground">{activeName}</span>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Receita 90d</div>
                    <div className="text-xl font-semibold text-primary">
                      {activeStat.revenue.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                        maximumFractionDigits: 0,
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Peças</div>
                      <div className="font-medium">{activeStat.qty.toLocaleString("pt-BR")}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Pedidos</div>
                      <div className="font-medium">{activeStat.orders}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Share</div>
                      <div className="font-medium">
                        {totalRev > 0 ? Math.round((activeStat.revenue / totalRev) * 100) : 0}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Ticket médio</div>
                      <div className="font-medium">
                        {activeStat.orders > 0
                          ? (activeStat.revenue / activeStat.orders).toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                              maximumFractionDigits: 0,
                            })
                          : "—"}
                      </div>
                    </div>
                  </div>
                  {selectedUf === activeUf && (
                    <div className="text-[11px] text-muted-foreground pt-1">
                      UF fixada na URL · compartilhe o link
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-muted-foreground text-sm">
                  Passe o mouse ou clique em um estado para ver o resumo.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <RankCard
          title="Maior aceitação"
          rows={sorted.slice(0, 10)}
          tone="success"
          totalRev={totalRev}
        />
        <RankCard
          title="Potencial de crescimento"
          rows={sorted
            .filter((s) => s.revenue > 0)
            .slice(-10)
            .reverse()}
          tone="warning"
          totalRev={totalRev}
        />
      </div>
    </div>
  );
}

function RankCard({
  title,
  rows,
  tone,
  totalRev,
}: {
  title: string;
  rows: UFStat[];
  tone: "success" | "warning";
  totalRev: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="px-4 py-3 border-b border-border font-medium">{title}</div>
      <div className="divide-y divide-border">
        {rows.length === 0 && <div className="p-4 text-sm text-muted-foreground">Sem dados.</div>}
        {rows.map((r) => (
          <div key={r.uf} className="px-4 py-2 flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs w-8">{r.uf}</span>
              <span className="text-muted-foreground text-xs">{r.qty} pç</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-${tone} font-medium`}>
                {r.revenue.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                  maximumFractionDigits: 0,
                })}
              </span>
              <span className="text-xs text-muted-foreground w-10 text-right">
                {totalRev > 0 ? Math.round((r.revenue / totalRev) * 100) : 0}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
