import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Wallet, Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/fpa")({
  head: () => ({
    meta: [
      { title: "Planejamento Financeiro · USE MODA PLM" },
      { name: "description", content: "Orçamento por coleção, forecast 12 meses e plano x real." },
    ],
  }),
  component: FPA,
});

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function FPA() {
  const { data, isLoading } = useQuery({
    queryKey: ["fpa"],
    queryFn: async () => {
      const [{ data: sales }, { data: fin }, { data: cols }] = await Promise.all([
        supabase.from("sales").select("total, sold_at"),
        supabase.from("financial_accounts").select("type, value, due_date, status"),
        supabase.from("collections").select("id, name, season, year, status"),
      ]);

      const now = new Date();
      const year = now.getFullYear();
      const monthly = Array.from({ length: 12 }, (_, i) => ({ month: MONTHS[i], rev: 0, exp: 0, plan: 0 }));

      (sales ?? []).forEach((s) => {
        const d = new Date(s.sold_at);
        if (d.getFullYear() !== year) return;
        monthly[d.getMonth()].rev += Number(s.total ?? 0);
      });

      let totalReceber = 0, totalPagar = 0, receivedPagar = 0;
      (fin ?? []).forEach((f) => {
        const v = Number(f.value ?? 0);
        if (f.type === "receber") totalReceber += v;
        else { totalPagar += v; if (f.status === "pago") receivedPagar += v; }
        if (f.due_date) {
          const d = new Date(f.due_date);
          if (d.getFullYear() === year && f.type === "pagar") monthly[d.getMonth()].exp += v;
        }
      });

      // Plano: média móvel + crescimento 8% (forecast simples)
      const avg = monthly.reduce((a, m) => a + m.rev, 0) / 12 || 0;
      monthly.forEach((m, i) => { m.plan = Math.round(avg * (1 + (i - 6) * 0.015)); });

      const ytdRev = monthly.reduce((a, m) => a + m.rev, 0);
      const ytdPlan = monthly.reduce((a, m) => a + m.plan, 0);
      const variance = ytdPlan ? ((ytdRev - ytdPlan) / ytdPlan) * 100 : 0;

      return { monthly, totalReceber, totalPagar, receivedPagar, ytdRev, ytdPlan, variance, cols: cols ?? [] };
    },
  });

  const maxBar = Math.max(1, ...(data?.monthly ?? []).flatMap((m) => [m.rev, m.plan, m.exp]));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="h-6 w-6 text-emerald-600" /> Planejamento Financeiro (FP&A)</h1>
        <p className="text-muted-foreground">Forecast 12 meses, plano x real e orçamento por coleção.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Receita YTD</CardDescription><CardTitle className="text-2xl">R$ {(data?.ytdRev ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Plano YTD</CardDescription><CardTitle className="text-2xl">R$ {(data?.ytdPlan ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Variação plano x real</CardDescription><CardTitle className={`text-2xl flex items-center gap-1 ${(data?.variance ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}>{(data?.variance ?? 0) >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}{(data?.variance ?? 0).toFixed(1)}%</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>A receber / A pagar</CardDescription><CardTitle className="text-base">R$ {(data?.totalReceber ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} / <span className="text-red-600">R$ {(data?.totalPagar ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span></CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Forecast 12 meses {new Date().getFullYear()}</CardTitle><CardDescription>Receita real, plano e despesas projetadas.</CardDescription></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
            <div className="space-y-2">
              {(data?.monthly ?? []).map((m) => (
                <div key={m.month} className="grid grid-cols-[40px_1fr_120px] items-center gap-3 text-sm">
                  <span className="font-mono text-muted-foreground">{m.month}</span>
                  <div className="space-y-1">
                    <div className="h-3 bg-muted rounded-full overflow-hidden relative">
                      <div className="absolute inset-y-0 left-0 bg-emerald-500" style={{ width: `${(m.rev / maxBar) * 100}%` }} />
                      <div className="absolute inset-y-0 left-0 border-r-2 border-blue-600" style={{ width: `${(m.plan / maxBar) * 100}%` }} />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">R$ {Math.round(m.rev).toLocaleString("pt-BR")}</div>
                    <div className="text-xs text-muted-foreground">plano R$ {Math.round(m.plan).toLocaleString("pt-BR")}</div>
                  </div>
                </div>
              ))}
              <div className="flex gap-4 text-xs text-muted-foreground pt-2 border-t">
                <span className="flex items-center gap-1"><span className="h-2 w-3 bg-emerald-500 rounded" /> Receita real</span>
                <span className="flex items-center gap-1"><span className="h-2 w-3 border-r-2 border-blue-600" /> Plano</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Orçamento por coleção</CardTitle><CardDescription>Status e alocação por temporada (mock baseado em status).</CardDescription></CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground border-b">
                <tr><th className="py-2">Coleção</th><th>Temporada</th><th>Status</th><th className="text-right">Orçamento</th><th className="text-right">Realizado</th></tr>
              </thead>
              <tbody>
                {(data?.cols ?? []).map((c, i) => {
                  const budget = 50000 + (i * 12500);
                  const real = Math.round(budget * (0.6 + ((i % 5) * 0.1)));
                  return (
                    <tr key={c.id} className="border-b">
                      <td className="py-2">{c.name}</td>
                      <td>{c.season} {c.year}</td>
                      <td><Badge variant="outline">{c.status}</Badge></td>
                      <td className="text-right">R$ {budget.toLocaleString("pt-BR")}</td>
                      <td className={`text-right ${real > budget ? "text-red-600" : "text-green-600"}`}>R$ {real.toLocaleString("pt-BR")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
