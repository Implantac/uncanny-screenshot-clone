import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Palette, Plus, Trash2, Layers3, FolderTree } from "lucide-react";
import {
  type ThemeRow,
  type LineRow,
  listThemes,
  upsertTheme,
  deleteTheme,
  listLines,
  upsertLine,
  deleteLine,
} from "@/lib/collection-config.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ThemesPanel({
  collectionId,
  collectionName,
}: {
  collectionId: string;
  collectionName: string;
}) {
  const listFn = useServerFn(listThemes);
  const upFn = useServerFn(upsertTheme);
  const delFn = useServerFn(deleteTheme);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["themes", collectionId],
    queryFn: () => listFn({ data: { collectionId } }),
    staleTime: 30_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["themes", collectionId] });

  const [editing, setEditing] = useState<ThemeRow | "new" | null>(null);

  const upMut = useMutation({
    mutationFn: (v: {
      id?: string;
      name: string;
      color: string | null;
      description: string | null;
    }) => upFn({ data: { ...v, collectionId } }),
    onSuccess: () => {
      toast.success("Tema salvo");
      setEditing(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Tema removido");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return null;
  const themes = data ?? [];

  return (
    <section className="glass rounded-xl p-4 space-y-3">
      <header className="flex flex-wrap items-center gap-2">
        <Palette className="size-4 text-primary" />
        <div className="font-medium text-sm">Temas da Coleção</div>
        <span className="text-xs text-muted-foreground truncate">— {collectionName}</span>
        <div className="ms-auto">
          <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setEditing("new")}>
                <Plus className="size-3" /> Tema
              </Button>
            </DialogTrigger>
            <ThemeDialog
              theme={editing === "new" ? null : editing}
              onSave={(v) => upMut.mutate(v)}
              onDelete={(id) => delMut.mutate(id)}
              pending={upMut.isPending}
            />
          </Dialog>
        </div>
      </header>

      {themes.length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center">
          Sem temas. Use temas para contar a história (ex.: "Brisa de Verão", "Noir Urbano") e agrupar produtos por storytelling.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => setEditing(t)}
              className="text-left p-2 rounded-md border border-border hover:ring-1 hover:ring-primary/40 transition"
              style={t.color ? { borderLeftColor: t.color, borderLeftWidth: 4 } : undefined}
            >
              <div className="text-sm font-medium truncate">{t.name}</div>
              {t.description && (
                <div className="text-[10px] text-muted-foreground truncate">{t.description}</div>
              )}
              <div className="flex items-center gap-1.5 mt-1">
                <Badge variant="outline" className="text-[10px]">
                  {t.productCount} produto(s)
                </Badge>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function ThemeDialog({
  theme,
  onSave,
  onDelete,
  pending,
}: {
  theme: ThemeRow | null;
  onSave: (v: {
    id?: string;
    name: string;
    color: string | null;
    description: string | null;
  }) => void;
  onDelete: (id: string) => void;
  pending: boolean;
}) {
  const [name, setName] = useState(theme?.name ?? "");
  const [color, setColor] = useState(theme?.color ?? "#8b5cf6");
  const [description, setDescription] = useState(theme?.description ?? "");

  return (
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>{theme ? "Editar tema" : "Novo tema"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">Nome</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Brisa de Verão" />
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
          <div>
            <label className="text-xs text-muted-foreground">Cor</label>
            <Input value={color} onChange={(e) => setColor(e.target.value)} />
          </div>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-9 rounded border border-border cursor-pointer"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Descrição</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Storytelling do tema"
          />
        </div>
      </div>
      <DialogFooter className="gap-2">
        {theme && (
          <Button
            variant="ghost"
            size="sm"
            className="me-auto text-rose-600"
            onClick={() => onDelete(theme.id)}
            disabled={pending}
          >
            <Trash2 className="size-3.5" /> Excluir
          </Button>
        )}
        <Button
          onClick={() =>
            onSave({
              id: theme?.id,
              name: name.trim(),
              color: color || null,
              description: description.trim() || null,
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

export function LinesDialogButton() {
  const [open, setOpen] = useState(false);
  const listFn = useServerFn(listLines);
  const upFn = useServerFn(upsertLine);
  const delFn = useServerFn(deleteLine);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["product-lines"],
    queryFn: () => listFn(),
    staleTime: 30_000,
    enabled: open,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["product-lines"] });

  const [edit, setEdit] = useState<LineRow | "new" | null>(null);

  const upMut = useMutation({
    mutationFn: (v: { id?: string; name: string; season: string | null; year: number | null }) =>
      upFn({ data: v }),
    onSuccess: () => {
      toast.success("Linha salva");
      setEdit(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Linha removida");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lines = data ?? [];

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1" onClick={() => setOpen(true)}>
        <FolderTree className="size-3.5" /> Linhas
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Linhas de Produto</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {lines.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center">
                Sem linhas cadastradas.
              </div>
            ) : (
              lines.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setEdit(l)}
                  className="w-full text-left flex items-center gap-2 p-2 rounded border border-border hover:ring-1 hover:ring-primary/40 text-xs"
                >
                  <Layers3 className="size-3.5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium">{l.name}</div>
                    {(l.season || l.year) && (
                      <div className="text-muted-foreground">
                        {[l.season, l.year].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </div>
                  <Badge variant="outline">{l.productCount}</Badge>
                </button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEdit("new")}>
              <Plus className="size-3.5" /> Nova linha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={edit !== null} onOpenChange={(o) => !o && setEdit(null)}>
        <LineEditDialog
          line={edit === "new" ? null : edit}
          onSave={(v) => upMut.mutate(v)}
          onDelete={(id) => delMut.mutate(id)}
          pending={upMut.isPending}
        />
      </Dialog>
    </>
  );
}

function LineEditDialog({
  line,
  onSave,
  onDelete,
  pending,
}: {
  line: LineRow | null;
  onSave: (v: { id?: string; name: string; season: string | null; year: number | null }) => void;
  onDelete: (id: string) => void;
  pending: boolean;
}) {
  const [name, setName] = useState(line?.name ?? "");
  const [season, setSeason] = useState(line?.season ?? "");
  const [year, setYear] = useState(line?.year ? String(line.year) : "");

  return (
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>{line ? "Editar linha" : "Nova linha"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">Nome</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Jeans Premium" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Temporada</label>
            <Input value={season} onChange={(e) => setSeason(e.target.value)} placeholder="Verão" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Ano</label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2026"
            />
          </div>
        </div>
      </div>
      <DialogFooter className="gap-2">
        {line && (
          <Button
            variant="ghost"
            size="sm"
            className="me-auto text-rose-600"
            onClick={() => onDelete(line.id)}
            disabled={pending}
          >
            <Trash2 className="size-3.5" /> Excluir
          </Button>
        )}
        <Button
          onClick={() =>
            onSave({
              id: line?.id,
              name: name.trim(),
              season: season.trim() || null,
              year: year ? Number(year) : null,
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
