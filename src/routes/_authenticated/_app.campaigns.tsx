import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { Megaphone, Target, DollarSign, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/campaigns")({
  component: Campaigns,
});

type Camp = {
  id: string;
  name: string;
  channel: string | null;
  start_date: string | null;
  end_date: string | null;
  investment: number;
  roas: number;
  status: string;
  revenue: number;
  margin: number;
  cpa: number;
  days: number;
};

async function load(): Promise<Camp[]> {
  const { data } = await supabase.from("marketing_campaigns").select("*").order("start_date", { ascending: false, nullsFirst: false });
  const today = Date.now();
  return (data ?? []).map((c) => {
    const investment = Number(c.investment);
    const roas = Number(c.roas);
    const revenue = investment * roas;
    const margin = revenue - investment;
    const days = c.start_date && c.end_date ? Math.max(1, Math.round((new Date(c.end_date).getTime() - new Date(c.start_date).getTime()) / 86400000)) : 1;
    const cpa = roas > 0 ? investment / roas : 0;
    return { ...c, investment, roas, revenue, margin, cpa, days } as Camp;
  });
}

function Campaigns() {
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["campaigns"], queryFn: load });

  const totals = useMemo(() => {
    const inv = rows.reduce((s, r) => s + r.investment, 0);
    const rev = rows.reduce((s, r) => s + r.revenue, 0);
    return { count: rows.length, inv, rev, margin: rev - inv, avgRoas: inv > 0 ? rev / inv : 0 };
  }, [rows]);

  const byChannel = useMemo(() => {
    const m = new Map<string, { ch: string; inv: number; rev: number; count: number }>();
    rows.forEach((r) => {
      const ch = r.channel ?? "Sem canal";
      const c = m.get(ch) ?? { ch, inv: 0, rev: 0, count: 0 };
      c.inv += r.investment; c.rev += r.revenue; c.count += 1;
      m.set(ch, c);
    });
    return Array.from(m.values()).map((c) => ({ ...c, roas: c.inv > 0 ? c.rev / c.inv : 0 })).sort((a, b) => b.rev - a.rev);
  }, [rows]);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Marketing Campaigns</h1>
        <p className="text-sm text-muted-foreground">Investimento, ROAS, receita atribuída e performance por canal.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Campanhas" value={totals.count} icon={<Megaphone className="size-4" />} />
        <KPI label="Investimento" value={fmt(totals.inv)} icon={<DollarSign className="size-4" />} />
        <KPI label="Receita atribuída" value={fmt(totals.rev)} icon={<TrendingUp className="size-4" />} tone="success" />
        <KPI label="ROAS médio" value={`${totals.avgRoas.toFixed(2)}x`} icon={<Target className="size-4" />} tone="primary" />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="px-4 py-3 border-b border-border font-medium">Performance por canal</div>
        {byChannel.length === 0 ? <div className="p-6 text-sm text-muted-foreground text-center">Sem dados.</div> : (
          <div className="divide-y divide-border">
            {byChannel.map((c) => (
              <div key={c.ch} className="px-4 py-3 grid grid-cols-12 gap-3 items-center text-sm">
                <div className="col-span-12 md:col-span-3 font-medium capitalize">{c.ch}</div>
                <div className="col-span-6 md:col-span-2 text-xs text-muted-foreground">{c.count} campanhas</div>
                <div className="col-span-6 md:col-span-2 text-right md:text-left">Inv: {fmt(c.inv)}</div>
                <div className="col-span-6 md:col-span-3 text-success">Rec: {fmt(c.rev)}</div>
                <div className={`col-span-6 md:col-span-2 text-right font-semibold ${c.roas >= 3 ? "text-success" : c.roas >= 1 ? "text-warning" : "text-destructive"}`}>{c.roas.toFixed(2)}x</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Campanha</th>
                <th className="text-left px-3 py-2">Canal</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Período</th>
                <th className="text-right px-3 py-2">Invest.</th>
                <th className="text-right px-3 py-2">Receita</th>
                <th className="text-right px-3 py-2">Margem</th>
                <th className="text-right px-3 py-2">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Carregando…</td></tr>}
              {!isLoading && rows.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Nenhuma campanha cadastrada.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground capitalize">{r.channel ?? "—"}</td>
                  <td className="px-3 py-2 text-xs capitalize">{r.status}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {r.start_date ? new Date(r.start_date).toLocaleDateString("pt-BR") : "—"}
                    {r.end_date && ` → ${new Date(r.end_date).toLocaleDateString("pt-BR")}`}
                  </td>
                  <td className="px-3 py-2 text-right">{fmt(r.investment)}</td>
                  <td className="px-3 py-2 text-right text-success">{fmt(r.revenue)}</td>
                  <td className={`px-3 py-2 text-right ${r.margin >= 0 ? "text-success" : "text-destructive"}`}>{fmt(r.margin)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${r.roas >= 3 ? "text-success" : r.roas >= 1 ? "text-warning" : "text-destructive"}`}>{r.roas.toFixed(2)}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, icon, tone = "default" }: { label: string; value: number | string; icon: React.ReactNode; tone?: "default" | "success" | "primary" }) {
  const tones = { default: "", success: "text-success", primary: "text-primary" };
  return (
    <div className="rounded-xl border border-border p-4 bg-card">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">{icon}{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</div>
    </div>
  );
}

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
