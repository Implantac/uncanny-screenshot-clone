import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { Route as RouteIcon, TrendingUp, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/attribution")({
  component: Attribution,
});

type Sale = { channel: string; quantity: number; total: number; sold_at: string };
type Inf = { valor: number; vendas_antes: number; vendas_depois: number };

const CHANNEL_LABELS: Record<string, { label: string; color: string }> = {
  ecommerce: { label: "E-commerce", color: "bg-blue-500" },
  instagram: { label: "Instagram", color: "bg-pink-500" },
  tiktok: { label: "TikTok", color: "bg-purple-500" },
  google: { label: "Google", color: "bg-amber-500" },
  marketplace: { label: "Marketplace", color: "bg-emerald-500" },
  influencer: { label: "Influenciadores", color: "bg-rose-500" },
  representante: { label: "Representantes", color: "bg-cyan-500" },
  loja: { label: "Loja física", color: "bg-slate-500" },
};

function labelFor(c: string) {
  return CHANNEL_LABELS[c]?.label ?? c;
}
function colorFor(c: string) {
  return CHANNEL_LABELS[c]?.color ?? "bg-muted-foreground";
}

async function load() {
  const [{ data: sales }, { data: influencers }] = await Promise.all([
    supabase.from("sales").select("channel, quantity, total, sold_at"),
    supabase.from("influencers").select("valor, vendas_antes, vendas_depois"),
  ]);
  return { sales: (sales ?? []) as Sale[], influencers: (influencers ?? []) as Inf[] };
}

function Attribution() {
  const { data, isLoading } = useQuery({ queryKey: ["attribution"], queryFn: load });
  const sales = useMemo(() => data?.sales ?? [], [data?.sales]);
  const influencers = data?.influencers ?? [];

  const byChannel = useMemo(() => {
    const m = new Map<
      string,
      { channel: string; revenue: number; orders: number; units: number }
    >();
    sales.forEach((s) => {
      const c = m.get(s.channel) ?? { channel: s.channel, revenue: 0, orders: 0, units: 0 };
      c.revenue += Number(s.total);
      c.orders += 1;
      c.units += s.quantity;
      m.set(s.channel, c);
    });
    return Array.from(m.values()).sort((a, b) => b.revenue - a.revenue);
  }, [sales]);

  const total = byChannel.reduce((s, c) => s + c.revenue, 0);

  const infUplift = influencers.reduce(
    (s, i) => s + (Number(i.vendas_depois) - Number(i.vendas_antes)),
    0,
  );
  const infInvest = influencers.reduce((s, i) => s + Number(i.valor), 0);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Marketing Attribution</h1>
        <p className="text-sm text-muted-foreground">
          Origem da receita por canal: e-commerce, social, influenciadores, marketplace,
          representantes.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI
          label="Receita total"
          value={`R$ ${total.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`}
          icon={<TrendingUp className="size-4" />}
          tone="primary"
        />
        <KPI
          label="Canais ativos"
          value={byChannel.length}
          icon={<RouteIcon className="size-4" />}
        />
        <KPI
          label="Uplift de influenciadores"
          value={`R$ ${infUplift.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`}
          icon={<Users className="size-4" />}
          tone="success"
        />
        <KPI
          label="ROI influenciadores"
          value={infInvest > 0 ? `${((infUplift / infInvest) * 100).toFixed(0)}%` : "—"}
          icon={<TrendingUp className="size-4" />}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="font-medium">Mix de receita por canal</div>
        {total === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            Sem vendas registradas.
          </div>
        ) : (
          <>
            <div className="flex w-full h-3 rounded-full overflow-hidden bg-muted">
              {byChannel.map((c) => (
                <div
                  key={c.channel}
                  className={colorFor(c.channel)}
                  style={{ width: `${(c.revenue / total) * 100}%` }}
                  title={labelFor(c.channel)}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              {byChannel.map((c) => (
                <div key={c.channel} className="flex items-center gap-1.5">
                  <span className={`size-2.5 rounded-full ${colorFor(c.channel)}`} />
                  <span>
                    {labelFor(c.channel)} · {((c.revenue / total) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border font-medium">Detalhe por canal</div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs">
            <tr>
              <th className="text-left px-3 py-2">Canal</th>
              <th className="text-right px-3 py-2">Pedidos</th>
              <th className="text-right px-3 py-2">Unidades</th>
              <th className="text-right px-3 py-2">Receita</th>
              <th className="text-right px-3 py-2">Ticket médio</th>
              <th className="text-right px-3 py-2">Share</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            ) : byChannel.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  Sem dados.
                </td>
              </tr>
            ) : (
              byChannel.map((c) => (
                <tr key={c.channel} className="border-t border-border">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={`size-2.5 rounded-full ${colorFor(c.channel)}`} />
                      {labelFor(c.channel)}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.orders}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.units}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    R$ {c.revenue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    R$ {c.orders > 0 ? (c.revenue / c.orders).toFixed(0) : "0"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {((c.revenue / total) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KPI({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone?: "default" | "primary" | "success";
}) {
  const toneCls =
    tone === "primary"
      ? "text-primary"
      : tone === "success"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div className={`text-2xl font-semibold mt-1 ${toneCls}`}>{value}</div>
    </div>
  );
}
