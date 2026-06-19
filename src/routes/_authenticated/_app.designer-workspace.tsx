import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PenTool, Sparkles, Scissors, Compass, Palette } from "lucide-react";
import { DesignerAIAssistant } from "@/components/designer-ai-assistant";

export const Route = createFileRoute("/_authenticated/_app/designer-workspace")({
  head: () => ({
    meta: [
      { title: "Workspace do Designer · USE MODA PLM" },
      {
        name: "description",
        content: "Protótipos abertos, aprovações pendentes, referências e mood.",
      },
    ],
  }),
  component: DesignerWorkspace,
});

function DesignerWorkspace() {
  const { data, isLoading } = useQuery({
    queryKey: ["designer-workspace"],
    queryFn: async () => {
      const [protos, products, cols] = await Promise.all([
        supabase
          .from("prototypes")
          .select("id, code, stage, created_at, product_id")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("products")
          .select("id, sku, name, category, image_url, status")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("collections")
          .select("id, name, season, year, status")
          .order("year", { ascending: false })
          .limit(10),
      ]);
      return {
        prototypes: protos.data ?? [],
        products: products.data ?? [],
        collections: cols.data ?? [],
      };
    },
  });

  const openProtos = (data?.prototypes ?? []).filter(
    (p) => p.stage !== "aprovado" && p.stage !== "reprovado",
  );
  const pendingApproval = (data?.prototypes ?? []).filter(
    (p) => p.stage === "em_prova" || p.stage === "solicitado",
  );
  const draftProducts = (data?.products ?? []).filter(
    (p) => p.status === "rascunho" || p.status === "desenvolvimento",
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Palette className="h-6 w-6 text-pink-600" /> Workspace do Designer
        </h1>
        <p className="text-muted-foreground">
          Tudo o que está aberto no seu nome — protótipos, aprovações pendentes e referências.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Protótipos abertos</CardDescription>
            <CardTitle className="text-2xl">{openProtos.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Aguardando aprovação</CardDescription>
            <CardTitle className="text-2xl text-orange-600">{pendingApproval.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Produtos em rascunho</CardDescription>
            <CardTitle className="text-2xl">{draftProducts.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Coleções ativas</CardDescription>
            <CardTitle className="text-2xl">
              {(data?.collections ?? []).filter((c) => c.status !== "entregue").length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scissors className="h-4 w-4" /> Protótipos abertos
            </CardTitle>
            <CardDescription>Em modelagem, piloto ou aguardando feedback.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-auto">
                {openProtos.slice(0, 15).map((p) => (
                  <Link
                    key={p.id}
                    to="/prototipos"
                    className="flex items-center justify-between border rounded-lg px-3 py-2 hover:bg-muted"
                  >
                    <span className="font-mono text-xs">{p.code}</span>
                    <Badge variant="outline">{p.stage}</Badge>
                  </Link>
                ))}
                {openProtos.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum protótipo aberto.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Produtos em rascunho
            </CardTitle>
            <CardDescription>Briefings que ainda não viraram protótipo.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-auto">
              {draftProducts.slice(0, 15).map((p) => (
                <Link
                  key={p.id}
                  to="/produtos"
                  className="flex items-center justify-between border rounded-lg px-3 py-2 hover:bg-muted"
                >
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{p.sku}</div>
                  </div>
                  <Badge variant="outline">{p.category}</Badge>
                </Link>
              ))}
              {draftProducts.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum rascunho.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <DesignerAIAssistant />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Compass className="h-4 w-4" /> Atalhos de criação
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            to="/trends"
            className="border rounded-lg p-3 hover:bg-muted flex items-center gap-2"
          >
            <Compass className="h-4 w-4" /> Tendências
          </Link>
          <Link to="/cad" className="border rounded-lg p-3 hover:bg-muted flex items-center gap-2">
            <PenTool className="h-4 w-4" /> CAD/Modelagem
          </Link>
          <Link
            to="/ficha-tecnica"
            className="border rounded-lg p-3 hover:bg-muted flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4" /> Ficha Técnica
          </Link>
          <Link
            to="/dev-kanban"
            className="border rounded-lg p-3 hover:bg-muted flex items-center gap-2"
          >
            <Scissors className="h-4 w-4" /> Dev Kanban
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
