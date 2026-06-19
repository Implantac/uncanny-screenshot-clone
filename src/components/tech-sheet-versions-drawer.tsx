import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, GitCompareArrows, Loader2, Plus } from "lucide-react";
import {
  createTechSheetVersion,
  diffTechSheetVersions,
  listTechSheetVersions,
} from "@/lib/tech-sheet-versions.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Props = {
  techSheetId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

type TechSheetVersion = {
  id: string;
  version_number: number;
  label: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
};

type DiffChange = {
  field: string;
  from: unknown;
  to: unknown;
};

type DiffItem = {
  id?: string | null;
  name?: string | null;
  point?: string | null;
};

type DiffSection = {
  added: DiffItem[];
  removed: DiffItem[];
  changed: { key: string; row: DiffItem; changes: DiffChange[] }[];
};

type VersionDiff = {
  from: Pick<TechSheetVersion, "id" | "version_number" | "label" | "created_at">;
  to: Pick<TechSheetVersion, "id" | "version_number" | "label" | "created_at">;
  header: DiffChange[];
  materials: DiffSection;
  operations: DiffSection;
  measurements: DiffSection;
};

export function TechSheetVersionsDrawer({ techSheetId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const listFn = useServerFn(listTechSheetVersions);
  const createFn = useServerFn(createTechSheetVersion);
  const diffFn = useServerFn(diffTechSheetVersions);

  const versionsKey = ["tech-sheet-versions", techSheetId];

  const { data: versions = [], isLoading } = useQuery({
    queryKey: versionsKey,
    queryFn: () => listFn({ data: { techSheetId } }) as Promise<TechSheetVersion[]>,
    enabled: open,
  });

  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createFn({ data: { techSheetId, label: label || undefined, notes: notes || undefined } }),
    onSuccess: (v: { version_number: number }) => {
      toast.success(`Snapshot v${v.version_number} criado`);
      setLabel("");
      setNotes("");
      qc.invalidateQueries({ queryKey: versionsKey });
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao criar snapshot"),
  });

  const [fromId, setFromId] = useState<string>("");
  const [toId, setToId] = useState<string>("");

  useMemo(() => {
    if (versions.length >= 2) {
      setFromId((id) => id || versions[1].id);
      setToId((id) => id || versions[0].id);
    }
  }, [versions]);

  const diff = useMutation({
    mutationFn: () => diffFn({ data: { fromId, toId } }) as Promise<VersionDiff>,
    onError: (e: Error) => toast.error(e.message || "Erro ao comparar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="size-4" /> Snapshots da ficha
          </DialogTitle>
        </DialogHeader>

        <section className="space-y-3 rounded-xl border border-border bg-background/30 p-4">
          <div className="text-sm font-medium">Criar snapshot agora</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Rótulo</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="ex.: Aprovação cliente"
              />
            </div>
            <div>
              <Label className="text-xs">Notas</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="opcional"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => create.mutate()}
              disabled={create.isPending}
              className="gap-1"
            >
              {create.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              Criar snapshot
            </Button>
          </div>
        </section>

        <section className="space-y-2">
          <div className="text-sm font-medium">Histórico</div>
          {isLoading ? (
            <div className="text-xs text-muted-foreground">Carregando…</div>
          ) : versions.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              Sem snapshots ainda. Crie o primeiro para começar a versionar.
            </div>
          ) : (
            <div className="space-y-2">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className="rounded-lg border border-border bg-background/40 p-3 text-sm flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium">
                      v{v.version_number}{" "}
                      {v.label ? <span className="text-muted-foreground">· {v.label}</span> : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(v.created_at).toLocaleString("pt-BR")}
                    </div>
                    {v.notes && <div className="text-xs text-muted-foreground mt-1">{v.notes}</div>}
                  </div>
                  <Badge variant="outline">v{v.version_number}</Badge>
                </div>
              ))}
            </div>
          )}
        </section>

        {versions.length >= 2 && (
          <section className="space-y-3 rounded-xl border border-border bg-background/30 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <GitCompareArrows className="size-4" /> Comparar versões
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-end">
              <div>
                <Label className="text-xs">De</Label>
                <Select value={fromId} onValueChange={setFromId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        v{v.version_number} {v.label ? `· ${v.label}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Para</Label>
                <Select value={toId} onValueChange={setToId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        v{v.version_number} {v.label ? `· ${v.label}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                onClick={() => diff.mutate()}
                disabled={!fromId || !toId || fromId === toId || diff.isPending}
              >
                {diff.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Comparar"}
              </Button>
            </div>

            {diff.data && <DiffView diff={diff.data} />}
          </section>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiffView({ diff }: { diff: VersionDiff }) {
  const sections: { title: string; data: DiffSection }[] = [
    { title: "Materiais", data: diff.materials },
    { title: "Operações", data: diff.operations },
    { title: "Medidas", data: diff.measurements },
  ];
  const totalChanges =
    diff.header.length +
    sections.reduce(
      (s, x) => s + x.data.added.length + x.data.removed.length + x.data.changed.length,
      0,
    );

  return (
    <div className="space-y-3 text-sm">
      <div className="text-xs text-muted-foreground">
        {totalChanges === 0
          ? "Sem diferenças."
          : `${totalChanges} alteração(ões) entre v${diff.from.version_number} → v${diff.to.version_number}`}
      </div>

      {diff.header.length > 0 && (
        <div className="rounded-lg border border-border p-3">
          <div className="text-xs font-semibold mb-2">Cabeçalho</div>
          <ul className="space-y-1 text-xs">
            {diff.header.map((c) => (
              <li key={c.field}>
                <span className="font-mono">{c.field}</span>:{" "}
                <span className="text-destructive line-through">{format(c.from)}</span> →{" "}
                <span className="text-emerald-500">{format(c.to)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sections.map((s) => {
        const { added, removed, changed } = s.data;
        if (!added.length && !removed.length && !changed.length) return null;
        return (
          <div key={s.title} className="rounded-lg border border-border p-3">
            <div className="text-xs font-semibold mb-2">{s.title}</div>
            <div className="space-y-1 text-xs">
              {added.map((r, i) => (
                <div key={`a-${i}`} className="text-emerald-500">
                  + {summarize(r)}
                </div>
              ))}
              {removed.map((r, i) => (
                <div key={`r-${i}`} className="text-destructive">
                  − {summarize(r)}
                </div>
              ))}
              {changed.map((c, i) => (
                <div key={`c-${i}`}>
                  <div className="font-medium">~ {summarize(c.row)}</div>
                  <ul className="ml-4 list-disc">
                    {c.changes.map((ch) => (
                      <li key={ch.field}>
                        <span className="font-mono">{ch.field}</span>:{" "}
                        <span className="text-destructive line-through">{format(ch.from)}</span> →{" "}
                        <span className="text-emerald-500">{format(ch.to)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function format(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function summarize(r: DiffItem) {
  return r.name ?? r.point ?? r.id ?? "(item)";
}
