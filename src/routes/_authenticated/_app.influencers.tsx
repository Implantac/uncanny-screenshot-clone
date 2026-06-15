import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { Users, Instagram, TrendingUp, DollarSign } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/influencers")({
  validateSearch: zodValidator(z.object({ q: fallback(z.string().trim().max(80), "").default("") })),
  component: Influencers,
});

type Inf = {
  id: string; nome: string; instagram: string | null; tiktok: string | null; cidade: string | null; estado: string | null;
  segmento: string | null; seguidores: number; engajamento: number; valor: number; vendas_antes: number; vendas_depois: number;
  data_postagem: string | null; foto_url: string | null;
};

async function load() {
  const { data } = await supabase.from("influencers").select("*").order("seguidores", { ascending: false });
  return (data ?? []) as Inf[];
}

function Influencers() {
  const { data: influencers = [], isLoading } = useQuery({ queryKey: ["influencers"], queryFn: load });
  const { q } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const setQ = (v: string) => navigate({ search: (p: { q: string }) => ({ ...p, q: v }), replace: true });

  const filtered = useMemo(() => influencers.filter((i) =>
    !q || i.nome.toLowerCase().includes(q.toLowerCase()) ||
    (i.segmento ?? "").toLowerCase().includes(q.toLowerCase()) ||
    (i.cidade ?? "").toLowerCase().includes(q.toLowerCase())
  ), [influencers, q]);

  const summary = useMemo(() => {
    const totalSeg = influencers.reduce((s, i) => s + i.seguidores, 0);
    const invest = influencers.reduce((s, i) => s + Number(i.valor), 0);
    const uplift = influencers.reduce((s, i) => s + (Number(i.vendas_depois) - Number(i.vendas_antes)), 0);
    const avgEng = influencers.length ? influencers.reduce((s, i) => s + Number(i.engajamento), 0) / influencers.length : 0;
    return { count: influencers.length, totalSeg, invest, uplift, avgEng };
  }, [influencers]);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Influencer Management</h1>
        <p className="text-sm text-muted-foreground">Cadastro completo de criadores, segmentos, cidades e uplift de vendas.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Influenciadores" value={summary.count} icon={<Users className="size-4" />} />
        <KPI label="Alcance total" value={summary.totalSeg.toLocaleString("pt-BR")} icon={<Instagram className="size-4" />} tone="primary" />
        <KPI label="Investido" value={`R$ ${summary.invest.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`} icon={<DollarSign className="size-4" />} />
        <KPI label="Uplift de vendas" value={`R$ ${summary.uplift.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`} icon={<TrendingUp className="size-4" />} tone={summary.uplift >= 0 ? "success" : "destructive"} />
      </div>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, segmento ou cidade…" className="w-full md:max-w-md px-3 py-2 text-sm bg-card border border-border rounded-lg" />

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs">
            <tr>
              <th className="text-left px-3 py-2">Criador</th>
              <th className="text-left px-3 py-2">Segmento</th>
              <th className="text-left px-3 py-2">Local</th>
              <th className="text-right px-3 py-2">Seguidores</th>
              <th className="text-right px-3 py-2">Engaj.</th>
              <th className="text-right px-3 py-2">Investido</th>
              <th className="text-right px-3 py-2">Uplift</th>
              <th className="text-right px-3 py-2">ROI</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Carregando…</td></tr> :
              filtered.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Sem influenciadores.</td></tr> :
              filtered.map((i) => {
                const uplift = Number(i.vendas_depois) - Number(i.vendas_antes);
                const roi = Number(i.valor) > 0 ? (uplift / Number(i.valor)) * 100 : 0;
                return (
                  <tr key={i.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {i.foto_url ? <img src={i.foto_url} alt="" className="size-8 rounded-full object-cover" /> :
                          <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs">{i.nome[0]}</div>}
                        <div>
                          <div className="font-medium">{i.nome}</div>
                          {i.instagram && <div className="text-xs text-muted-foreground">@{i.instagram}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{i.segmento ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{[i.cidade, i.estado].filter(Boolean).join(", ") || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{i.seguidores.toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Number(i.engajamento).toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right tabular-nums">R$ {Number(i.valor).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${uplift >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>R$ {uplift.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{roi.toFixed(0)}%</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KPI({ label, value, icon, tone = "default" }: { label: string; value: string | number; icon: React.ReactNode; tone?: "default" | "primary" | "success" | "destructive" }) {
  const toneCls = tone === "primary" ? "text-primary" : tone === "success" ? "text-emerald-600 dark:text-emerald-400" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{label}</span>{icon}</div>
      <div className={`text-2xl font-semibold mt-1 ${toneCls}`}>{value}</div>
    </div>
  );
}
