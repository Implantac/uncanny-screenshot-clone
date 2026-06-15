import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { MapPin } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/geo-sales")({
  component: GeoSales,
});

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const REGIONS: Record<string, string> = {
  N: "AC AM AP PA RO RR TO", NE: "AL BA CE MA PB PE PI RN SE",
  CO: "DF GO MT MS", SE_R: "ES MG RJ SP", S: "PR RS SC",
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
  const maxRevenue = useMemo(() => Math.max(1, ...stats.map((s) => s.revenue)), [stats]);
  const sorted = useMemo(() => [...stats].sort((a, b) => b.revenue - a.revenue), [stats]);
  const totalRev = useMemo(() => stats.reduce((a, s) => a + s.revenue, 0), [stats]);

  const byRegion = useMemo(() => Object.entries(REGIONS).map(([r, list]) => {
    const ufs = list.split(" ");
    const rev = stats.filter((s) => ufs.includes(s.uf)).reduce((a, s) => a + s.revenue, 0);
    return { region: r, revenue: rev };
  }).sort((a, b) => b.revenue - a.revenue), [stats]);

  const heat = (v: number) => {
    const t = v / maxRevenue;
    if (t === 0) return "bg-muted/40 text-muted-foreground";
    if (t < 0.15) return "bg-primary/15 text-foreground";
    if (t < 0.4) return "bg-primary/35 text-foreground";
    if (t < 0.7) return "bg-primary/60 text-primary-foreground";
    return "bg-primary text-primary-foreground";
  };

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Geo Sales Analytics</h1>
        <p className="text-sm text-muted-foreground">Aceitação por estado e região nos últimos 90 dias.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {byRegion.map((r) => (
          <div key={r.region} className="rounded-xl border border-border p-3 bg-card">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Região {r.region.replace("_R", "")}</div>
            <div className="mt-1 text-xl font-semibold">{r.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</div>
            <div className="text-[11px] text-muted-foreground">{totalRev > 0 ? Math.round((r.revenue / totalRev) * 100) : 0}% do total</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4"><MapPin className="size-4 text-primary" /><span className="font-medium">Mapa de calor por UF</span></div>
        {isLoading ? <div className="text-muted-foreground">Carregando…</div> : (
          <div className="grid grid-cols-6 md:grid-cols-9 gap-2">
            {UFS.map((u) => {
              const s = stats.find((x) => x.uf === u) ?? { uf: u, revenue: 0, qty: 0, orders: 0 };
              return (
                <div key={u} className={`rounded-lg p-3 ${heat(s.revenue)}`} title={`${u}: R$ ${s.revenue.toFixed(2)} • ${s.qty} pç`}>
                  <div className="font-mono font-semibold">{u}</div>
                  <div className="text-[10px] opacity-80">{s.qty} pç</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <RankCard title="Maior aceitação" rows={sorted.slice(0, 10)} tone="success" totalRev={totalRev} />
        <RankCard title="Potencial de crescimento" rows={sorted.filter((s) => s.revenue > 0).slice(-10).reverse()} tone="warning" totalRev={totalRev} />
      </div>
    </div>
  );
}

function RankCard({ title, rows, tone, totalRev }: { title: string; rows: UFStat[]; tone: "success" | "warning"; totalRev: number }) {
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
              <span className={`text-${tone} font-medium`}>{r.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</span>
              <span className="text-xs text-muted-foreground w-10 text-right">{totalRev > 0 ? Math.round((r.revenue / totalRev) * 100) : 0}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
