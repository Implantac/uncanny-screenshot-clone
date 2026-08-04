import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Lock,
  ShieldCheck,
  AlertTriangle,
  Plus,
  Trash2,
  FileText,
  Layers,
  Package,
  Stamp,
  Droplets,
  Palette,
  Scissors,
  Ruler,
  ListChecks,
  Sparkles,
  BadgeIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

/* ============================================================
 * Visual da Ficha Técnica como documento técnico real.
 * Componentes puros (sem queries) — recebem dados via props.
 * ============================================================ */

export type SheetStatus = "rascunho" | "em_revisao" | "aprovada";

export const SHEET_STATUS_LABEL: Record<SheetStatus, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em revisão",
  aprovada: "Aprovada",
};

export const SHEET_STATUS_TONE: Record<SheetStatus, "neutral" | "warning" | "success"> = {
  rascunho: "neutral",
  em_revisao: "warning",
  aprovada: "success",
};

/* ------------------------- Checklist / barra ------------------------- */

export type CompletenessItem = { key: string; label: string; ok: boolean };

export function FichaCompletenessBar({
  items,
  className,
}: {
  items: CompletenessItem[];
  className?: string;
}) {
  const done = items.filter((i) => i.ok).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  return (
    <div className={cn("rounded-xl border border-border bg-card/40 p-4", className)}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <ListChecks className="size-4 text-primary" />
          <span className="text-sm font-semibold">Completude da ficha</span>
        </div>
        <span
          className={cn(
            "text-sm font-bold tabular-nums",
            pct === 100 ? "text-emerald-600" : pct >= 70 ? "text-amber-600" : "text-rose-600",
          )}
        >
          {pct}%
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            pct === 100 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-rose-500",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-1 mt-3">
        {items.map((i) => (
          <div key={i.key} className="flex items-center gap-1.5 text-xs">
            {i.ok ? (
              <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="size-3.5 text-muted-foreground/60 shrink-0" />
            )}
            <span className={cn(i.ok ? "text-foreground" : "text-muted-foreground")}>
              {i.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ Selos ------------------------------ */

export function FichaStatusSeal({ status }: { status: SheetStatus }) {
  const tone = SHEET_STATUS_TONE[status];
  const label = SHEET_STATUS_LABEL[status];
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1",
        tone === "success" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
        tone === "warning" && "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
        tone === "neutral" && "bg-muted text-muted-foreground border-border",
      )}
    >
      {status === "aprovada" ? (
        <ShieldCheck className="size-3" />
      ) : status === "em_revisao" ? (
        <Stamp className="size-3" />
      ) : (
        <FileText className="size-3" />
      )}
      {label}
    </Badge>
  );
}

export function FichaLockBanner({ status }: { status: SheetStatus }) {
  if (status !== "aprovada") return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
      <Lock className="size-5 text-amber-600 shrink-0 mt-0.5" />
      <div>
        <div className="text-sm font-semibold text-amber-700 dark:text-amber-400">
          Ficha aprovada e bloqueada
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Esta versão está aprovada e bloqueada. Para alterar, crie uma nova versão.
        </p>
      </div>
    </div>
  );
}

export function FichaIncompleteAlert({
  incomplete,
  reason,
}: {
  incomplete: boolean;
  reason?: string;
}) {
  if (!incomplete) return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4">
      <AlertTriangle className="size-5 text-rose-600 shrink-0 mt-0.5" />
      <div>
        <div className="text-sm font-semibold text-rose-700 dark:text-rose-400">
          Ficha técnica incompleta
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {reason ?? "Preencha os itens pendentes para liberar a ficha para aprovação."}
        </p>
      </div>
    </div>
  );
}

/* ------------------------- Blocos estruturados ------------------------- */

export type SheetBlock = Record<string, string>;

export function SheetBlockCard({
  title,
  icon: Icon,
  accent,
  fields,
  items,
  onChange,
  canEdit,
  emptyLabel,
  addLabel,
}: {
  title: string;
  icon: typeof FileText;
  accent?: string;
  fields: { key: string; label: string; placeholder?: string; width?: string }[];
  items: SheetBlock[];
  onChange: (items: SheetBlock[]) => void;
  canEdit: boolean;
  emptyLabel: string;
  addLabel: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Icon className="size-4" style={{ color: accent ?? "var(--primary)" }} />
          <span className="text-sm font-semibold">{title}</span>
        </div>
        {canEdit && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs"
            onClick={() => onChange([...items, {}])}
          >
            <Plus className="size-3.5" /> {addLabel}
          </Button>
        )}
      </div>
      <div className="p-4 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
            {emptyLabel}
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={index}
              className="rounded-lg border border-border/70 bg-background/30 p-3 space-y-2"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {fields.map((f) => (
                  <div key={f.key} className={cn(f.width === "full" && "sm:col-span-2")}>
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {f.label}
                    </label>
                    {canEdit ? (
                      <Input
                        value={item[f.key] ?? ""}
                        placeholder={f.placeholder}
                        onChange={(e) => {
                          const next = [...items];
                          next[index] = { ...next[index], [f.key]: e.target.value };
                          onChange(next);
                        }}
                        className="h-8 text-sm mt-0.5"
                      />
                    ) : (
                      <div className="text-sm mt-0.5 min-h-6">
                        {item[f.key] || <span className="text-muted-foreground/50">—</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {canEdit && (
                <div className="flex justify-end">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6 text-destructive"
                    onClick={() => onChange(items.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function SheetBlockText({
  title,
  icon: Icon,
  value,
  onChange,
  canEdit,
  placeholder,
}: {
  title: string;
  icon: typeof FileText;
  value: string;
  onChange: (v: string) => void;
  canEdit: boolean;
  placeholder?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
        <Icon className="size-4 text-primary" />
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="p-4">
        {canEdit ? (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder ?? "Escreva…"}
            rows={4}
            className="text-sm"
          />
        ) : (
          <div className="text-sm leading-6 whitespace-pre-wrap min-h-16">
            {value || <span className="text-muted-foreground/50">Sem conteúdo.</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------- Documento: materiais por tipo ------------------------- */

export type DocMaterial = {
  id: string;
  name: string;
  type: string | null;
  code: string | null;
  description: string | null;
  supplier: string | null;
  color: string | null;
  unit: string;
  consumption: number;
  loss_pct: number;
  unit_cost: number;
  total_cost: number;
};

const MATERIAL_TYPE_ORDER = [
  "Tecido",
  "Malha",
  "Forro",
  "Entretela",
  "Renda",
  "Botão",
  "Zíper",
  "Linha",
  "Elástico",
  "Etiqueta",
  "Tag",
  "Embalagem",
  "Aviamento",
  "Insumo de lavanderia",
  "Serviço de estamparia",
  "Serviço de bordado",
];

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function MaterialsByType({ materials }: { materials: DocMaterial[] }) {
  const groups = new Map<string, DocMaterial[]>();
  for (const m of materials) {
    const t = m.type?.trim() || "Outros";
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t)!.push(m);
  }
  const ordered = [...groups.keys()].sort(
    (a, b) =>
      (MATERIAL_TYPE_ORDER.indexOf(a) === -1 ? 99 : MATERIAL_TYPE_ORDER.indexOf(a)) -
      (MATERIAL_TYPE_ORDER.indexOf(b) === -1 ? 99 : MATERIAL_TYPE_ORDER.indexOf(b)),
  );

  return (
    <div className="space-y-4">
      {ordered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
          Nenhum material definido na ficha.
        </div>
      ) : (
        ordered.map((type) => {
          const list = groups.get(type)!;
          return (
            <div key={type} className="rounded-xl border border-border bg-card/40 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/60">
                <Layers className="size-4 text-primary" />
                <span className="text-sm font-semibold">{type}</span>
                <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                  {list.length} {list.length === 1 ? "item" : "itens"}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border/60">
                      <th className="px-4 py-2">Código</th>
                      <th className="px-4 py-2">Descrição</th>
                      <th className="px-4 py-2">Fornecedor</th>
                      <th className="px-4 py-2">Cor</th>
                      <th className="px-4 py-2 text-right">Consumo</th>
                      <th className="px-4 py-2 text-right">Perda</th>
                      <th className="px-4 py-2 text-right">Custo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((m) => (
                      <tr key={m.id} className="border-b border-border/40 last:border-0">
                        <td className="px-4 py-2 font-mono text-xs">{m.code || "—"}</td>
                        <td className="px-4 py-2">
                          <div className="font-medium">{m.name}</div>
                          {m.description && (
                            <div className="text-xs text-muted-foreground">{m.description}</div>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs">{m.supplier || "—"}</td>
                        <td className="px-4 py-2 text-xs">{m.color || "—"}</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {Number(m.consumption || 0).toFixed(3)} {m.unit}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {Number(m.loss_pct || 0).toFixed(1)}%
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums font-medium">
                          {fmt(Number(m.total_cost || 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

/* ------------------------- Documento completo ------------------------- */

export type FichaDocumentProps = {
  status: SheetStatus;
  completeness: CompletenessItem[];
  productName?: string | null;
  productSku?: string | null;
  code: string;
  version: string;
  materials: DocMaterial[];
  blockFields: {
    composition: SheetBlock[];
    packaging: SheetBlock[];
    treatments: SheetBlock[];
    printing: SheetBlock[];
    embroidery: SheetBlock[];
    laundry: SheetBlock[];
    quality: SheetBlock[];
  };
  observations: string;
  onObservationChange?: (v: string) => void;
  onBlockChange?: (block: keyof FichaDocumentProps["blockFields"], items: SheetBlock[]) => void;
  canEdit: boolean;
};

export function FichaDocument(props: FichaDocumentProps) {
  const {
    status,
    completeness,
    productName,
    productSku,
    code,
    version,
    materials,
    blockFields,
    observations,
    canEdit,
    onObservationChange,
    onBlockChange,
  } = props;

  const incomplete = completeness.filter((i) => !i.ok).length > 0;
  const isApproved = status === "aprovada";

  const block = (
    key: keyof FichaDocumentProps["blockFields"],
    title: string,
    icon: typeof FileText,
    fields: { key: string; label: string; placeholder?: string; width?: string }[],
    accent: string,
  ) => {
    const items = blockFields[key];
    return (
      <SheetBlockCard
        title={title}
        icon={icon}
        accent={accent}
        fields={fields}
        items={items}
        canEdit={canEdit}
        onChange={(v) => onBlockChange?.(key, v)}
        emptyLabel={`Nenhum registro de ${title.toLowerCase()} na ficha.`}
        addLabel={`Adicionar ${title.toLowerCase()}`}
      />
    );
  };

  return (
    <div className="space-y-5">
      {/* Cabeçalho do documento */}
      <div className="rounded-xl border border-border bg-card/40 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Ficha técnica
            </div>
            <div className="text-xl font-semibold tracking-tight mt-0.5">
              {productName || "Produto"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {productSku || code} · {code} · v{version}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FichaStatusSeal status={status} />
            <Badge variant="outline" className="font-mono">
              v{version}
            </Badge>
          </div>
        </div>
      </div>

      {/* Alertas */}
      <FichaLockBanner status={status} />
      <FichaIncompleteAlert
        incomplete={incomplete && !isApproved}
        reason="Preencha os itens pendentes do checklist para enviar a ficha para aprovação."
      />

      {/* Completude */}
      <FichaCompletenessBar items={completeness} />

      {/* Aprovação */}
      {isApproved && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
          <ShieldCheck className="size-5 text-emerald-600 shrink-0" />
          <div>
            <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              Ficha aprovada
            </div>
            <p className="text-xs text-muted-foreground">
              Esta versão está congelada e registrada no histórico. Alterações exigem nova versão.
            </p>
          </div>
        </div>
      )}

      {/* Materiais por tipo */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Layers className="size-4 text-primary" />
          <span className="text-sm font-semibold">Materiais da ficha</span>
        </div>
        <MaterialsByType materials={materials} />
      </div>

      {/* Composição */}
      {block(
        "composition",
        "Composição",
        FileText,
        [
          { key: "fiber", label: "Fibra", placeholder: "Algodão" },
          { key: "pct", label: "%", placeholder: "100", width: "1" },
          { key: "notes", label: "Observação", width: "full" },
        ],
        "#7C3AED",
      )}

      {/* Beneficiamentos / Tratamentos */}
      {block(
        "treatments",
        "Beneficiamentos",
        Sparkles,
        [
          { key: "type", label: "Tipo", placeholder: "Amaciamento" },
          { key: "description", label: "Descrição", width: "full" },
          { key: "supplier", label: "Fornecedor", placeholder: "Lavanderia…" },
        ],
        "#D97706",
      )}

      {/* Estamparia */}
      {block(
        "printing",
        "Estamparia",
        Palette,
        [
          { key: "technique", label: "Técnica", placeholder: "Silk / Digital" },
          { key: "colors", label: "Nº de cores", placeholder: "2" },
          { key: "supplier", label: "Fornecedor", placeholder: "Estamparia…" },
          { key: "notes", label: "Observação", width: "full" },
        ],
        "#16A34A",
      )}

      {/* Bordado */}
      {block(
        "embroidery",
        "Bordado",
        BadgeIcon,
        [
          { key: "technique", label: "Técnica", placeholder: "Richelieu / Cordão" },
          { key: "stitch", label: "Ponto", placeholder: "Ponto cheio" },
          { key: "supplier", label: "Fornecedor", placeholder: "Bordados…" },
          { key: "notes", label: "Observação", width: "full" },
        ],
        "#64748B",
      )}

      {/* Lavanderia */}
      {block(
        "laundry",
        "Lavanderia",
        Droplets,
        [
          { key: "wash", label: "Tipo de lavagem", placeholder: "Stone wash" },
          { key: "supplier", label: "Fornecedor", placeholder: "Lavanderia…" },
          { key: "instructions", label: "Instruções", width: "full" },
        ],
        "#3B82F6",
      )}

      {/* Embalagem */}
      {block(
        "packaging",
        "Embalagem",
        Package,
        [
          { key: "type", label: "Tipo", placeholder: "Saco plástico / Caixa" },
          { key: "material", label: "Material", placeholder: "PP / Kraft" },
          { key: "dims", label: "Dimensões", placeholder: "30×40 cm" },
          { key: "notes", label: "Observação", width: "full" },
        ],
        "#D97706",
      )}

      {/* Qualidade */}
      {block(
        "quality",
        "Instruções de qualidade",
        CheckCircle2,
        [{ key: "instruction", label: "Instrução", placeholder: "Verificar costura…", width: "full" }],
        "#16A34A",
      )}

      {/* Observações técnicas */}
      <SheetBlockText
        title="Observações técnicas"
        icon={FileText}
        value={observations}
        onChange={(v) => onObservationChange?.(v)}
        canEdit={canEdit}
        placeholder="Resumo técnico, alertas de engenharia, revisões…"
      />
    </div>
  );
}

/* Ícones re-exportados para a rota principal */
export { Layers as MaterialsIcon, Ruler as MeasurementsIcon };
