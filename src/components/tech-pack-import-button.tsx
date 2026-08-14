import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Upload, FileJson, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { importTechPack } from "@/lib/tech-pack-import.functions";

type Preview = {
  code?: string;
  source?: string;
  product_sku?: string | null;
  materials?: unknown[];
  measurements?: unknown[];
  operations?: unknown[];
};

/**
 * Importa um Tech Pack JSON exportado de CLO 3D, Illustrator ou Browzwear.
 * O JSON deve seguir o schema em `tech-pack-import.functions.ts`.
 */
export function TechPackImportButton() {
  const qc = useQueryClient();
  const importFn = useServerFn(importTechPack);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [rawText, setRawText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const mut = useMutation({
    mutationFn: async () => {
      if (!rawText) throw new Error("Selecione um arquivo JSON primeiro.");
      const parsed = JSON.parse(rawText);
      return importFn({ data: { payload: parsed } });
    },
    onSuccess: (res) => {
      const label =
        res.action === "created"
          ? "Ficha criada"
          : res.action === "revised"
            ? "Nova revisão criada"
            : "Ficha atualizada";
      toast.success(
        `${label} · ${res.counts.materials} materiais · ${res.counts.measurements} medidas · ${res.counts.operations} operações`,
      );
      qc.invalidateQueries({ queryKey: ["tech_sheets"] });
      setOpen(false);
      setPreview(null);
      setRawText("");
      setError(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Falha ao importar tech pack.");
    },
  });

  function onFile(f: File | null) {
    if (!f) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const j = JSON.parse(text) as Preview;
        setRawText(text);
        setPreview(j);
      } catch (e) {
        setError("Arquivo não é um JSON válido.");
        setRawText("");
        setPreview(null);
      }
    };
    reader.readAsText(f);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="size-4" /> Importar tech pack
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="size-5 text-primary" /> Importar tech pack (CLO / Illustrator /
            Browzwear)
          </DialogTitle>
          <DialogDescription>
            Envie um JSON estruturado exportado do seu CAD. Cria a ficha se não existir, atualiza
            rascunhos/em revisão, ou gera nova revisão de fichas já aprovadas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block">
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="secondary"
              className="w-full gap-2"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-4" />
              {preview ? "Trocar arquivo" : "Selecionar arquivo .json"}
            </Button>
          </label>

          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive border border-destructive/30 bg-destructive/10 rounded-lg p-3">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {preview && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1">
              <div className="flex items-center gap-2 text-emerald-600 font-medium">
                <CheckCircle2 className="size-4" />
                Pré-visualização
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <span className="text-muted-foreground">Código</span>
                <span className="font-mono">{preview.code ?? "—"}</span>
                <span className="text-muted-foreground">Fonte</span>
                <span>{preview.source ?? "other"}</span>
                <span className="text-muted-foreground">SKU produto</span>
                <span className="font-mono">{preview.product_sku ?? "—"}</span>
                <span className="text-muted-foreground">Materiais</span>
                <span className="tabular-nums">{preview.materials?.length ?? 0}</span>
                <span className="text-muted-foreground">Medidas</span>
                <span className="tabular-nums">{preview.measurements?.length ?? 0}</span>
                <span className="text-muted-foreground">Operações</span>
                <span className="tabular-nums">{preview.operations?.length ?? 0}</span>
              </div>
            </div>
          )}

          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none">Ver schema esperado</summary>
            <pre className="mt-2 p-2 bg-muted/40 rounded overflow-auto text-[10px] leading-tight">
              {`{
  "source": "clo3d" | "illustrator" | "browzwear" | "manual",
  "code": "TP-001",
  "product_sku": "SKU-123",
  "overhead_pct": 15,
  "notes": "…",
  "materials": [
    { "name": "Malha Cotton 30/1", "unit": "kg",
      "consumption": 0.35, "loss_pct": 5, "unit_cost": 42.5 }
  ],
  "measurements": [
    { "point": "Peito", "sizes": {"P":48,"M":50,"G":52},
      "tolerance_plus": 1, "tolerance_minus": 1 }
  ],
  "operations": [
    { "name": "Costura ombro", "machine": "Overloque",
      "sam": 0.8, "rate_per_min": 0.65 }
  ]
}`}
            </pre>
          </details>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={!preview || mut.isPending}
            className="gap-2"
          >
            <Upload className="size-4" />
            {mut.isPending ? "Importando…" : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
