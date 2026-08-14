import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { LibraryMaterial } from "@/components/material-picker-dialog";

/**
 * Modal enxuto para criar um material na Biblioteca Global sem sair do BOM.
 * Devolve o registro criado via onCreated para o picker auto-selecionar.
 */
export function QuickMaterialDialog({
  open,
  onOpenChange,
  defaultKind = "tecido",
  onCreated,
  invalidateKeys = [["material-library"], ["material-library-picker"]],
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultKind?: string;
  onCreated?: (m: LibraryMaterial) => void;
  invalidateKeys?: readonly (readonly unknown[])[];
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [kind, setKind] = useState(defaultKind);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [composition, setComposition] = useState("");
  const [colorHex, setColorHex] = useState("");
  const [unit, setUnit] = useState("m");
  const [cost, setCost] = useState<number>(0);

  const create = useMutation({
    mutationFn: async () => {
      const payload = {
        owner_id: user!.id,
        kind,
        code: code.trim(),
        name: name.trim(),
        composition: composition.trim() || null,
        color_hex: colorHex.trim() || null,
        unit,
        reference_cost: cost || 0,
        active: true,
      };
      const { data, error } = await (supabase as any)
        .from("material_library")
        .insert(payload)
        .select("id, kind, code, name, composition, color_hex, unit, reference_cost")
        .single();
      if (error) throw error;
      return data as LibraryMaterial;
    },
    onSuccess: (row) => {
      toast.success("Material criado");
      setCode("");
      setName("");
      setComposition("");
      setColorHex("");
      setCost(0);
      invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k as unknown[] }));
      onCreated?.(row);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-4 text-primary" /> Novo material
          </DialogTitle>
          <DialogDescription>
            Cadastro rápido na Biblioteca — refine depois em Materiais.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="tecido">tecido</option>
              <option value="aviamento">aviamento</option>
              <option value="acabado">acabado</option>
              <option value="outros">outros</option>
            </select>
            <Input
              placeholder="Unidade (m, un, kg…)"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
          </div>
          <Input
            autoFocus
            placeholder="Nome *"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Código *" value={code} onChange={(e) => setCode(e.target.value)} />
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="Custo ref."
              value={cost || ""}
              onChange={(e) => setCost(Number(e.target.value) || 0)}
            />
          </div>
          <Input
            placeholder="Composição (opcional)"
            value={composition}
            onChange={(e) => setComposition(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={colorHex || "#cccccc"}
              onChange={(e) => setColorHex(e.target.value)}
              className="h-9 w-12 rounded border border-input bg-background"
            />
            <Input
              placeholder="#hex (opcional)"
              value={colorHex}
              onChange={(e) => setColorHex(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={!name.trim() || !code.trim() || create.isPending}
            className="gap-1"
          >
            <Plus className="size-4" /> Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
