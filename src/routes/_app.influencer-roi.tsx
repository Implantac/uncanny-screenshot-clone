import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { Users, TrendingUp, DollarSign, Award } from "lucide-react";

export const Route = createFileRoute("/_app/influencer-roi")({
  component: InfluencerROI,
});

type Inf = {
  id: string;
  nome: string;
  instagram: string | null;
  cidade: string | null;
  estado: string | null;
  seguidores: number;
  engajamento: number;
  valor: number;
  vendas_antes: number;
  vendas_depois: number;
  uplift: number;
  upliftPct: number;
  roas: number;
  cpm: number;
  tier: "premium" | "atencao" | "ruim";
};

async function load(): Promise<Inf[]> {
  const { data } = await supabase.from("influencers").select("*").order("created_at", { ascending: false });
  return (data ?? []).map((i) => {
    const uplift = Number(i.vendas_depois) - Number(i.vendas_antes);
    const upliftPct = Number(i.vendas_antes) > 0 ? (uplift / Number(i.vendas_antes)) * 100 : 0;
    const roas = Number(i.valor) > 0 ? uplift / Number(i.valor) : 0;
    const cpm = i.seguidores > 0 ? (Number(i.valor) / i.seguidores) * 1000 : 0;
    const tier: Inf["tier"] = roas >= 3 ? "premium" : roas >= 1 ? "atencao" : "ruim";
    return {
      id: i.id, nome: i.nome, instagram: i.instagram, cidade: i.cidade, estado: i.estado,
      seguidores: i.seguidores, engajamento: Number(i.engajamento), valor: Number(i.valor),
      vendas_antes: Number(i.vendas_antes), vendas_depois: Number(i.vendas_depois),
      uplift, upliftPct, roas, cpm, tier,
    };
  }).sort((a, b) => b.roas - a.roas);
}

function InfluencerROI() {
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["influencer-roi"], queryFn: load });

  const totals = useMemo(() => ({
    count: rows.length,
    investment: rows.reduce((s, r) => s + r.valor, 0),
    uplift: rows.reduce((s, r) => s + r.uplift, 0),
    premium: rows.filter((r) => r.tier === "premium").length,
    avgRoas: rows.length > 0 ? rows.reduce((s, r) => s + r.roas, 0) / rows.length : 0,
  }), [rows]);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Influencer ROI</h1>
        <p className="text-sm text-muted-foreground">Atribuição, uplift e ROAS por influenciador.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Influencers" value={totals.count} icon={<Users className="size-4" />} />
        <KPI label="Investimento" value={fmt(totals.investment)} icon={<DollarSign className="size-4" />} />
        <KPI label="Uplift total" value={fmt(totals.uplift)} icon={<TrendingUp className="size-4" />} tone="success" />
        <KPI label="ROAS médio" value={`${totals.avgRoas.toFixed(2)}x`} icon={<Award className="size-4" />} tone="primary" />
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Tier</th>
                <th className="text-left px-3 py-2">Influencer</th>
                <th className="text-left px-3 py-2">Local</th>
                <th className="text-right px-3 py-2">Seguidores</th>
                <th className="text-right px-3 py-2">Engaj.</th>
                <th className="text-right px-3 py-2">CPM</th>
                <th className="text-right px-3 py-2">Investido</th>
                <th className="text-right px-3 py-2">Uplift</th>
                <th className="text-right px-3 py-2">Uplift %</th>
                <th className="text-right px-3 py-2">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">Carregando…</td></tr>}
              {!isLoading && rows.length === 0 && <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">Nenhum influenciador cadastrado.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      r.tier === "premium" ? "bg-success/15 text-success" :
                      r.tier === "atencao" ? "bg-warning/15 text-warning" :
                      "bg-destructive/15 text-destructive"
                    }`}>{r.tier === "premium" ? "★ Premium" : r.tier === "atencao" ? "Atenção" : "Ruim"}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.nome}</div>
                    {r.instagram && <div className="text-[10px] text-muted-foreground">@{r.instagram.replace("@", "")}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.cidade ? `${r.cidade}/${r.estado ?? ""}` : "—"}</td>
                  <td className="px-3 py-2 text-right">{r.seguidores.toLocaleString("pt-BR")}</td>
                  <td className="px-3 py-2 text-right">{r.engajamento.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{fmt(r.cpm)}</td>
                  <td className="px-3 py-2 text-right">{fmt(r.valor)}</td>
                  <td className={`px-3 py-2 text-right font-medium ${r.uplift >= 0 ? "text-success" : "text-destructive"}`}>{fmt(r.uplift)}</td>
                  <td className="px-3 py-2 text-right">{r.upliftPct > 0 ? "+" : ""}{r.upliftPct.toFixed(0)}%</td>
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
