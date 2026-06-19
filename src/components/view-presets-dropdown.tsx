import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Star, Trash2, Save, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  listViewPresets,
  saveViewPreset,
  deleteViewPreset,
  toggleFavoriteViewPreset,
} from "@/lib/view-presets.functions";

export type ViewPresetFilters = Record<string, unknown>;

const DEFAULT_BUILTIN: Record<string, { name: string; filters: ViewPresetFilters }[]> = {
  acompanhamento_producao: [
    { name: "Meus atrasados", filters: { listFilter: "atrasado" } },
    { name: "Costura externa em risco", filters: { origin: "externa", listFilter: "atrasado" } },
    { name: "Finalizados hoje", filters: { listFilter: "finalizado" } },
    { name: "Aguardando corte", filters: { colKey: "aguardando_corte" } },
  ],
  colecoes: [
    { name: "Em desenvolvimento", filters: { status: "desenvolvimento" } },
    { name: "Em produção", filters: { status: "producao" } },
    { name: "Em lançamento", filters: { status: "lancamento" } },
    { name: "Markdown", filters: { status: "markdown" } },
  ],
  prototipos: [
    { name: "Em prova", filters: { stage: "em_prova" } },
    { name: "Em confecção", filters: { stage: "em_confeccao" } },
    { name: "Aprovados", filters: { stage: "aprovado" } },
    { name: "Reprovados", filters: { stage: "reprovado" } },
  ],
};

export function ViewPresetsDropdown({
  module,
  current,
  onApply,
  onClear,
  builtin,
}: {
  module: string;
  current: ViewPresetFilters;
  onApply: (filters: ViewPresetFilters) => void;
  onClear: () => void;
  builtin?: { name: string; filters: ViewPresetFilters }[];
}) {
  const builtins = builtin ?? DEFAULT_BUILTIN[module] ?? [];
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");

  const presetsQ = useQuery({
    queryKey: ["view-presets", module],
    queryFn: () => listViewPresets({ data: { module } }),
    staleTime: 60_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["view-presets", module] });

  const saveMut = useMutation({
    mutationFn: () => saveViewPreset({ data: { module, name: name.trim(), filters: current } }),
    onSuccess: () => {
      toast.success(`Visão "${name}" salva`);
      setName("");
      setSaveOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message ?? "Falha ao salvar"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteViewPreset({ data: { id } }),
    onSuccess: () => {
      toast.success("Visão removida");
      invalidate();
    },
  });

  const favMut = useMutation({
    mutationFn: (v: { id: string; is_favorite: boolean }) =>
      toggleFavoriteViewPreset({ data: v }),
    onSuccess: invalidate,
  });

  const presets = presetsQ.data ?? [];

  return (
    <div className="inline-flex items-center gap-1">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-md border border-border bg-card hover:bg-muted">
            <Bookmark className="size-3.5" /> Minhas visões
            <ChevronDown className="size-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">
            Rápidas
          </DropdownMenuLabel>
          {builtins.map((p) => (
            <DropdownMenuItem
              key={p.name}
              onSelect={(e) => {
                e.preventDefault();
                onClear();
                onApply(p.filters);
                setOpen(false);
              }}
            >
              {p.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">
            Salvas {presetsQ.isLoading ? "…" : `(${presets.length})`}
          </DropdownMenuLabel>
          {presets.length === 0 && (
            <div className="px-2 py-2 text-[11px] text-muted-foreground">
              Salve a configuração atual de filtros para reusar depois.
            </div>
          )}
          {presets.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-muted"
            >
              <button
                className="flex-1 text-left text-sm px-2 py-1.5"
                onClick={() => {
                  onClear();
                  onApply((p.filters as ViewPresetFilters) ?? {});
                  setOpen(false);
                }}
              >
                {p.name}
              </button>
              <button
                title={p.is_favorite ? "Desfavoritar" : "Favoritar"}
                onClick={(e) => {
                  e.stopPropagation();
                  favMut.mutate({ id: p.id, is_favorite: !p.is_favorite });
                }}
                className="p-1 rounded hover:bg-background"
              >
                <Star
                  className={`size-3.5 ${p.is_favorite ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`}
                />
              </button>
              <button
                title="Excluir"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Remover visão "${p.name}"?`)) delMut.mutate(p.id);
                }}
                className="p-1 rounded hover:bg-background text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              onClear();
              setOpen(false);
            }}
          >
            Limpar todos os filtros
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Popover open={saveOpen} onOpenChange={setSaveOpen}>
        <PopoverTrigger asChild>
          <button
            title="Salvar visão atual"
            className="inline-flex items-center gap-1 text-xs px-2 py-2 rounded-md border border-border bg-card hover:bg-muted"
          >
            <Save className="size-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-3 space-y-2">
          <div className="text-xs font-semibold">Salvar visão atual</div>
          <Input
            placeholder="Ex: Externa em risco"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            className="w-full h-7 text-xs"
            disabled={!name.trim() || saveMut.isPending}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
