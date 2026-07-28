import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Palette, Loader2, Eye } from "lucide-react";

type QuickColorDialogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Callback após criar cor com sucesso */
  onCreated?: (color: { id: string; name: string; hex: string }) => void;
};

const PRESET_COLORS = [
  { name: "Preto", hex: "#000000" },
  { name: "Branco", hex: "#FFFFFF" },
  { name: "Vermelho", hex: "#DC2626" },
  { name: "Azul Marinho", hex: "#1E3A5F" },
  { name: "Azul Claro", hex: "#60A5FA" },
  { name: "Verde Escuro", hex: "#166534" },
  { name: "Verde Musgo", hex: "#4A7C59" },
  { name: "Amarelo", hex: "#FBBF24" },
  { name: "Laranja", hex: "#FB923C" },
  { name: "Rosa", hex: "#F472B6" },
  { name: "Roxo", hex: "#A855F7" },
  { name: "Marrom", hex: "#8B5CF6" },
  { name: "Bege", hex: "#D4A574" },
  { name: "Cinza", hex: "#6B7280" },
  { name: "Creme", hex: "#FEF3C7" },
  { name: "Bordô", hex: "#7F1D1D" },
];

/**
 * QuickColorDialog — Dialog minimalista para adicionar cor à paleta,
 * sem precisar navegar para a página de materiais.
 */
export function QuickColorDialog({
  open,
  onOpenChange,
  onCreated,
}: QuickColorDialogProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [hex, setHex] = useState("#");
  const [search, setSearch] = useState("");

  const filteredPresets = PRESET_COLORS.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.hex.toLowerCase().includes(search.toLowerCase()),
  );

  const createMut = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Sessão expirada");
      if (!name.trim()) throw new Error("Informe o nome da cor");
      if (!hex.trim() || hex.trim() === "#") throw new Error("Selecione ou informe o hex");

      // Valida hex
      const colorHex = hex.trim();
      if (!/^#[0-9A-Fa-f]{6}$/.test(colorHex)) {
        throw new Error("Hex inválido. Use formato #RRGGBB");
      }

      // Verificar duplicata
      const { data: existing } = await supabase
        .from("color_palette")
        .select("id")
        .eq("owner_id", user.id)
        .eq("hex", colorHex)
        .maybeSingle();

      if (existing) {
        // Se já existe, retorna o existente
        const { data } = await supabase
          .from("color_palette")
          .select("id, name, hex")
          .eq("id", existing.id)
          .single();
        return data as { id: string; name: string; hex: string };
      }

      const { data, error } = await supabase
        .from("color_palette")
        .insert({
          owner_id: user.id,
          name: name.trim(),
          hex: colorHex,
        })
        .select("id, name, hex")
        .single();
      if (error) throw error;
      return data as { id: string; name: string; hex: string };
    },
    onSuccess: (data) => {
      toast.success(`Cor "${data.name}" adicionada à paleta!`);
      qc.invalidateQueries({ queryKey: ["color-palette"] });
      onCreated?.(data);
      reset();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reset = () => {
    setName("");
    setHex("#");
    setSearch("");
  };

  const handleSelectPreset = (preset: typeof PRESET_COLORS[0]) => {
    setName(preset.name);
    setHex(preset.hex);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
              <Palette className="size-5" />
            </div>
            <div>
              <DialogTitle>Nova Cor</DialogTitle>
              <DialogDescription>
                Adicione uma cor à sua paleta.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          {/* Preview da cor selecionada */}
          {hex && hex !== "#" && /^#[0-9A-Fa-f]{6}$/.test(hex) && (
            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              <div
                className="size-10 rounded-lg border border-border shrink-0"
                style={{ backgroundColor: hex }}
              />
              <div>
                <div className="text-sm font-medium">{name || "Sem nome"}</div>
                <div className="text-[11px] text-muted-foreground font-mono">{hex.toUpperCase()}</div>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="qc-name">Nome da cor <span className="text-destructive">*</span></Label>
            <Input
              id="qc-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Azul Petróleo"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qc-hex">
              Hex <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="qc-hex"
                  value={hex}
                  onChange={(e) => setHex(e.target.value)}
                  placeholder="#RRGGBB"
                  className="font-mono pl-8"
                />
                <Eye className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
              <div className="relative">
                <input
                  type="color"
                  value={/^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : "#000000"}
                  onChange={(e) => setHex(e.target.value)}
                  className="size-9 rounded-md border border-border cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Cores pré-definidas */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Paleta sugerida</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cor…"
              className="h-8 text-xs"
            />
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {filteredPresets.map((preset) => (
                <button
                  key={preset.hex}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] hover:bg-muted transition-colors"
                  title={`${preset.name} ${preset.hex}`}
                >
                  <div
                    className="size-3.5 rounded-full border border-border/50 shrink-0"
                    style={{ backgroundColor: preset.hex }}
                  />
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => createMut.mutate()}
            disabled={
              !name.trim() ||
              !hex.trim() ||
              hex.trim() === "#" ||
              !/^#[0-9A-Fa-f]{6}$/.test(hex.trim()) ||
              createMut.isPending
            }
          >
            {createMut.isPending ? (
              <><Loader2 className="size-4 animate-spin mr-2" /> Salvando…</>
            ) : (
              <><Palette className="size-4 mr-1.5" /> Adicionar Cor</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

