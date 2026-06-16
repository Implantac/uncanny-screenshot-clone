import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, TrendingUp, TrendingDown, Sparkles } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSectors } from "@/hooks/use-sectors";

export const Route = createFileRoute("/_authenticated/_app/bi")({
  head: () => ({
    meta: [
      { title: "BI & Analytics · USE MODA OS" },
      { name: "description", content: "Dashboards customizáveis e KPIs." },
    ],
  }),
  component: BI,
});

const palette = ["oklch(0.72 0.18 295)","oklch(0.70 0.16 200)","oklch(0.74 0.17 155)","oklch(0.78 0.16 75)","oklch(0.70 0.18 25)"];
const BRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function groupCount<T>(arr: T[], key: (x: T) => string | null | undefined) {
  const m = new Map<string, number>();
  arr.forEach((x) => { const k = key(x) ?? "—"; m.set(k, (m.get(k) ?? 0) + 1); });
  return [...m.entries()].map(([name, v]) => ({ name, v })).sort((a, b) => b.v - a.v);
}

function BarPanel({ title, subtitle, data, empty }: { title: string; subtitle: string; data: { name: string; v: number }[]; empty: string }) {
  return (
    <div className="glass rounded-xl p-5">
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground mb-4">{subtitle}</div>
      {data.length === 0 ? (
        <div className="h-[240px] grid place-items-center text-xs text-muted-foreground">{empty}</div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.018 270)" vertical={false} />
            <XAxis dataKey="name" stroke="oklch(0.68 0.02 270)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="oklch(0.68 0.02 270)" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: "oklch(0.20 0.015 270)", border: "1px solid oklch(0.28 0.018 270)", borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="v" fill="oklch(0.72 0.18 295)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function BI() {
  const ordersQ = useQuery({
    queryKey: ["bi", "b2b_orders"],
    queryFn: async () => (await supabase.from("b2b_orders").select("status,total_value,order_date")).data ?? [],
  });
  const productsQ = useQuery({
    queryKey: ["bi", "products"],
    queryFn: async () => (await supabase.from("products").select("id,status,category")).data ?? [],
  });
  const finQ = useQuery({
    queryKey: ["bi", "fin"],
    queryFn: async () => (await supabase.from("financial_accounts").select("type,value,status")).data ?? [],
  });
  const prodOrdQ = useQuery({
    queryKey: ["bi", "prod_orders"],
    queryFn: async () => (await supabase.from("production_orders").select("quantity,status,stage,products(name)").limit(200)).data ?? [],
  });
  const protosQ = useQuery({
    queryKey: ["bi", "protos"],
    queryFn: async () => (await supabase.from("prototypes").select("stage")).data ?? [],
  });
  const qualityQ = useQuery({
    queryKey: ["bi", "quality"],
    queryFn: async () => (await supabase.from("quality_inspections").select("result,inspection_type")).data ?? [],
  });
  const campaignsQ = useQuery({
    queryKey: ["bi", "campaigns"],
    queryFn: async () => (await supabase.from("marketing_campaigns").select("status,budget,channel")).data ?? [],
  });
  const shipsQ = useQuery({
    queryKey: ["bi", "ships"],
    queryFn: async () => (await supabase.from("influencer_shipments").select("status,value")).data ?? [],
  });

  const orders = ordersQ.data ?? [];
  const products = productsQ.data ?? [];
  const fin = finQ.data ?? [];
  const prodOrd = prodOrdQ.data ?? [];
  const protos = protosQ.data ?? [];
  const quality = qualityQ.data ?? [];
  const campaigns = campaignsQ.data ?? [];
  const ships = shipsQ.data ?? [];

  const totalReceita = orders.reduce((s, o) => s + Number(o.total_value ?? 0), 0);
  const pedidosAtivos = orders.filter((o) => o.status !== "cancelado").length;
  const produtosAtivos = products.filter((p) => p.status === "aprovado" || p.status === "producao").length;
  const aReceber = fin.filter((f) => f.type === "receber" && f.status === "pendente").reduce((s, f) => s + Number(f.value), 0);
  const aPagar = fin.filter((f) => f.type === "pagar" && f.status === "pendente").reduce((s, f) => s + Number(f.value), 0);
  const saldo = aReceber - aPagar;

  const trend = useMemo(() => {
    const days: { d: string; v: number }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const dt = new Date(now); dt.setDate(now.getDate() - i);
      const key = dt.toISOString().slice(0, 10);
      const v = orders.filter((o) => (o.order_date ?? "").slice(0, 10) === key).reduce((s, o) => s + Number(o.total_value ?? 0), 0);
      days.push({ d: key.slice(5), v: Math.round(v) });
    }
    return days;
  }, [orders]);

  const mix = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach((o) => map.set(o.status, (map.get(o.status) ?? 0) + Number(o.total_value ?? 0)));
    return Array.from(map.entries()).map(([name, v]) => ({ name, v: Math.round(v) }));
  }, [orders]);

  const ranking = useMemo(() => {
    const map = new Map<string, number>();
    prodOrd.forEach((p: any) => {
      const name = p.products?.name ?? "Sem produto";
      map.set(name, (map.get(name) ?? 0) + Number(p.quantity ?? 0));
    });
    return Array.from(map.entries()).map(([p, v]) => ({ p, v })).sort((a, b) => b.v - a.v).slice(0, 5);
  }, [prodOrd]);

  const devByStatus = groupCount(products, (p: any) => p.status);
  const protoByStage = groupCount(protos, (p: any) => p.stage);
  const prodByStage = groupCount(prodOrd, (p: any) => p.stage);
  const prodByStatus = groupCount(prodOrd, (p: any) => p.status);
  const qualityByResult = groupCount(quality, (q: any) => q.result);
  const mktByChannel = useMemo(() => {
    const m = new Map<string, number>();
    campaigns.forEach((c: any) => m.set(c.channel ?? "—", (m.get(c.channel ?? "—") ?? 0) + Number(c.budget ?? 0)));
    return [...m.entries()].map(([name, v]) => ({ name, v: Math.round(v) })).sort((a, b) => b.v - a.v);
  }, [campaigns]);
  const mktKpis = useMemo(() => {
    const budget = campaigns.reduce((s, c: any) => s + Number(c.budget ?? 0), 0);
    const sentValue = ships.reduce((s, x: any) => s + Number(x.value ?? 0), 0);
    return { budget, sentValue, campaigns: campaigns.length, ships: ships.length };
  }, [campaigns, ships]);

  const kpis = [
    { l: "Receita B2B total", v: BRL(totalReceita), d: `${orders.length} pedidos`, up: true },
    { l: "Pedidos ativos", v: pedidosAtivos.toString(), d: "B2B", up: true },
    { l: "Produtos ativos", v: produtosAtivos.toString(), d: `${products.length} no total`, up: true },
    { l: "Saldo projetado", v: BRL(saldo), d: `${BRL(aReceber)} / ${BRL(aPagar)}`, up: saldo >= 0 },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
          <BarChart3 className="size-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">BI e Analytics</h1>
          <p className="text-sm text-muted-foreground">Dashboards e KPIs do negócio (dados reais)</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.l} className="glass rounded-xl p-5">
            <div className="text-xs text-muted-foreground">{k.l}</div>
            <div className="text-2xl font-semibold mt-1 tabular-nums">{k.v}</div>
            <div className={`text-xs mt-0.5 inline-flex items-center gap-0.5 ${k.up ? "text-success" : "text-destructive"}`}>
              {k.up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}{k.d}
            </div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="comercial" className="space-y-4">
        <TabsList>
          <TabsTrigger value="comercial">Comercial</TabsTrigger>
          <TabsTrigger value="dev">Desenvolvimento</TabsTrigger>
          <TabsTrigger value="prod">Produção</TabsTrigger>
          <TabsTrigger value="qualidade">Qualidade</TabsTrigger>
          <TabsTrigger value="marketing">Marketing</TabsTrigger>
        </TabsList>

        <TabsContent value="comercial" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 glass rounded-xl p-5">
              <div className="text-sm font-semibold">Tendência de receita B2B (30d)</div>
              <div className="text-xs text-muted-foreground mb-4">Receita por dia (R$)</div>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.018 270)" vertical={false} />
                  <XAxis dataKey="d" stroke="oklch(0.68 0.02 270)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="oklch(0.68 0.02 270)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "oklch(0.20 0.015 270)", border: "1px solid oklch(0.28 0.018 270)", borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="v" stroke="oklch(0.72 0.18 295)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="glass rounded-xl p-5">
              <div className="text-sm font-semibold">Mix por status de pedido</div>
              <div className="text-xs text-muted-foreground mb-4">Receita por status</div>
              {mix.length === 0 ? (
                <div className="h-[240px] grid place-items-center text-xs text-muted-foreground">Sem dados</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={mix} dataKey="v" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {mix.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "oklch(0.20 0.015 270)", border: "1px solid oklch(0.28 0.018 270)", borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="space-y-1.5 mt-2">
                {mix.map((c, i) => (
                  <div key={c.name} className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: palette[i % palette.length] }} />{c.name}</span>
                    <span className="tabular-nums text-muted-foreground">{BRL(c.v)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="dev" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BarPanel title="Produtos por status" subtitle="Pipeline de desenvolvimento" data={devByStatus} empty="Sem produtos" />
            <BarPanel title="Protótipos por etapa" subtitle="Onde está cada protótipo" data={protoByStage} empty="Sem protótipos" />
          </div>
        </TabsContent>

        <TabsContent value="prod" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BarPanel title="OPs por etapa" subtitle="Distribuição operacional" data={prodByStage} empty="Sem ordens" />
            <BarPanel title="OPs por status" subtitle="Estado das ordens" data={prodByStatus} empty="Sem ordens" />
          </div>
          <div className="glass rounded-xl p-5">
            <div className="text-sm font-semibold">Top 5 produtos por quantidade em produção</div>
            <div className="text-xs text-muted-foreground mb-4">Soma das ordens de produção</div>
            {ranking.length === 0 ? (
              <div className="h-[220px] grid place-items-center text-xs text-muted-foreground">Sem ordens de produção</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={ranking} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.018 270)" horizontal={false} />
                  <XAxis type="number" stroke="oklch(0.68 0.02 270)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="p" stroke="oklch(0.68 0.02 270)" fontSize={11} tickLine={false} axisLine={false} width={150} />
                  <Tooltip contentStyle={{ background: "oklch(0.20 0.015 270)", border: "1px solid oklch(0.28 0.018 270)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="v" fill="oklch(0.72 0.18 295)" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </TabsContent>

        <TabsContent value="qualidade" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BarPanel title="Inspeções por resultado" subtitle="Aprovadas / reprovadas / pendentes" data={qualityByResult} empty="Sem inspeções" />
            <div className="glass rounded-xl p-5">
              <div className="text-sm font-semibold">Resumo</div>
              <div className="text-xs text-muted-foreground mb-4">Total de inspeções: {quality.length}</div>
              <ul className="space-y-2 text-sm">
                {qualityByResult.map((q) => (
                  <li key={q.name} className="flex justify-between"><span className="capitalize">{q.name}</span><span className="tabular-nums text-muted-foreground">{q.v}</span></li>
                ))}
              </ul>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="marketing" className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass rounded-xl p-5"><div className="text-xs text-muted-foreground">Campanhas</div><div className="text-2xl font-semibold mt-1 tabular-nums">{mktKpis.campaigns}</div></div>
            <div className="glass rounded-xl p-5"><div className="text-xs text-muted-foreground">Orçamento total</div><div className="text-2xl font-semibold mt-1 tabular-nums">{BRL(mktKpis.budget)}</div></div>
            <div className="glass rounded-xl p-5"><div className="text-xs text-muted-foreground">Envios influenciadores</div><div className="text-2xl font-semibold mt-1 tabular-nums">{mktKpis.ships}</div></div>
            <div className="glass rounded-xl p-5"><div className="text-xs text-muted-foreground">Valor enviado</div><div className="text-2xl font-semibold mt-1 tabular-nums">{BRL(mktKpis.sentValue)}</div></div>
          </div>
          <BarPanel title="Investimento por canal" subtitle="Orçamento somado por canal" data={mktByChannel} empty="Sem campanhas" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
