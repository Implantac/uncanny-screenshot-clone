import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Save, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

type Template = {
  id: string;
  name: string;
  category: string | null;
  materials: any[];
  operations: any[];
  updated_at: string;
};

type Props = { sheetId: string; ownerId: string; disabled?: boolean };

/**
 * Reutilização de BOM: salva materiais+operações da ficha como template
 * e aplica templates em outras fichas — sem refazer manualmente.
 */
export function BomTemplatesButton({ sheetId, ownerId, disabled }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const canEdit = user?.id === ownerId;

  const { data: templates = [] } = useQuery({
    enabled: open,
    queryKey: ["bom-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bom_templates")
        .select("id, name, category, materials, operations, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Template[];
    },
  });

  const saveTpl = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Sessão expirada");
      if (!name.trim()) throw new Error("Dê um nome ao template");
      const [{ data: mats, error: e1 }, { data: ops, error: e2 }] = await Promise.all([
        supabase
          .from("tech_sheet_materials")
          .select("name, unit, consumption, loss_pct, unit_cost, position")
          .eq("tech_sheet_id", sheetId)
          .order("position"),
        supabase
          .from("tech_sheet_operations")
          .select("name, machine, sam, rate_per_min, position")
          .eq("tech_sheet_id", sheetId)
          .order("position"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const { error } = await supabase.from("bom_templates").insert({
        owner_id: user.id,
        name: name.trim(),
        category: category.trim() || null,
        source_sheet_id: sheetId,
        materials: mats ?? [],
        operations: ops ?? [],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bom-templates"] });
      toast.success("Template salvo");
      setName("");
      setCategory("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyTpl = useMutation({
    mutationFn: async (tpl: Template) => {
      const matRows = (tpl.materials ?? []).map((m: any, i: number) => ({
        owner_id: ownerId,
        tech_sheet_id: sheetId,
        name: m.name,
        unit: m.unit,
        consumption: m.consumption ?? 0,
        loss_pct: m.loss_pct ?? 0,
        unit_cost: m.unit_cost ?? 0,
        position: i,
      }));
      const opRows = (tpl.operations ?? []).map((o: any, i: number) => ({
        owner_id: ownerId,
        tech_sheet_id: sheetId,
        name: o.name,
        machine: o.machine,
        sam: o.sam ?? 0,
        rate_per_min: o.rate_per_min ?? 0,
        position: i,
      }));
      if (matRows.length) {
        const { error } = await supabase.from("tech_sheet_materials").insert(matRows);
        if (error) throw error;
      }
      if (opRows.length) {
        const { error } = await supabase.from("tech_sheet_operations").insert(opRows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ts-materials", sheetId] });
      qc.invalidateQueries({ queryKey: ["ts-ops", sheetId] });
      qc.invalidateQueries({ queryKey: ["tech_sheets"] });
      toast.success("Template aplicado à ficha");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delTpl = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bom_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bom-templates"] }),
  });

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <BookOpen className="size-3.5" /> Templates BOM
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="size-4 text-primary" /> Templates de BOM
            </DialogTitle>
          </DialogHeader>

          {canEdit && (
            <div className="rounded-xl border border-border bg-background/30 p-3 space-y-2">
              <div className="text-xs font-semibold flex items-center gap-1.5">
                <Save className="size-3.5 text-primary" /> Salvar esta ficha como template
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Nome</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Camiseta básica"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Categoria</Label>
                  <Input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Camisetas"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <Button
                size="sm"
                className="w-full gap-1"
                disabled={saveTpl.isPending || !name.trim()}
                onClick={() => saveTpl.mutate()}
              >
                <Plus className="size-3.5" /> Salvar template
              </Button>
            </div>
          )}

          <div className="space-y-2 max-h-80 overflow-y-auto">
            <div className="text-xs font-semibold">Disponíveis ({templates.length})</div>
            {templates.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-xs text-center text-muted-foreground">
                Nenhum template ainda. Salve sua primeira ficha como base reutilizável.
              </div>
            ) : (
              templates.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background/30 p-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{t.name}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {t.category && (
                        <Badge variant="outline" className="text-[10px]">
                          {t.category}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {(t.materials ?? []).length} materiais
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {(t.operations ?? []).length} operações
                      </Badge>
                    </div>
                  </div>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 text-xs"
                      disabled={applyTpl.isPending}
                      onClick={() => applyTpl.mutate(t)}
                    >
                      Aplicar
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-destructive"
                    onClick={() => {
                      if (confirm("Remover template?")) delTpl.mutate(t.id);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
