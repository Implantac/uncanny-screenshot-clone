import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sunrise, Sparkles, RefreshCw, AlertTriangle, Clock, Package, Rocket, DollarSign, ShieldCheck, Boxes } from "lucide-react";
import { getMorningBriefing } from "@/lib/morning-briefing.functions";

export function MorningBriefingPanel() {
  const fn = useServerFn(getMorningBriefing);
  const m = useMutation({ mutationFn: () => fn() });

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sunrise className="h-4 w-4 text-amber-500" />
              Briefing matinal · IA Chefe de Gabinete
            </CardTitle>
            <CardDescription>
              Snapshot operacional + 3 ações prioritárias para hoje
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => m.mutate()}
            disabled={m.isPending}
            className="gap-1.5"
          >
            {m.isPending ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {m.data ? "Atualizar" : "Gerar briefing"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {m.data && (
          <>
            <div className="flex flex-wrap gap-1.5 text-xs">
              <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{m.data.snapshot.productionOpen} OPs</Badge>
              <Badge variant={m.data.snapshot.productionLate > 0 ? "destructive" : "outline"} className="gap-1">
                <AlertTriangle className="h-3 w-3" />{m.data.snapshot.productionLate} atrasadas
              </Badge>
              <Badge variant="outline" className="gap-1"><Package className="h-3 w-3" />{m.data.snapshot.prototypesPending} protótipos parados</Badge>
              <Badge variant="outline" className="gap-1"><ShieldCheck className="h-3 w-3" />{m.data.snapshot.capaOpen} CAPAs</Badge>
              <Badge variant="outline" className="gap-1"><Rocket className="h-3 w-3" />{m.data.snapshot.launchingCollections} em lançamento</Badge>
              <Badge variant={m.data.snapshot.costAlerts > 0 ? "destructive" : "outline"} className="gap-1">
                <DollarSign className="h-3 w-3" />{m.data.snapshot.costAlerts} custos acima
              </Badge>
              <Badge variant={m.data.snapshot.lowStock > 0 ? "destructive" : "outline"} className="gap-1">
                <Boxes className="h-3 w-3" />{m.data.snapshot.lowStock} estoque baixo
              </Badge>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg border bg-card p-4">
              <ReactMarkdown>{m.data.markdown}</ReactMarkdown>
            </div>
            <p className="text-xs text-muted-foreground">
              Gerado em {new Date(m.data.generatedAt).toLocaleString("pt-BR")}
            </p>
          </>
        )}
        {!m.data && !m.isPending && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Sunrise className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              Clique em <strong>Gerar briefing</strong> para receber o resumo do dia.
            </p>
          </div>
        )}
        {m.isError && (
          <p className="text-sm text-destructive">Erro ao gerar briefing: {(m.error as Error).message}</p>
        )}
      </CardContent>
    </Card>
  );
}
