import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Library, Plus, Package } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { QuickMaterialDialog } from "@/components/quick-material-dialog";

export type LibraryMaterial = {
  id: string;
  kind: string;
  code: string;
  name: string;
  composition: string | null;
  color_hex: string | null;
  unit: string | null;
  reference_cost: number;
};

type Props = {
  ownerId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (m: LibraryMaterial) => void;
  onCreateBlank?: () => void;
};

/**
 * Modal "e-commerce interno" — usuário busca material na Biblioteca Global
 * (tecidos, aviamentos, cores) e adiciona ao BOM com um clique.
 * Reduz digitação e erros; foto/cor visíveis; unidade e custo herdados.
 */
export function MaterialPickerDialog({
  ownerId,
  open,
  onOpenChange,
  onPick,
  onCreateBlank,
}: Props) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<string>("todos");
  const [quickOpen, setQuickOpen] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    enabled: open,
    queryKey: ["material-library-picker", ownerId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("material_library")
        .select("id, kind, code, name, composition, color_hex, unit, reference_cost")
        .eq("owner_id", ownerId)
        .eq("active", true)
        .order("name")
        .limit(500);
      if (error) throw error;
      return (data ?? []) as LibraryMaterial[];
    },
    staleTime: 30_000,
  });

  const kinds = useMemo(() => {
    const set = new Set(items.map((i) => i.kind));
    return ["todos", ...Array.from(set)];
  }, [items]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return items.filter((i) => {
      if (kind !== "todos" && i.kind !== kind) return false;
      if (!t) return true;
      return (
        i.name.toLowerCase().includes(t) ||
        i.code.toLowerCase().includes(t) ||
        (i.composition ?? "").toLowerCase().includes(t)
      );
    });
  }, [items, kind, q]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="size-4 text-primary" /> Adicionar material ao BOM
          </DialogTitle>
          <DialogDescription>
            Escolha da Biblioteca Global — unidade, cor e custo de referência já vêm preenchidos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="size-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, código, composição…"
              className="pl-7 h-9"
              autoFocus
            />
          </div>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {kinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>

        <div className="max-h-[420px] overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-2 pr-1">
          {isLoading ? (
            <div className="col-span-full py-10 text-center text-sm text-muted-foreground">
              Carregando biblioteca…
            </div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full py-10 text-center text-sm text-muted-foreground space-y-2">
              <Package className="size-8 mx-auto opacity-40" />
              <div>Nenhum material encontrado.</div>
              <Link
                to="/materiais"
                className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
              >
                <Plus className="size-3" /> Cadastrar na Biblioteca
              </Link>
            </div>
          ) : (
            filtered.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onPick(m);
                  onOpenChange(false);
                }}
                className="flex items-center gap-3 rounded-lg border border-border p-2.5 text-left hover:border-primary/50 hover:bg-primary/5 transition"
              >
                <div
                  className="size-12 rounded-md shrink-0 border border-border/60"
                  style={{
                    background: m.color_hex || "hsl(var(--muted))",
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{m.name}</div>
                  <div className="text-[11px] text-muted-foreground font-mono truncate">
                    {m.code} · {m.kind}
                  </div>
                  {m.composition && (
                    <div className="text-[11px] text-muted-foreground truncate">
                      {m.composition}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-semibold tabular-nums">
                    R$ {Number(m.reference_cost ?? 0).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">/{m.unit ?? "un"}</div>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t">
          <Link
            to="/materiais"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <Library className="size-3" /> Gerenciar biblioteca
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setQuickOpen(true)}>
              <Plus className="size-3.5 mr-1" /> Novo material
            </Button>
            {onCreateBlank && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onCreateBlank();
                  onOpenChange(false);
                }}
              >
                Item manual
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
      <QuickMaterialDialog
        open={quickOpen}
        onOpenChange={setQuickOpen}
        defaultKind={kind !== "todos" ? kind : "tecido"}
        onCreated={(m) => {
          onPick(m);
          onOpenChange(false);
        }}
      />
    </Dialog>
  );
}
