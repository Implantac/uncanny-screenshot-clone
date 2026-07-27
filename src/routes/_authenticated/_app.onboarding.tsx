import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Download, ArrowRight, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseCsv, csvToRecords, exportToCsv } from "@/lib/csv";
import {
  bulkImport,
  IMPORT_TEMPLATES,
  type ImportEntity,
  type ImportResult,
} from "@/lib/data-import.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_app/onboarding")({
  head: () => ({
    meta: [
      { title: "Onboarding · USE MODA OS" },
      { name: "description", content: "Configure sua conta USE MODA." },
      { property: "og:title", content: "Onboarding · USE MODA OS" },
      { property: "og:description", content: "Configure sua conta USE MODA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Onboarding · USE MODA OS" },
      { name: "twitter:description", content: "Configure sua conta USE MODA." },
    ],
  }),
  component: OnboardingPage,
});

const ENTITY_LABELS: Record<ImportEntity, { title: string; desc: string; order: number }> = {
  suppliers: {
    title: "Fornecedores",
    desc: "Malharias, aviamentos, facções — importe antes dos materiais",
    order: 1,
  },
  materials: {
    title: "Materiais",
    desc: "Tecidos, aviamentos e acabamentos da sua biblioteca",
    order: 2,
  },
  products: {
    title: "Produtos",
    desc: "Catálogo — SKU, nome, grade, cores e preços",
    order: 3,
  },
};

type Step = "pick" | "upload" | "map" | "commit" | "done";

