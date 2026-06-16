import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, MapPin, Package, Brain, Loader2, Radio, Download, TrendingUp, TrendingDown, Repeat, XCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList, PieChart, Pie, Legend } from "recharts";
import { Markdown } from "@/components/markdown";

type Verdict = "repetir" | "apostar" | "avaliar" | "abandonar";
const VERDICT_META: Record<Verdict, { label: string; cls: string; icon: typeof Repeat; reason: (m: number, share: number) => string }> = {
  repetir:   { label: "Repetir",      cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", icon: Repeat,        reason: (m, s) => `Campeão: ${s.toFixed(1)}% da receita, momentum +${(m * 100).toFixed(0)}%` },
  apostar:   { label: "Apostar +",    cls: "bg-primary/15 text-primary border-primary/30",             icon: TrendingUp,    reason: (m) => `Em alta: vendas recentes +${(m * 100).toFixed(0)}% vs período anterior` },
  avaliar:   { label: "Avaliar",      cls: "bg-amber-500/15 text-amber-600 border-amber-500/30",       icon: TrendingDown,  reason: (m) => `Estável/em queda leve (${(m * 100).toFixed(0)}%) — testar campanha antes de repor` },
  abandonar: { label: "Abandonar",    cls: "bg-destructive/15 text-destructive border-destructive/30", icon: XCircle,       reason: (m) => `Queda forte (${(m * 100).toFixed(0)}%) e baixa relevância — não repor` },
};
function classify(momentum: number, share: number): Verdict {
  if (share >= 8 && momentum >= 0) return "repetir";
  if (momentum >= 0.2) return "apostar";
  if (momentum <= -0.4 && share < 3) return "abandonar";
  return "avaliar";
}
import { recommendStrategy } from "@/lib/marketing-ai.functions";
import { exportToPdf } from "@/lib/pdf";
import { toast } from "sonner";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const CHANNEL_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

type SaleRow = {
  product_id: string | null;
  channel: string;
  uf: string | null;
  quantity: number;
  total: number;
  sold_at: string;
  products: { name: string } | null;
};

export function MarketingIntelligence() {
  const [days, setDays] = useState<30 | 90 | 365>(90);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [aiOutput, setAiOutput] = useState<string>("");

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["marketing-sales", days],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
      const { data, error } = await supabase
        .from("sales")
        .select("product_id, channel, uf, quantity, total, sold_at, products(name)")
        .gte("sold_at", cutoff)
        .order("sold_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as SaleRow[];
    },
  });

  const topProducts = useMemo(() => {
    const m = new Map<string, { name: string; units: number; revenue: number }>();
    sales.forEach((s) => {
      const name = s.products?.name ?? "Sem produto";
      const cur = m.get(name) ?? { name, units: 0, revenue: 0 };
      cur.units += s.quantity;
      cur.revenue += Number(s.total);
      m.set(name, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [sales]);

  const regionsForSelected = useMemo(() => {
    const filtered = selectedProduct
      ? sales.filter((s) => (s.products?.name ?? "Sem produto") === selectedProduct)
      : sales;
    const m = new Map<string, { uf: string; units: number; revenue: number }>();
    filtered.forEach((s) => {
      const uf = s.uf ?? "N/D";
      const cur = m.get(uf) ?? { uf, units: 0, revenue: 0 };
      cur.units += s.quantity;
      cur.revenue += Number(s.total);
      m.set(uf, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [sales, selectedProduct]);

  const topChannelFor = (product: string, region: string) => {
    const filt = sales.filter(
      (s) => (s.products?.name ?? "Sem produto") === product && (s.uf ?? "N/D") === region,
    );
    const m = new Map<string, number>();
    filt.forEach((s) => m.set(s.channel, (m.get(s.channel) ?? 0) + Number(s.total)));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  };

  const channelMix = useMemo(() => {
    const filt = sales.filter((s) => {
      if (selectedProduct && (s.products?.name ?? "Sem produto") !== selectedProduct) return false;
      if (selectedRegion && (s.uf ?? "N/D") !== selectedRegion) return false;
      return true;
    });
    const m = new Map<string, number>();
    filt.forEach((s) => m.set(s.channel, (m.get(s.channel) ?? 0) + Number(s.total)));
    const total = Array.from(m.values()).reduce((a, b) => a + b, 0) || 1;
    return Array.from(m.entries())
      .map(([name, value]) => ({ name, value, pct: (value / total) * 100 }))
      .sort((a, b) => b.value - a.value);
  }, [sales, selectedProduct, selectedRegion]);

  const runStrategy = useServerFn(recommendStrategy);
  const aiMut = useMutation({
    mutationFn: async () => {
      if (!selectedProduct || !selectedRegion) throw new Error("Selecione produto e região");
      const filt = sales.filter(
        (s) =>
          (s.products?.name ?? "Sem produto") === selectedProduct &&
          (s.uf ?? "N/D") === selectedRegion,
      );
      const units = filt.reduce((a, b) => a + b.quantity, 0);
      const revenue = filt.reduce((a, b) => a + Number(b.total), 0);
      const topChannel = topChannelFor(selectedProduct, selectedRegion);
      const res = await runStrategy({
        data: { product: selectedProduct, region: selectedRegion, units, revenue, topChannel },
      });
      return res.text;
    },
    onSuccess: (text) => setAiOutput(text),
    onError: (e: Error) => toast.error(e.message),
  });

  const tooltipStyle = {
    backgroundColor: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 12,
    color: "var(--card-foreground)",
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando dados de vendas…</div>;
  }
  if (sales.length === 0) {
    return (
      <div className="glass rounded-xl p-12 text-center">
        <Brain className="size-10 text-primary mx-auto mb-3" />
        <h3 className="font-semibold mb-1">Sem dados de vendas</h3>
        <p className="text-sm text-muted-foreground">
          Registre vendas no módulo de Vendas para gerar inteligência de marketing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mr-1 font-semibold">
          Janela
        </span>
        {([30, 90, 365] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1 rounded-md text-xs font-medium border transition-all ${
              days === d
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {d === 365 ? "12M" : `${d}D`}
          </button>
        ))}
        <span className="text-[11px] text-muted-foreground ml-2">
          {sales.length.toLocaleString("pt-BR")} vendas analisadas
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-5">
          <div className="text-sm font-semibold inline-flex items-center gap-1.5 mb-1">
            <Package className="size-4 text-primary" />
            Em quais produtos apostar
          </div>
          <div className="text-[11px] text-muted-foreground mb-4">
            Top produtos por receita · clique para selecionar
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={topProducts} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis
                type="number"
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={120}
                tickFormatter={(v: string) => (v.length > 16 ? v.slice(0, 16) + "…" : v)}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                formatter={(v: number, n: string) => (n === "revenue" ? [brl(v), "Receita"] : [v, "Unidades"])}
              />
              <Bar
                dataKey="revenue"
                radius={[0, 4, 4, 0]}
                onClick={(d: { name?: string }) => d?.name && setSelectedProduct(d.name)}
                cursor="pointer"
              >
                {topProducts.map((p) => (
                  <Cell
                    key={p.name}
                    fill={selectedProduct === p.name ? "var(--primary)" : "#3b82f6"}
                    fillOpacity={selectedProduct === p.name ? 1 : 0.7}
                  />
                ))}
                <LabelList dataKey="units" position="right" fontSize={10} fill="var(--muted-foreground)" formatter={(v: number) => `${v}u`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass rounded-xl p-5">
          <div className="text-sm font-semibold inline-flex items-center gap-1.5 mb-1">
            <MapPin className="size-4 text-primary" />
            Onde {selectedProduct ? `"${selectedProduct.slice(0, 22)}"` : "tudo"} mais vende
          </div>
          <div className="text-[11px] text-muted-foreground mb-4">
            Top UFs por receita · clique para selecionar
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={regionsForSelected} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="uf" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                formatter={(v: number, n: string) => (n === "revenue" ? [brl(v), "Receita"] : [v, "Unidades"])}
              />
              <Bar
                dataKey="revenue"
                radius={[4, 4, 0, 0]}
                onClick={(d: { uf?: string }) => d?.uf && setSelectedRegion(d.uf)}
                cursor="pointer"
              >
                {regionsForSelected.map((r) => (
                  <Cell
                    key={r.uf}
                    fill={selectedRegion === r.uf ? "var(--primary)" : "#10b981"}
                    fillOpacity={selectedRegion === r.uf ? 1 : 0.7}
                  />
                ))}
                <LabelList dataKey="units" position="top" fontSize={10} fill="var(--muted-foreground)" formatter={(v: number) => `${v}u`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass rounded-xl p-5">
        <div className="text-sm font-semibold inline-flex items-center gap-1.5 mb-1">
          <Radio className="size-4 text-primary" />
          Mix de canais {selectedProduct || selectedRegion ? "para a seleção" : "(geral)"}
        </div>
        <div className="text-[11px] text-muted-foreground mb-4">
          Onde sua receita está vindo {selectedProduct ? `· produto: ${selectedProduct}` : ""} {selectedRegion ? `· UF: ${selectedRegion}` : ""}
        </div>
        {channelMix.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Sem dados de canal para a seleção.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 items-center">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={channelMix} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {channelMix.map((_, i) => (
                    <Cell key={i} fill={CHANNEL_COLORS[i % CHANNEL_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => brl(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {channelMix.map((c, i) => (
                <div key={c.name} className="flex items-center gap-3 text-sm">
                  <span className="size-2.5 rounded-full shrink-0" style={{ background: CHANNEL_COLORS[i % CHANNEL_COLORS.length] }} />
                  <span className="font-medium flex-1 truncate">{c.name}</span>
                  <span className="text-muted-foreground tabular-nums">{brl(c.value)}</span>
                  <span className="text-xs font-semibold w-12 text-right tabular-nums">{c.pct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="glass rounded-xl p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div>
            <div className="text-sm font-semibold inline-flex items-center gap-1.5">
              <Brain className="size-4 text-primary" />
              Estratégia de marketing recomendada por IA
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {selectedProduct && selectedRegion
                ? `Para "${selectedProduct}" em ${selectedRegion}`
                : "Selecione um produto e uma região nos gráficos acima"}
            </div>
          </div>
          <div className="flex gap-2">
            {aiOutput && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  exportToPdf(
                    `estrategia-${selectedProduct}-${selectedRegion}`,
                    `Estratégia de Marketing · ${selectedProduct} · ${selectedRegion}`,
                    [{ secao: "Recomendação da IA", conteudo: aiOutput }],
                    [{ key: "secao", label: "Seção" }, { key: "conteudo", label: "Conteúdo" }],
                  );
                  toast.success("PDF gerado");
                }}
              >
                <Download className="size-4" /> PDF
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => aiMut.mutate()}
              disabled={!selectedProduct || !selectedRegion || aiMut.isPending}
              className="gap-2 shadow-[var(--shadow-glow)]"
            >
              {aiMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {aiMut.isPending ? "Gerando…" : "Gerar estratégia"}
            </Button>
          </div>
        </div>

        {aiOutput ? (
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm prose prose-sm dark:prose-invert max-w-none">
            <Markdown content={aiOutput} />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            A IA analisa unidades vendidas, receita e canal dominante para sugerir público, canais, criativo, oferta e KPIs.
          </div>
        )}
      </div>
    </div>
  );
}
