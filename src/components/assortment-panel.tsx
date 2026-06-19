import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Layers, Plus, Sparkles, Target, Trash2, TriangleAlert } from "lucide-react";
import {
  CHANNELS,
  CHANNEL_LABEL,
  type Channel,
  type FamilyRow,
  deleteFamily,
  getAssortmentContext,
  upsertAssortmentCell,
  upsertFamily,
} from "@/lib/assortment.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const fmt = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
const fmtMoney = (n: number) =>
  n >= 1000 ? `R$ ${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `R$ ${Math.round(n)}`;

function cellTone(actual: number, target: number) {
  if (target === 0) return "bg-muted/30 text-muted-foreground";
  const ratio = actual / target;
  if (ratio >= 0.95 && ratio <= 1.15) return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  if (ratio >= 0.7) return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
  return "bg-rose-500/10 text-rose-700 dark:text-rose-400";
}

export function AssortmentPanel({
  collectionId,
  collectionName,
}: {
  collectionId: string;
  collectionName: string;
}) {
  const ctxFn = useServerFn(getAssortmentContext);
  const upCellFn = useServerFn(upsertAssortmentCell);
  const upFamFn = useServerFn(upsertFamily);
  const delFamFn = useServerFn(deleteFamily);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["assortment", collectionId],
    queryFn: () => ctxFn({ data: { collectionId } }),
    staleTime: 30_000,
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["assortment", collectionId] });

  const cellMut = useMutation({
    mutationFn: (v: {
      channel: Channel;
      familyId: string | null;
      targetSkus: number;
      targetUnits: number;
      targetRevenue: number;
    }) =>
      upCellFn({
        data: {
          collectionId,
          channel: v.channel,
          familyId: v.familyId,
          targetSkus: v.targetSkus,
          targetUnits: v.targetUnits,
          targetRevenue: v.targetRevenue,
        },
      }),
    onSuccess: () => {
      toast.success("Meta atualizada");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const famMut = useMutation({
    mutationFn: (v: {
      id?: string;
      name: string;
      targetMarginPct: number | null;
      priceTier: "entrada" | "medio" | "premium" | null;
    }) =>
      upFamFn({
        data: { ...v, collectionId },
      }),
    onSuccess: () => {
      toast.success("Família salva");
      setFamDialog(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delFamMut = useMutation({
    mutationFn: (id: string) => delFamFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Família removida");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [famDialog, setFamDialog] = useState<FamilyRow | "new" | null>(null);
  const [editing, setEditing] = useState<{
    channel: Channel;
    familyId: string | null;
  } | null>(null);

  const families = data?.families ?? [];
  const cells = data?.cells ?? [];
  const insights = data?.insights ?? [];
  const otb = data?.otb ?? [];

  const cellMap = useMemo(() => {
    const m = new Map<string, (typeof cells)[number]>();
    for (const c of cells) m.set(`${c.channel}::${c.familyId ?? "_"}`, c);
    return m;
  }, [cells]);

  const totals = useMemo(() => {
    const t = { skus: 0, units: 0, revenue: 0, actualSkus: 0 };
    for (const c of cells) {
      t.skus += c.targetSkus;
      t.units += c.targetUnits;
      t.revenue += c.targetRevenue;
      t.actualSkus += c.actualSkus;
    }
    return t;
  }, [cells]);

  if (isLoading) return null;

  return (
    <section className="glass rounded-xl p-4 space-y-3">
      <header className="flex flex-wrap items-center gap-2">
        <Target className="size-4 text-primary" />
        <div className="font-medium text-sm">Plano de Sortimento</div>
        <span className="text-xs text-muted-foreground truncate">— {collectionName}</span>
        <div className="ms-auto flex items-center gap-1.5 text-xs">
          <Badge variant="outline">{families.length} famílias</Badge>
          <Badge variant="outline">{fmt(totals.skus)} SKUs meta</Badge>
          <Badge variant="outline">{fmtMoney(totals.revenue)} receita meta</Badge>
          <Dialog open={famDialog !== null} onOpenChange={(o) => !o && setFamDialog(null)}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setFamDialog("new")}>
                <Plus className="size-3" /> Família
              </Button>
            </DialogTrigger>
            <FamilyDialog
              family={famDialog === "new" ? null : famDialog}
              onSave={(v) => famMut.mutate(v)}
              onDelete={(id) => delFamMut.mutate(id)}
              pending={famMut.isPending}
            />
          </Dialog>
        </div>
      </header>

      {insights.length > 0 && (
        <div className="space-y-1">
          {insights.slice(0, 3).map((ins, i) => (
            <div
              key={i}
              className={`text-xs rounded-md px-2.5 py-1.5 flex items-start gap-2 ${
                ins.severity === "critical"
                  ? "border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                  : ins.severity === "warn"
                    ? "border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    : "border border-border bg-muted/30 text-muted-foreground"
              }`}
            >
              {ins.severity === "info" ? (
                <Sparkles className="size-3.5 mt-0.5 shrink-0" />
              ) : (
                <TriangleAlert className="size-3.5 mt-0.5 shrink-0" />
              )}
              <span>{ins.message}</span>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="py-1.5 pr-3 font-medium">Família</th>
              {CHANNELS.map((ch) => (
                <th key={ch} className="py-1.5 px-2 font-medium text-center">
                  {CHANNEL_LABEL[ch]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...families, null].map((f) => {
              const fid = f?.id ?? null;
              return (
                <tr key={fid ?? "_none"} className="border-b border-border/40">
                  <td className="py-1.5 pr-3">
                    {f ? (
                      <button
                        onClick={() => setFamDialog(f)}
                        className="flex items-center gap-1.5 hover:text-primary text-left"
                      >
                        <Layers className="size-3" />
                        <span className="font-medium">{f.name}</span>
                        {f.targetMarginPct != null && (
                          <span className="text-muted-foreground">· {f.targetMarginPct}%</span>
                        )}
                      </button>
                    ) : (
                      <span className="italic text-muted-foreground">Sem família</span>
                    )}
                  </td>
                  {CHANNELS.map((ch) => {
                    const c = cellMap.get(`${ch}::${fid ?? "_"}`);
                    const isEditing =
                      editing?.channel === ch && editing.familyId === fid;
                    return (
                      <td key={ch} className="py-1 px-1">
                        {isEditing ? (
                          <CellEditor
                            initialSkus={c?.targetSkus ?? 0}
                            initialUnits={c?.targetUnits ?? 0}
                            initialRevenue={c?.targetRevenue ?? 0}
                            onCancel={() => setEditing(null)}
                            onSave={(v) => {
                              cellMut.mutate({
                                channel: ch,
                                familyId: fid,
                                ...v,
                              });
                              setEditing(null);
                            }}
                          />
                        ) : (
                          <button
                            onClick={() => setEditing({ channel: ch, familyId: fid })}
                            className={`w-full rounded px-2 py-1 text-left hover:ring-1 hover:ring-primary/40 transition ${cellTone(
                              c?.actualSkus ?? 0,
                              c?.targetSkus ?? 0,
                            )}`}
                          >
                            <div className="font-medium">
                              {c?.actualSkus ?? 0}
                              <span className="text-[10px] opacity-70"> / {c?.targetSkus ?? 0} SKUs</span>
                            </div>
                            <div className="text-[10px] opacity-70">
                              {fmtMoney(c?.targetRevenue ?? 0)}
                            </div>
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {otb.some((o) => o.targetUnits > 0 || o.committedUnits > 0) && (
        <div className="border border-border rounded-md overflow-hidden">
          <div className="text-[11px] font-medium px-2.5 py-1.5 bg-muted/40 flex items-center gap-1.5">
            <Target className="size-3" /> Open-To-Buy (unidades por família)
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border/60 text-[10px]">
                <th className="text-left px-2 py-1 font-medium">Família</th>
                <th className="text-right px-2 py-1 font-medium">Meta</th>
                <th className="text-right px-2 py-1 font-medium">Em produção</th>
                <th className="text-right px-2 py-1 font-medium">OTB</th>
              </tr>
            </thead>
            <tbody>
              {otb.map((o) => {
                const over = o.openToBuy < 0;
                const tight = !over && o.targetUnits > 0 && o.openToBuy < o.targetUnits * 0.1;
                return (
                  <tr key={o.familyId ?? "_none"} className="border-b border-border/30 last:border-0">
                    <td className="px-2 py-1">{o.familyName}</td>
                    <td className="px-2 py-1 text-right">{fmt(o.targetUnits)}</td>
                    <td className="px-2 py-1 text-right">{fmt(o.committedUnits)}</td>
                    <td
                      className={`px-2 py-1 text-right font-medium ${
                        over
                          ? "text-rose-600"
                          : tight
                            ? "text-amber-600"
                            : "text-emerald-600"
                      }`}
                    >
                      {over ? "−" : ""}
                      {fmt(Math.abs(o.openToBuy))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-[10px] text-muted-foreground">
        Clique em uma célula para definir meta de SKUs, unidades e receita. Verde = na meta · Âmbar = atenção · Vermelho = abaixo.
      </div>
    </section>
  );
}

function CellEditor({
  initialSkus,
  initialUnits,
  initialRevenue,
  onSave,
  onCancel,
}: {
  initialSkus: number;
  initialUnits: number;
  initialRevenue: number;
  onSave: (v: { targetSkus: number; targetUnits: number; targetRevenue: number }) => void;
  onCancel: () => void;
}) {
  const [skus, setSkus] = useState(String(initialSkus));
  const [units, setUnits] = useState(String(initialUnits));
  const [revenue, setRevenue] = useState(String(initialRevenue));
  return (
    <div className="space-y-1 p-1.5 border border-primary/40 rounded bg-background">
      <Input
        type="number"
        value={skus}
        onChange={(e) => setSkus(e.target.value)}
        placeholder="SKUs"
        className="h-6 text-xs"
        autoFocus
      />
      <Input
        type="number"
        value={units}
        onChange={(e) => setUnits(e.target.value)}
        placeholder="Unidades"
        className="h-6 text-xs"
      />
      <Input
        type="number"
        value={revenue}
        onChange={(e) => setRevenue(e.target.value)}
        placeholder="Receita R$"
        className="h-6 text-xs"
      />
      <div className="flex gap-1">
        <Button
          size="sm"
          className="h-6 px-2 text-[10px] flex-1"
          onClick={() =>
            onSave({
              targetSkus: Number(skus) || 0,
              targetUnits: Number(units) || 0,
              targetRevenue: Number(revenue) || 0,
            })
          }
        >
          OK
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-[10px]"
          onClick={onCancel}
        >
          ✕
        </Button>
      </div>
    </div>
  );
}

function FamilyDialog({
  family,
  onSave,
  onDelete,
  pending,
}: {
  family: FamilyRow | null;
  onSave: (v: {
    id?: string;
    name: string;
    targetMarginPct: number | null;
    priceTier: "entrada" | "medio" | "premium" | null;
  }) => void;
  onDelete: (id: string) => void;
  pending: boolean;
}) {
  const [name, setName] = useState(family?.name ?? "");
  const [margin, setMargin] = useState(
    family?.targetMarginPct != null ? String(family.targetMarginPct) : "",
  );
  const [tier, setTier] = useState<"entrada" | "medio" | "premium" | "none">(
    family?.priceTier ?? "none",
  );

  return (
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>{family ? "Editar família" : "Nova família"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">Nome</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Camisetas Básicas"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Margem-alvo %</label>
            <Input
              type="number"
              value={margin}
              onChange={(e) => setMargin(e.target.value)}
              placeholder="55"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tier de preço</label>
            <Select value={tier} onValueChange={(v) => setTier(v as typeof tier)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="medio">Médio</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <DialogFooter className="gap-2">
        {family && (
          <Button
            variant="ghost"
            size="sm"
            className="me-auto text-rose-600"
            onClick={() => onDelete(family.id)}
            disabled={pending}
          >
            <Trash2 className="size-3.5" /> Excluir
          </Button>
        )}
        <Button
          onClick={() =>
            onSave({
              id: family?.id,
              name: name.trim(),
              targetMarginPct: margin ? Number(margin) : null,
              priceTier: tier === "none" ? null : tier,
            })
          }
          disabled={pending || !name.trim()}
        >
          Salvar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