function OnboardingPage() {
  const [step, setStep] = useState<Step>("pick");
  const [entity, setEntity] = useState<ImportEntity>("suppliers");
  const [records, setRecords] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState("");
  const [dryResult, setDryResult] = useState<ImportResult | null>(null);
  const [finalResult, setFinalResult] = useState<ImportResult | null>(null);

  const importFn = useServerFn(bulkImport);

  const template = IMPORT_TEMPLATES[entity];
  const allFields = useMemo(() => [...template.required, ...template.optional], [template]);
  const detectedHeaders = records.length ? Object.keys(records[0]) : [];

  // auto-suggest mapping by exact/normalized match
  function autoMap(headers: string[]) {
    const norm = (s: string) => s.toLowerCase().trim().replace(/[\s_-]+/g, "");
    const auto: Record<string, string> = {};
    for (const f of allFields) {
      const nf = norm(f);
      const hit = headers.find((h) => norm(h) === nf);
      if (hit) auto[f] = hit;
    }
    return auto;
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const rows = parseCsv(text);
      const recs = csvToRecords(rows);
      if (!recs.length) {
        toast.error("CSV vazio ou sem cabeçalho");
        return;
      }
      setRecords(recs);
      setFileName(file.name);
      setMapping(autoMap(Object.keys(recs[0])));
      setStep("map");
    };
    reader.readAsText(file, "utf-8");
  }

  function downloadTemplate() {
    const cols = allFields.map((k) => ({ key: k as keyof (typeof template.sample)[number] }));
    exportToCsv(`modelo-${entity}.csv`, template.sample, cols);
  }

  function projectedRows() {
    return records.map((r) => {
      const out: Record<string, string> = {};
      for (const [target, source] of Object.entries(mapping)) {
        if (source && r[source] !== undefined) out[target] = r[source];
      }
      return out;
    });
  }

  const runMutation = useMutation({
    mutationFn: async (dryRun: boolean) => {
      return await importFn({ data: { entity, rows: projectedRows(), dryRun } });
    },
    onSuccess: (res, dryRun) => {
      if (dryRun) {
        setDryResult(res);
        setStep("commit");
      } else {
        setFinalResult(res);
        setStep("done");
        toast.success(`Importação concluída: ${res.inserted} novos, ${res.updated} atualizados`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function reset() {
    setStep("pick");
    setRecords([]);
    setMapping({});
    setFileName("");
    setDryResult(null);
    setFinalResult(null);
  }

  const missingRequired = template.required.filter((f) => !mapping[f]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Onboarding — Importar dados iniciais"
        description="Traga fornecedores, materiais e produtos de planilhas para começar a operar o PLM em minutos."
      />

      {/* Stepper */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {(["pick", "upload", "map", "commit", "done"] as Step[]).map((s, i) => (
          <span
            key={s}
            className={`px-3 py-1 rounded-full border ${step === s ? "bg-primary text-primary-foreground border-primary" : ""}`}
          >
            {i + 1}. {s === "pick" ? "Entidade" : s === "upload" ? "Upload" : s === "map" ? "Mapear" : s === "commit" ? "Revisar" : "Concluído"}
          </span>
        ))}
      </div>

      {/* STEP 1 — pick entity */}
      {step === "pick" && (
        <div className="grid gap-4 md:grid-cols-3">
          {(Object.keys(ENTITY_LABELS) as ImportEntity[])
            .sort((a, b) => ENTITY_LABELS[a].order - ENTITY_LABELS[b].order)
            .map((e) => (
              <Card
                key={e}
                className={`cursor-pointer transition ${entity === e ? "ring-2 ring-primary" : "hover:border-primary/50"}`}
                onClick={() => setEntity(e)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5" />
                    {ENTITY_LABELS[e].order}. {ENTITY_LABELS[e].title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {ENTITY_LABELS[e].desc}
                </CardContent>
              </Card>
            ))}
          <div className="md:col-span-3 flex justify-end">
            <Button onClick={() => setStep("upload")}>
              Continuar com {ENTITY_LABELS[entity].title} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2 — upload CSV */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>Upload do CSV — {ENTITY_LABELS[entity].title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTitle>Antes de subir</AlertTitle>
              <AlertDescription>
                Baixe o modelo, preencha na sua planilha (Excel/Google Sheets), exporte como CSV e faça upload aqui.
                Aceita vírgula ou ponto-e-vírgula como separador, com acentuação (UTF-8).
              </AlertDescription>
            </Alert>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Baixar modelo com exemplo
              </Button>
              <label className="inline-flex">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <span className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 cursor-pointer">
                  <Upload className="mr-2 h-4 w-4" />
                  Escolher arquivo CSV
                </span>
              </label>
              <Button variant="ghost" onClick={() => setStep("pick")}>
                Voltar
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Obrigatórios:</span> {template.required.join(", ")}
              <br />
              <span className="font-medium">Opcionais:</span> {template.optional.join(", ")}
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3 — map columns */}
      {step === "map" && (
        <Card>
          <CardHeader>
            <CardTitle>Mapear colunas — {fileName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {records.length} linhas detectadas. Confirme qual coluna do seu arquivo corresponde a cada campo do PLM.
              Campos obrigatórios em <span className="text-destructive font-medium">vermelho</span>.
            </p>

            {missingRequired.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Faltando mapeamento obrigatório</AlertTitle>
                <AlertDescription>
                  Mapeie: <strong>{missingRequired.join(", ")}</strong>
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              {allFields.map((f) => {
                const isReq = template.required.includes(f);
                return (
                  <div key={f} className="flex items-center gap-2">
                    <label className={`w-40 text-sm ${isReq ? "text-destructive font-medium" : ""}`}>
                      {f}
                      {isReq && " *"}
                    </label>
                    <Select
                      value={mapping[f] ?? "__none__"}
                      onValueChange={(v) =>
                        setMapping((m) => ({ ...m, [f]: v === "__none__" ? "" : v }))
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="— nenhum —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— nenhum —</SelectItem>
                        {detectedHeaders.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>

            {/* Preview */}
            <div className="border rounded overflow-x-auto">
              <table className="text-xs w-full">
                <thead className="bg-muted">
                  <tr>
                    {allFields.filter((f) => mapping[f]).map((f) => (
                      <th key={f} className="px-2 py-1 text-left">
                        {f}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {projectedRows().slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-t">
                      {allFields.filter((f) => mapping[f]).map((f) => (
                        <td key={f} className="px-2 py-1">
                          {String(r[f] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep("upload")}>
                Voltar
              </Button>
              <Button
                disabled={missingRequired.length > 0 || runMutation.isPending}
                onClick={() => runMutation.mutate(true)}
              >
                {runMutation.isPending ? "Validando..." : "Validar (dry-run)"}{" "}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 4 — commit */}
      {step === "commit" && dryResult && (
        <Card>
          <CardHeader>
            <CardTitle>Revisar antes de importar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-3 text-center">
              <StatCard label="Linhas" value={dryResult.received} />
              <StatCard label="Serão criados" value={dryResult.inserted} tone="success" />
              <StatCard label="Serão atualizados" value={dryResult.updated} tone="info" />
              <StatCard label="Serão ignorados" value={dryResult.skipped} tone={dryResult.skipped ? "warn" : "muted"} />
            </div>

            {dryResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{dryResult.errors.length} linha(s) com erro (serão ignoradas)</AlertTitle>
                <AlertDescription>
                  <ul className="max-h-48 overflow-auto text-xs space-y-1 mt-2">
                    {dryResult.errors.slice(0, 20).map((e, i) => (
                      <li key={i}>
                        <Badge variant="outline" className="mr-2">
                          linha {e.row}
                        </Badge>
                        {e.message}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep("map")}>
                Voltar e ajustar mapeamento
              </Button>
              <Button
                disabled={runMutation.isPending || dryResult.inserted + dryResult.updated === 0}
                onClick={() => runMutation.mutate(false)}
              >
                {runMutation.isPending ? "Importando..." : "Importar agora"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 5 — done */}
      {step === "done" && finalResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" /> Importação concluída
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-3 text-center">
              <StatCard label="Recebidos" value={finalResult.received} />
              <StatCard label="Criados" value={finalResult.inserted} tone="success" />
              <StatCard label="Atualizados" value={finalResult.updated} tone="info" />
              <StatCard label="Ignorados" value={finalResult.skipped} tone={finalResult.skipped ? "warn" : "muted"} />
            </div>
            <div className="flex gap-2">
              <Button onClick={reset} variant="outline">
                <RotateCcw className="mr-2 h-4 w-4" />
                Nova importação
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: number;
  tone?: "muted" | "success" | "info" | "warn";
}) {
  const toneCls = {
    muted: "bg-muted text-muted-foreground",
    success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    info: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
    warn: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  }[tone];
  return (
    <div className={`rounded-md p-3 ${toneCls}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}
