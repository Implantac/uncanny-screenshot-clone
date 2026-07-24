import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, ShieldPlus, ExternalLink, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getRootCauseClusters, type RootCauseCluster } from "@/lib/root-cause-clusters.functions";
import { upsertCapa } from "@/lib/quality-capa.functions";

const KIND_LABEL: Record<string, string> = {
  negativa: "Perda",
  falta_material: "Falta de material",
  erro_corte: "Erro de corte",
  defeito_costura: "Defeito costura",
  quebra_maquina: "Quebra máquina",
  atraso_fornecedor: "Atraso fornecedor",
  retrabalho: "Retrabalho",
  descarte: "Descarte",
};

const SECTOR_LABEL: Record<string, string> = {
  cad: "CAD",
  corte: "Corte",
  costura: "Costura",
  acabamento: "Acabamento",
  expedicao: "Expedição",
  controle_qualidade: "Qualidade",
  silk: "Silk",
  bordado: "Bordado",
  lavanderia: "Lavanderia",
  compras: "Compras",
};

const SEVERITY_TONE: Record<RootCauseCluster["severity"], string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  alta: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  critica: "bg-destructive/15 text-destructive border-destructive/30",
};

export function RootCausePanel({
  windowDays = 60,
  minOccurrences = 3,
}: {
  windowDays?: number;
  minOccurrences?: number;
}) {
  const fetchClusters = useServerFn(getRootCauseClusters);
  const createCapa = useServerFn(upsertCapa);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: clusters, isLoading } = useQuery({
    queryKey: ["root-cause-clusters", windowDays, minOccurrences],
    queryFn: () => fetchClusters({ data: { windowDays, minOccurrences } }),
    refetchInterval: 120_000,
  });

  const handleSuggestCapa = async (c: RootCauseCluster) => {
    setBusy(c.key);
    try {
      const kindLabel = KIND_LABEL[c.kind] ?? c.kind;
      const sectorLabel = c.sector ? SECTOR_LABEL[c.sector] ?? c.sector : "—";
      const target =
        c.product_name ??
        c.supplier_name ??
        `${sectorLabel}`;
      const title = `${kindLabel} recorrente · ${target}`;
      const problem = [
        `${c.occurrences} ocorrências em ${c.distinct_orders} OP(s) nos últimos ${windowDays} dias.`,
        c.affected_qty > 0 ? `Quantidade afetada: ${c.affected_qty}.` : null,
        `Setor: ${sectorLabel} · Tipo: ${kindLabel}.`,
        c.supplier_name ? `Fornecedor: ${c.supplier_name}.` : null,
        c.product_name ? `Produto: ${c.product_name}${c.product_sku ? ` (${c.product_sku})` : ""}.` : null,
      ]
        .filter(Boolean)
        .join(" ");
      const severity =
        c.severity === "critica"
          ? "critica"
          : c.severity === "alta"
            ? "alta"
            : c.severity === "media"
              ? "media"
              : "baixa";

      await createCapa({
        data: {
          title,
          problem,
          severity,
          status: "aberta",
          supplier_id: c.supplier_id ?? null,
          occurrence_id: c.occurrence_ids[0] ?? null,
          order_id: c.order_ids[0] ?? null,
          root_cause: null,
          corrective_action: null,
          preventive_action: null,
        },
      });
      toast.success("CAPA aberta", { description: title });
      qc.invalidateQueries({ queryKey: ["root-cause-clusters"] });
      qc.invalidateQueries({ queryKey: ["quality-capa"] });
    } catch (e: any) {
      toast.error("Não foi possível abrir CAPA", { description: e?.message ?? String(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Root-cause automático
        </CardTitle>
        <CardDescription>
          Clusters de ocorrências recorrentes nos últimos {windowDays} dias — priorizados por
          impacto. Sugere onde abrir CAPA primeiro.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Analisando ocorrências…</p>
        ) : (clusters?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum padrão recorrente detectado (mínimo {minOccurrences} ocorrências).
          </p>
        ) : (
          <div className="overflow-auto max-h-[32rem]">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground border-b sticky top-0 bg-background">
                <tr>
                  <th className="py-2">Padrão</th>
                  <th>Setor</th>
                  <th>Fornecedor / Produto</th>
                  <th className="text-right">Ocorr.</th>
                  <th className="text-right">Qtd</th>
                  <th className="text-right">OPs</th>
                  <th className="text-right">Score</th>
                  <th className="text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {clusters!.map((c) => (
                  <tr key={c.key} className="border-b hover:bg-muted/50 align-top">
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${SEVERITY_TONE[c.severity]}`}
                        >
                          {c.severity}
                        </Badge>
                        <span className="font-medium">{KIND_LABEL[c.kind] ?? c.kind}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(c.first_seen).toLocaleDateString("pt-BR")} →{" "}
                        {new Date(c.last_seen).toLocaleDateString("pt-BR")}
                      </div>
                    </td>
                    <td className="text-xs">
                      {c.sector ? SECTOR_LABEL[c.sector] ?? c.sector : "—"}
                    </td>
                    <td className="text-xs">
                      {c.supplier_name && (
                        <div className="font-medium">{c.supplier_name}</div>
                      )}
                      {c.product_name && (
                        <div className="text-muted-foreground">
                          {c.product_name}
                          {c.product_sku ? ` · ${c.product_sku}` : ""}
                        </div>
                      )}
                      {!c.supplier_name && !c.product_name && (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="text-right tabular-nums">{c.occurrences}</td>
                    <td className="text-right tabular-nums">{c.affected_qty}</td>
                    <td className="text-right tabular-nums">{c.distinct_orders}</td>
                    <td className="text-right tabular-nums font-medium">{c.score}</td>
                    <td className="text-right">
                      {c.has_open_capa ? (
                        <Badge variant="secondary" className="gap-1">
                          <ExternalLink className="h-3 w-3" /> CAPA aberta
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === c.key}
                          onClick={() => handleSuggestCapa(c)}
                          className="gap-1"
                        >
                          <ShieldPlus className="h-3.5 w-3.5" />
                          {busy === c.key ? "Abrindo…" : "Abrir CAPA"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Score = ocorrências × impacto de quantidade × dispersão em OPs. Ordenado por
              prioridade.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
