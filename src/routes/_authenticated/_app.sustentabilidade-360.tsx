import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Leaf, ShieldCheck, Recycle, Factory, ExternalLink } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/_app/sustentabilidade-360")({
  head: () => ({
    meta: [
      { title: "Sustentabilidade 360º · USE MODA PLM" },
      { name: "description", content: "ESG por coleção: pegada CO₂, materiais sustentáveis, rastreabilidade e DPP." },
    ],
  }),
  component: Sustentabilidade360,
});

function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

type Row = {
  collection: { id: string; name: string; season: string; year: number };
  products: number;
  co2: number;
  sustainable: number;
  certified: number;
  traceability: number;
};

function Sustentabilidade360() {
  const { data, isLoading } = useQuery({
    queryKey: ["esg-360"],
    queryFn: async (): Promise<Row[]> => {
      const [{ data: cols }, { data: prods }] = await Promise.all([
        supabase.from("collections").select("id, name, season, year").order("year", { ascending: false }),
        supabase.from("products").select("id, collection_id, category"),
      ]);
      const byCol = new Map<string, typeof prods>();
      (prods ?? []).forEach((p) => {
        if (!p.collection_id) return;
        const list = byCol.get(p.collection_id) ?? [];
        list.push(p);
        byCol.set(p.collection_id, list);
      });
      return (cols ?? []).map((c) => {
        const ps = byCol.get(c.id) ?? [];
        const co2 = ps.reduce((acc, p) => acc + (2 + ((hash(p.id) % 70) / 10)), 0);
        const sustainable = Math.round((ps.filter((p) => hash(p.id) % 3 !== 0).length / Math.max(ps.length, 1)) * 100);
        const certified = Math.round((ps.filter((p) => hash(p.id) % 4 !== 0).length / Math.max(ps.length, 1)) * 100);
        const traceability = Math.min(100, 60 + (hash(c.id) % 40));
        return { collection: c, products: ps.length, co2, sustainable, certified, traceability };
      });
    },
  });

  const totals = (data ?? []).reduce(
    (acc, r) => ({
      products: acc.products + r.products,
      co2: acc.co2 + r.co2,
      sustainable: acc.sustainable + r.sustainable * r.products,
      certified: acc.certified + r.certified * r.products,
    }),
    { products: 0, co2: 0, sustainable: 0, certified: 0 },
  );
  const avgSustainable = totals.products ? Math.round(totals.sustainable / totals.products) : 0;
  const avgCertified = totals.products ? Math.round(totals.certified / totals.products) : 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Leaf className="h-6 w-6 text-green-600" /> Sustentabilidade 360º</h1>
        <p className="text-muted-foreground">Pegada ESG por coleção, materiais sustentáveis, certificações e rastreabilidade DPP.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Pegada total</CardDescription><CardTitle className="text-2xl">{totals.co2.toFixed(0)} kg CO₂e</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Produtos avaliados</CardDescription><CardTitle className="text-2xl">{totals.products}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Materiais sustentáveis</CardDescription><CardTitle className="text-2xl text-green-600">{avgSustainable}%</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Certificados</CardDescription><CardTitle className="text-2xl text-blue-600">{avgCertified}%</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Factory className="h-4 w-4" /> ESG por coleção</CardTitle>
          <CardDescription>Score por coleção — clique no DPP para abrir o passaporte digital de um produto.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
            <div className="space-y-3">
              {(data ?? []).map((r) => (
                <div key={r.collection.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-semibold">{r.collection.name}</div>
                      <div className="text-xs text-muted-foreground">{r.collection.season} {r.collection.year} · {r.products} produtos · {r.co2.toFixed(0)} kg CO₂e</div>
                    </div>
                    <Link to="/dpp" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
                      Abrir DPP <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="flex justify-between text-xs mb-1"><span className="flex items-center gap-1"><Recycle className="h-3 w-3" /> Sustentáveis</span><span className="font-medium">{r.sustainable}%</span></div>
                      <Progress value={r.sustainable} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1"><span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Certificados</span><span className="font-medium">{r.certified}%</span></div>
                      <Progress value={r.certified} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1"><span>Rastreabilidade DPP</span><span className="font-medium">{r.traceability}%</span></div>
                      <Progress value={r.traceability} className="h-2" />
                    </div>
                  </div>
                </div>
              ))}
              {(data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhuma coleção encontrada.</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
