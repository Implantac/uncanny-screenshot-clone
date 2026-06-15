import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Workflow, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_app/approvals")({
  head: () => ({
    meta: [
      { title: "Workflow de Aprovações · USE MODA PLM" },
      { name: "description", content: "Gates de coleção, ficha técnica, piloto e liberação para produção." },
    ],
  }),
  component: Approvals,
});

type Gate = {
  key: string;
  title: string;
  description: string;
  items: { id: string; label: string; sub?: string; status: string; href: string }[];
};

function Approvals() {
  const { data, isLoading } = useQuery({
    queryKey: ["approvals-workflow"],
    queryFn: async (): Promise<Gate[]> => {
      const [cols, fichas, protos, pos] = await Promise.all([
        supabase.from("collections").select("id, name, season, year, status").order("year", { ascending: false }),
        supabase.from("tech_sheets").select("id, version, status, product_id, products(name, sku)").order("created_at", { ascending: false }).limit(50),
        supabase.from("prototypes").select("id, code, stage, product_id, products(name)").order("created_at", { ascending: false }).limit(50),
        supabase.from("production_orders").select("id, code, status, stage, quantity").order("created_at", { ascending: false }).limit(50),
      ]);

      return [
        {
          key: "colecao", title: "1. Coleção", description: "Aprovação do briefing e cronograma.",
          items: (cols.data ?? []).filter((c) => c.status === "planejamento" || c.status === "desenvolvimento")
            .map((c) => ({ id: c.id, label: c.name, sub: `${c.season} ${c.year}`, status: c.status, href: "/colecoes" })),
        },
        {
          key: "ficha", title: "2. Ficha Técnica", description: "Engenharia aprovada por produto.",
          items: (fichas.data ?? []).filter((f) => f.status !== "aprovada")
            .map((f) => ({ id: f.id, label: (f as { products?: { name: string } }).products?.name ?? "—", sub: `v${f.version}`, status: f.status, href: "/ficha-tecnica" })),
        },
        {
          key: "piloto", title: "3. Piloto", description: "Prova aprovada antes de produzir.",
          items: (protos.data ?? []).filter((p) => p.stage === "piloto" || p.stage === "aprovacao")
            .map((p) => ({ id: p.id, label: (p as { products?: { name: string } }).products?.name ?? p.code, sub: p.code, status: p.stage, href: "/pilots" })),
        },
        {
          key: "producao", title: "4. Liberação p/ Produção", description: "OPs aguardando início.",
          items: (pos.data ?? []).filter((o) => o.status === "aguardando" || o.stage === "cad")
            .map((o) => ({ id: o.id, label: o.code, sub: `${o.quantity} pç`, status: o.status, href: "/pcp" })),
        },
      ];
    },
  });

  const totalPending = (data ?? []).reduce((acc, g) => acc + g.items.length, 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Workflow className="h-6 w-6 text-amber-600" /> Workflow de Aprovações</h1>
        <p className="text-muted-foreground">PLM como sistema de gates — nada avança sem aprovação.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(data ?? []).map((g) => (
          <Card key={g.key}>
            <CardHeader className="pb-2">
              <CardDescription>{g.title}</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                {g.items.length === 0 ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Clock className="h-5 w-5 text-orange-600" />}
                {g.items.length}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fila por gate</CardTitle>
          <CardDescription>{totalPending} itens aguardando aprovação no PLM.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (data ?? []).map((g) => (
            <div key={g.key}>
              <div className="font-semibold mb-2 flex items-center gap-2">{g.title} <span className="text-xs text-muted-foreground">— {g.description}</span></div>
              <div className="space-y-2">
                {g.items.slice(0, 8).map((it) => (
                  <Link key={it.id} to={it.href} className="flex items-center justify-between border rounded-lg px-3 py-2 hover:bg-muted">
                    <div>
                      <div className="text-sm font-medium">{it.label}</div>
                      {it.sub && <div className="text-xs text-muted-foreground">{it.sub}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{it.status}</Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
                {g.items.length === 0 && <p className="text-sm text-green-600">✓ Nada pendente nesse gate.</p>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
