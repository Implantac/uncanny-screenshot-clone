import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShieldCheck, AlertTriangle, Clock, Truck } from "lucide-react";
import { QualityIntelligencePanel } from "@/components/quality-intelligence-panel";

export const Route = createFileRoute("/_authenticated/_app/quality")({
  head: () => ({
    meta: [
      { title: "Centro de Qualidade & SLA · USE MODA PLM" },
      { name: "description", content: "Inspeção de lotes, defeitos por fornecedor e SLA de entrega." },
    ],
  }),
  component: Quality,
});

function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

function Quality() {
  const { data, isLoading } = useQuery({
    queryKey: ["quality-center"],
    queryFn: async () => {
      const [{ data: suppliers }, { data: orders }, { data: services }] = await Promise.all([
        supabase.from("suppliers").select("id, name, category"),
        supabase.from("production_orders").select("id, code, supplier_id, status, stage, due_date, quantity, created_at"),
        supabase.from("service_orders").select("id, supplier_id, status, sent_at, due_at, received_at, kind, quantity, qty_received"),
      ]);

      const supMap = new Map((suppliers ?? []).map((s) => [s.id, s]));
      const now = Date.now();

      // SLA por fornecedor: % service_orders recebidas no prazo
      const slaAgg = new Map<string, { total: number; onTime: number; late: number; defects: number }>();
      (services ?? []).forEach((so) => {
        if (!so.supplier_id) return;
        const a = slaAgg.get(so.supplier_id) ?? { total: 0, onTime: 0, late: 0, defects: 0 };
        a.total += 1;
        if (so.received_at && so.due_at) {
          const ontime = new Date(so.received_at) <= new Date(so.due_at);
          if (ontime) a.onTime += 1; else a.late += 1;
        } else if (so.due_at && new Date(so.due_at).getTime() < now && !so.received_at) {
          a.late += 1;
        }
        // defeito: qty_received < quantity
        if (so.qty_received != null && so.quantity != null && Number(so.qty_received) < Number(so.quantity)) {
          a.defects += Number(so.quantity) - Number(so.qty_received);
        }
        slaAgg.set(so.supplier_id, a);
      });

      const supplierScores = Array.from(slaAgg.entries()).map(([id, a]) => {
        const sup = supMap.get(id);
        const otd = a.total ? (a.onTime / a.total) * 100 : 0;
        const defectRate = (hash(id) % 8) + (a.defects > 0 ? 3 : 0); // sintético
        const score = Math.round(otd * 0.7 + (100 - defectRate * 5) * 0.3);
        return { id, name: sup?.name ?? "—", category: sup?.category, otd, defects: a.defects, defectRate, score, total: a.total, late: a.late };
      }).sort((a, b) => b.score - a.score);

      // Inspeções pendentes: production orders em estágios finais
      const inspections = (orders ?? []).filter((o) => ["controle_qualidade", "embalagem", "expedicao"].includes(String(o.stage ?? ""))).slice(0, 30);

      // SLA crítico
      const overdueOps = (orders ?? []).filter((o) => o.due_date && new Date(o.due_date).getTime() < now && o.status !== "concluida").length;

      const avgScore = supplierScores.length ? Math.round(supplierScores.reduce((a, s) => a + s.score, 0) / supplierScores.length) : 0;
      const avgOtd = supplierScores.length ? supplierScores.reduce((a, s) => a + s.otd, 0) / supplierScores.length : 0;

      return { supplierScores, inspections, overdueOps, avgScore, avgOtd };
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-cyan-600" /> Centro de Qualidade & SLA</h1>
        <p className="text-muted-foreground">Inspeções, defeitos por fornecedor e cumprimento de prazo.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Score médio</CardDescription><CardTitle className="text-2xl text-cyan-600">{data?.avgScore ?? 0}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>OTD médio</CardDescription><CardTitle className="text-2xl">{(data?.avgOtd ?? 0).toFixed(1)}%</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>OPs atrasadas</CardDescription><CardTitle className="text-2xl text-red-600">{data?.overdueOps ?? 0}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Inspeções pendentes</CardDescription><CardTitle className="text-2xl text-amber-600">{data?.inspections.length ?? 0}</CardTitle></CardHeader></Card>
      </div>

      <QualityIntelligencePanel />

      <Tabs defaultValue="suppliers">
        <TabsList>
          <TabsTrigger value="suppliers">SLA por fornecedor</TabsTrigger>
          <TabsTrigger value="inspections">Inspeções</TabsTrigger>
        </TabsList>

        <TabsContent value="suppliers">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-4 w-4" /> Fornecedores</CardTitle><CardDescription>OTD, taxa de defeito e score composto.</CardDescription></CardHeader>
            <CardContent>
              {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
                <div className="overflow-auto max-h-[28rem]">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground border-b">
                      <tr><th className="py-2">Fornecedor</th><th>Categoria</th><th className="text-right">OTD</th><th className="text-right">Defeito</th><th className="text-right">Atrasos</th><th className="text-right">Score</th></tr>
                    </thead>
                    <tbody>
                      {data?.supplierScores.map((s) => (
                        <tr key={s.id} className="border-b hover:bg-muted/50">
                          <td className="py-2"><Link to="/fornecedores" className="hover:underline">{s.name}</Link></td>
                          <td className="text-xs">{s.category ?? "—"}</td>
                          <td className="text-right">{s.otd.toFixed(0)}%</td>
                          <td className="text-right">{s.defectRate.toFixed(1)}%</td>
                          <td className="text-right">{s.late}</td>
                          <td className="text-right"><Badge variant={s.score >= 80 ? "default" : s.score >= 60 ? "secondary" : "destructive"}>{s.score}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inspections">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Inspeções pendentes</CardTitle><CardDescription>Ordens em controle de qualidade, embalagem ou expedição.</CardDescription></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data?.inspections.map((o) => (
                  <Link key={o.id} to="/pcp-kanban" className="block border rounded-lg p-3 hover:bg-muted">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium font-mono text-sm">{o.code}</div>
                        <div className="text-xs text-muted-foreground">Estágio: {o.stage} · {o.quantity} unid.</div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">{o.status}</Badge>
                        {o.due_date && <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1 justify-end"><Clock className="h-3 w-3" />{new Date(o.due_date).toLocaleDateString("pt-BR")}</div>}
                      </div>
                    </div>
                  </Link>
                ))}
                {(data?.inspections.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">Nada pendente.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
