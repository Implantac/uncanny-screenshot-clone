import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Store, ShoppingBag, Globe, Smartphone, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/omnichannel")({
  head: () => ({
    meta: [
      { title: "Omnichannel & Marketplace · USE MODA PLM" },
      { name: "description", content: "Mix de canais, sync de estoque e performance D2C/B2B/marketplace." },
    ],
  }),
  component: Omnichannel,
});

const CHANNEL_META: Record<string, { icon: typeof Store; color: string; label: string }> = {
  ecommerce: { icon: Globe, color: "text-blue-600", label: "E-commerce D2C" },
  marketplace: { icon: ShoppingBag, color: "text-purple-600", label: "Marketplace" },
  b2b: { icon: Users, color: "text-amber-600", label: "B2B / Atacado" },
  loja: { icon: Store, color: "text-green-600", label: "Loja física" },
  app: { icon: Smartphone, color: "text-pink-600", label: "App Mobile" },
};

function Omnichannel() {
  const { data, isLoading } = useQuery({
    queryKey: ["omnichannel"],
    queryFn: async () => {
      const { data: sales } = await supabase.from("sales").select("channel, quantity, total, uf, product_id, sold_at");
      const byChannel = new Map<string, { qty: number; rev: number; orders: number }>();
      const byUf = new Map<string, number>();
      (sales ?? []).forEach((s) => {
        const ch = (s.channel ?? "ecommerce").toLowerCase();
        const a = byChannel.get(ch) ?? { qty: 0, rev: 0, orders: 0 };
        a.qty += s.quantity ?? 0;
        a.rev += Number(s.total ?? 0);
        a.orders += 1;
        byChannel.set(ch, a);
        if (s.uf) byUf.set(s.uf, (byUf.get(s.uf) ?? 0) + Number(s.total ?? 0));
      });
      const totalRev = Array.from(byChannel.values()).reduce((a, v) => a + v.rev, 0) || 1;
      const channels = Array.from(byChannel.entries())
        .map(([ch, v]) => ({ ch, ...v, share: (v.rev / totalRev) * 100, ticket: v.orders ? v.rev / v.orders : 0 }))
        .sort((a, b) => b.rev - a.rev);
      const topUf = Array.from(byUf.entries()).map(([uf, rev]) => ({ uf, rev })).sort((a, b) => b.rev - a.rev).slice(0, 8);
      return { channels, topUf, totalRev };
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Globe className="h-6 w-6 text-blue-600" /> Omnichannel & Marketplace</h1>
        <p className="text-muted-foreground">Mix de receita por canal, ticket médio e geografia.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Receita total</CardDescription><CardTitle className="text-2xl">R$ {(data?.totalRev ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Canais ativos</CardDescription><CardTitle className="text-2xl">{data?.channels.length ?? 0}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>UFs atingidas</CardDescription><CardTitle className="text-2xl">{data?.topUf.length ?? 0}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Canal líder</CardDescription><CardTitle className="text-lg capitalize">{data?.channels[0]?.ch ?? "—"}</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Mix por canal</CardTitle><CardDescription>Receita, pedidos, ticket médio e share.</CardDescription></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
            <div className="space-y-3">
              {(data?.channels ?? []).map((c) => {
                const meta = CHANNEL_META[c.ch] ?? { icon: Store, color: "text-muted-foreground", label: c.ch };
                const Icon = meta.icon;
                return (
                  <div key={c.ch} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${meta.color}`} />
                        <span className="font-medium">{meta.label}</span>
                        <Badge variant="outline">{c.share.toFixed(1)}%</Badge>
                      </div>
                      <span className="text-sm font-semibold">R$ {c.rev.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${c.share}%` }} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex justify-between">
                      <span>{c.orders} pedidos · {c.qty} unid.</span>
                      <span>Ticket médio R$ {c.ticket.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                );
              })}
              {(data?.channels.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">Sem vendas registradas.</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Top UFs</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {(data?.topUf ?? []).map((u) => (
              <div key={u.uf} className="border rounded-lg p-3 flex justify-between items-center">
                <span className="font-mono font-bold">{u.uf}</span>
                <span className="text-sm">R$ {u.rev.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
