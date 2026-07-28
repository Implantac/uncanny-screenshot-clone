import { useState, useMemo, useCallback, memo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  FileText,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Shirt,
  Palette,
  Ruler,
  DollarSign,
  ImageIcon,
  Plus,
  X,
  HelpCircle,
  Wallet,
  TrendingUp,
  TrendingDown,
  Trash2,
  Library,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { MaterialPickerDialog, type LibraryMaterial } from "@/components/material-picker-dialog";

type CollectionRef = { id: string; name: string; season: string; year: number };

/**
 * WIZARD DE CRIAÇÃO — 5 passos
 *
 * Passo 0: Identidade — Nome, SKU, Coleção
 * Passo 1: Características — Categoria, Cores, Tamanhos, Imagem
 * Passo 2: Ficha Técnica — Materiais, Operações (BOM + BOP inline)
 * Passo 3: Custos — Preço de venda, Overhead, Margem estimada
 * Passo 4: Revisão — Resumo completo + custos, criar
 */
const WIZARD_STEPS = [
  { id: "identidade", label: "Identidade", icon: Shirt },
  { id: "caracteristicas", label: "Características", icon: Palette },
  { id: "ficha", label: "Ficha técnica", icon: FileText },
  { id: "custos", label: "Custos", icon: DollarSign },
  { id: "revisao", label: "Revisão", icon: CheckCircle2 },
] as const;

const CATEGORIES = [
  "Vestido", "Blusa", "Camisa", "Calça", "Saia", "Short",
  "Jaqueta", "Casaco", "Macacão", "Body", "Top", "Cropped",
  "Bermuda", "Kimono", "Coletê", "Outro",
];

const SILHOUETTES = [
  { value: "justo", label: "Justo", desc: "Colado ao corpo" },
  { value: "semi-justo", label: "Semi-justo", desc: "Ajustado, mas confortável" },
  { value: "reto", label: "Reto", desc: "Linha reta, sem definição de cintura" },
  { value: "evase", label: "Evasê", desc: "Abre da cintura para baixo" },
  { value: "godê", label: "Godê", desc: "Amplo, rodado" },
  { value: "envelope", label: "Envelope", desc: "Sobreposição frontal" },
  { value: "assimetrico", label: "Assimétrico", desc: "Comprimento ou corte irregular" },
  { value: "oversized", label: "Oversized", desc: "Intencionalmente grande" },
];

const OCCASIONS = [
  "Casual Dia", "Casual Noite", "Trabalho Escritório", "Trabalho Operacional",
  "Social Formal", "Social Festa", "Praia / Resort", "Esporte / Lazer",
  "Íntimo / Dormir", "Plus Size", "Gestante", "Infantil",
];

const COLOR_OPTIONS = [
  { value: "preto", label: "Preto" }, { value: "branco", label: "Branco" },
  { value: "vermelho", label: "Vermelho" }, { value: "azul", label: "Azul" },
  { value: "verde", label: "Verde" }, { value: "amarelo", label: "Amarelo" },
  { value: "rosa", label: "Rosa" }, { value: "roxo", label: "Roxo" },
  { value: "laranja", label: "Laranja" }, { value: "marrom", label: "Marrom" },
  { value: "cinza", label: "Cinza" }, { value: "bege", label: "Bege" },
  { value: "estampa", label: "Estampado" }, { value: "listrado", label: "Listrado" },
  { value: "poa", label: "Poá" },
];

const SIZE_OPTIONS = ["PP", "P", "M", "G", "GG", "XG", "36", "38", "40", "42", "44", "46", "48"];
const SEASONS = ["Verão", "Inverno", "Alto Verão", "Meia Estação", "Resort", "Cápsula"];

// -- Tipos inline para ficha técnica -
type MaterialInline = {
  id: string;
  name: string;
  unit: string;
  consumption: number;
  unit_cost: number;
  loss_pct: number;
};
type OperationInline = {
  id: string;
  name: string;
  machine: string;
  role: string;
  sam: number;
  rate_per_min: number;
};

let _matId = 0;
let _opId = 0;

const newMat = (): MaterialInline => ({
  id: `mat_${++_matId}`,
  name: "",
  unit: "m",
  consumption: 0,
  unit_cost: 0,
  loss_pct: 0,
});
const newOp = (): OperationInline => ({
  id: `op_${++_opId}`,
  name: "",
  machine: "",
  role: "",
  sam: 0,
  rate_per_min: 0,
});

function fmt(n: number) {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// —— Componente memoizado para linha de material —
const MaterialRow = memo(function MaterialRow({
  mat,
  idx,
  onUpdate,
  onDelete,
}: {
  mat: MaterialInline;
  idx: number;
  onUpdate: (idx: number, partial: Partial<MaterialInline>) => void;
  onDelete: (id: string) => void;
}) {
  const handleName = useCallback((e: React.ChangeEvent<HTMLInputElement>) => onUpdate(idx, { name: e.target.value }), [idx, onUpdate]);
  const handleUnit = useCallback((e: React.ChangeEvent<HTMLInputElement>) => onUpdate(idx, { unit: e.target.value }), [idx, onUpdate]);
  const handleConsumption = useCallback((e: React.ChangeEvent<HTMLInputElement>) => onUpdate(idx, { consumption: Number(e.target.value) || 0 }), [idx, onUpdate]);
  const handleUnitCost = useCallback((e: React.ChangeEvent<HTMLInputElement>) => onUpdate(idx, { unit_cost: Number(e.target.value) || 0 }), [idx, onUpdate]);
  const handleLoss = useCallback((e: React.ChangeEvent<HTMLInputElement>) => onUpdate(idx, { loss_pct: Number(e.target.value) || 0 }), [idx, onUpdate]);
  const handleDelete = useCallback(() => onDelete(mat.id), [mat.id, onDelete]);

  return (
    <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap border border-border/60 rounded-lg p-1.5 bg-background">
      <Input value={mat.name} onChange={handleName} placeholder="Nome do material" className="h-7 text-xs min-w-[120px] flex-1" />
      <div className="flex items-center gap-1 text-xs">
        <span className="text-muted-foreground">Un</span>
        <Input value={mat.unit} onChange={handleUnit} className="h-7 text-xs w-12" />
      </div>
      <div className="flex items-center gap-1 text-xs">
        <span className="text-muted-foreground">Cons</span>
        <input type="number" step="0.01" value={mat.consumption || ""} onChange={handleConsumption}
          className="h-7 w-16 text-xs text-right border border-border rounded px-1 bg-transparent tabular-nums" />
      </div>
      <div className="flex items-center gap-1 text-xs">
        <span className="text-muted-foreground">R$/un</span>
        <input type="number" step="0.01" value={mat.unit_cost || ""} onChange={handleUnitCost}
          className="h-7 w-16 text-xs text-right border border-border rounded px-1 bg-transparent tabular-nums" />
      </div>
      <div className="flex items-center gap-1 text-xs">
        <span className="text-muted-foreground">Perda%</span>
        <input type="number" step="0.1" value={mat.loss_pct || ""} onChange={handleLoss}
          className="h-7 w-14 text-xs text-right border border-border rounded px-1 bg-transparent tabular-nums" />
      </div>
      <span className="text-xs font-medium tabular-nums shrink-0 w-20 text-right">
        {fmt(mat.consumption * mat.unit_cost * (1 + mat.loss_pct / 100))}
      </span>
      <Button size="icon" variant="ghost" className="size-6 shrink-0 text-destructive" onClick={handleDelete}>
        <Trash2 className="size-3" />
      </Button>
    </div>
  );
});

// —— Componente memoizado para linha de operação —
const OperationRow = memo(function OperationRow({
  op,
  idx,
  onUpdate,
  onDelete,
}: {
  op: OperationInline;
  idx: number;
  onUpdate: (idx: number, partial: Partial<OperationInline>) => void;
  onDelete: (id: string) => void;
}) {
  const handleName = useCallback((e: React.ChangeEvent<HTMLInputElement>) => onUpdate(idx, { name: e.target.value }), [idx, onUpdate]);
  const handleMachine = useCallback((e: React.ChangeEvent<HTMLInputElement>) => onUpdate(idx, { machine: e.target.value }), [idx, onUpdate]);
  const handleRole = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => onUpdate(idx, { role: e.target.value }), [idx, onUpdate]);
  const handleSam = useCallback((e: React.ChangeEvent<HTMLInputElement>) => onUpdate(idx, { sam: Number(e.target.value) || 0 }), [idx, onUpdate]);
  const handleRate = useCallback((e: React.ChangeEvent<HTMLInputElement>) => onUpdate(idx, { rate_per_min: Number(e.target.value) || 0 }), [idx, onUpdate]);
  const handleDelete = useCallback(() => onDelete(op.id), [op.id, onDelete]);

  return (
    <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap border border-border/60 rounded-lg p-1.5 bg-background">
      <Input value={op.name} onChange={handleName} placeholder="Operação" className="h-7 text-xs min-w-[100px] flex-1" />
      <Input value={op.machine} onChange={handleMachine} placeholder="Máquina" className="h-7 text-xs w-20" />
      <select value={op.role} onChange={handleRole} className="h-7 text-xs border border-border rounded bg-background px-1">
        <option value="">Resp.</option>
        <option value="Corte">Corte</option>
        <option value="Costura">Costura</option>
        <option value="Acabamento">Acabamento</option>
        <option value="Bordado/Silk">Bordado/Silk</option>
        <option value="Qualidade">Qualidade</option>
        <option value="Modelagem">Modelagem</option>
        <option value="Pilotagem">Pilotagem</option>
      </select>
      <div className="flex items-center gap-1 text-xs">
        <span className="text-muted-foreground">SAM</span>
        <input type="number" step="0.01" value={op.sam || ""} onChange={handleSam}
          className="h-7 w-14 text-xs text-right border border-border rounded px-1 bg-transparent tabular-nums" />
      </div>
      <div className="flex items-center gap-1 text-xs">
        <span className="text-muted-foreground">R$/min</span>
        <input type="number" step="0.01" value={op.rate_per_min || ""} onChange={handleRate}
          className="h-7 w-14 text-xs text-right border border-border rounded px-1 bg-transparent tabular-nums" />
      </div>
      <span className="text-xs font-medium tabular-nums shrink-0 w-20 text-right">
        {fmt(op.sam * op.rate_per_min)}
      </span>
      <Button size="icon" variant="ghost" className="size-6 shrink-0 text-destructive" onClick={handleDelete}>
        <Trash2 className="size-3" />
      </Button>
    </div>
  );
});

export function ProductCreationWizard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [step, setStep] = useState(0);

  // —— Dados do formulário ——
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [skuAuto, setSkuAuto] = useState(true);
  const [collectionId, setCollectionId] = useState<string>("none");
  const [category, setCategory] = useState("");
  const [silhueta, setSilhueta] = useState("");
  const [ocasiao, setOcasiao] = useState("");
  const [tecidoSugerido, setTecidoSugerido] = useState("");
  const [colors, setColors] = useState<string[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");

  // —— Ficha técnica inline (Step 2) ——
  const [materials, setMaterials] = useState<MaterialInline[]>([]);
  const [operations, setOperations] = useState<OperationInline[]>([]);
  const [matPickerOpen, setMatPickerOpen] = useState(false);

  // —— Callbacks estáveis para MaterialRow / OperationRow ——
  const updateMaterial = useCallback((idx: number, partial: Partial<MaterialInline>) => {
    setMaterials((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...partial };
      return next;
    });
  }, []);
  const deleteMaterial = useCallback((id: string) => {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  }, []);
  const updateOperation = useCallback((idx: number, partial: Partial<OperationInline>) => {
    setOperations((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...partial };
      return next;
    });
  }, []);
  const deleteOperation = useCallback((id: string) => {
    setOperations((prev) => prev.filter((o) => o.id !== id));
  }, []);

  // —— Handler para adicionar material da biblioteca ——
  const handlePickFromLibrary = useCallback((m: LibraryMaterial) => {
    setMaterials((prev) => [
      ...prev,
      {
        id: `mat_${++_matId}`,
        name: m.name,
        unit: m.unit ?? "un",
        consumption: 0,
        unit_cost: Number(m.reference_cost ?? 0),
        loss_pct: 0,
      },
    ]);
  }, []);

  // —— Custos (Step 3) ——
  const [sellPrice, setSellPrice] = useState(0);
  const [overheadPct, setOverheadPct] = useState(20);

  const materialsCost = useMemo(
    () => materials.reduce((s, m) => s + m.consumption * m.unit_cost * (1 + m.loss_pct / 100), 0),
    [materials],
  );
  const laborCost = useMemo(
    () => operations.reduce((s, o) => s + o.sam * o.rate_per_min, 0),
    [operations],
  );
  const subtotal = useMemo(() => materialsCost + laborCost, [materialsCost, laborCost]);
  const totalCost = useMemo(
    () => subtotal * (1 + overheadPct / 100),
    [subtotal, overheadPct],
  );
  const estimatedMargin = useMemo(() => {
    if (!sellPrice || sellPrice <= 0) return null;
    return ((sellPrice - totalCost) / sellPrice) * 100;
  }, [sellPrice, totalCost]);

  // —— Nova coleção inline ——
  const [showNewColl, setShowNewColl] = useState(false);
  const [newCollName, setNewCollName] = useState("");
  const [newCollSeason, setNewCollSeason] = useState("Verão");
  const currentYear = new Date().getFullYear();
  const [newCollYear, setNewCollYear] = useState(currentYear);

  // —— SKU sugerido ——
  const suggestedSku = useMemo(() => {
    if (!skuAuto) return sku;
    const base = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 4);
    if (!base) return "";
    const suffix = Date.now().toString(36).slice(-4).toUpperCase();
    return `${base}-${suffix}`;
  }, [name, skuAuto, sku]);

  // —— Coleções ——
  const { data: collections = [] } = useQuery({
    queryKey: ["collections-ref"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collections")
        .select("id, name, season, year")
        .order("name");
      if (error) throw error;
      return (data ?? []) as CollectionRef[];
    },
    enabled: open && !!user,
  });

  // —— Validação por passo ——
  const canAdvance = useMemo(() => {
    switch (step) {
      case 0:
        return !!name.trim() && collectionId !== "none";
      case 1:
        return !!category;
      default:
        return true; // steps 2,3,4 são opcionais
    }
  }, [step, name, collectionId, category]);

  // —— Criar coleção ——
  const createCollectionMut = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Sessão expirada");
      if (!newCollName.trim()) throw new Error("Informe o nome da coleção");
      const { data, error } = await supabase
        .from("collections")
        .insert({
          name: newCollName.trim(),
          season: newCollSeason,
          year: newCollYear,
          status: "briefing",
          owner_id: user.id,
        })
        .select("id, name, season, year")
        .single();
      if (error) throw error;
      return data as CollectionRef;
    },
    onSuccess: (coll) => {
      toast.success(`Coleção "${coll.name}" criada`);
      queryClient.invalidateQueries({ queryKey: ["collections-ref"] });
      setCollectionId(coll.id);
      setShowNewColl(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // —— Criar produto + ficha técnica + materiais + operações (final) ——
  const createMut = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Sessão expirada");
      const finalSku = skuAuto ? suggestedSku : sku;

      // 1. Criar produto
      const { data: product, error: prodErr } = await supabase
        .from("products")
        .insert({
          sku: finalSku,
          name: name.trim(),
          category: category || null,
          status: "rascunho",
          collection_id: collectionId,
          colors: colors.length ? colors : null,
          sizes: sizes.length ? sizes : null,
          image_url: imageUrl || null,
          description: description || null,
          cost_price: totalCost,
          sell_price: sellPrice || 0,
          owner_id: user.id,
        })
        .select("id, sku, name")
        .single();
      if (prodErr) throw prodErr;

      // 2. Se materiais ou operações foram preenchidos, cria ficha técnica
      const hasFicha = materials.length > 0 || operations.length > 0;
      if (hasFicha) {
        // Criar a tech_sheet
        const { data: sheet, error: sheetErr } = await supabase
          .from("tech_sheets")
          .insert({
            product_id: product.id,
            owner_id: user.id,
            code: `FT-${finalSku}`,
            version: 1,
            status: "rascunho",
            materials_cost: materialsCost,
            labor_cost: laborCost,
            overhead_pct: overheadPct,
            cost_price: totalCost,
          } as never)
          .select("id")
          .single();
        if (sheetErr) throw sheetErr;

        // Inserir materiais
        if (materials.length > 0) {
          const matRows = materials
            .filter((m) => m.name.trim())
            .map((m, idx) => ({
              owner_id: user.id,
              tech_sheet_id: sheet.id,
              name: m.name.trim(),
              unit: m.unit || "un",
              consumption: m.consumption || 0,
              loss_pct: m.loss_pct || 0,
              unit_cost: m.unit_cost || 0,
              total_cost: (m.consumption || 0) * (m.unit_cost || 0) * (1 + (m.loss_pct || 0) / 100),
              position: idx,
            }));
          if (matRows.length > 0) {
            const { error: matErr } = await supabase
              .from("tech_sheet_materials")
              .insert(matRows as never);
            if (matErr) throw matErr;
          }
        }

        // Inserir operações
        if (operations.length > 0) {
          const opRows = operations
            .filter((o) => o.name.trim())
            .map((o, idx) => ({
              owner_id: user.id,
              tech_sheet_id: sheet.id,
              name: o.name.trim(),
              machine: o.machine || null,
              responsible_role: o.role || null,
              sam: o.sam || 0,
              rate_per_min: o.rate_per_min || 0,
              total_cost: (o.sam || 0) * (o.rate_per_min || 0),
              position: idx,
            }));
          if (opRows.length > 0) {
            const { error: opErr } = await supabase
              .from("tech_sheet_operations")
              .insert(opRows as never);
            if (opErr) throw opErr;
          }
        }
      }

      // 3. Auto-follow: usuário vira watcher
      await supabase
        .from("product_watchers")
        .insert({ product_id: product.id, user_id: user.id, owner_id: user.id });

      return { id: product.id, sku: product.sku, name: product.name, hasFicha };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(
        `"${result.name}" criado${result.hasFicha ? " com ficha técnica!" : "!"}`,
      );
      onOpenChange(false);
      navigate({ to: "/produto/$id", params: { id: result.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // —— Reset ao abrir ——
  const reset = () => {
    setStep(0);
    setName("");
    setSku("");
    setSkuAuto(true);
    setCollectionId(collections[0]?.id ?? "none");
    setCategory("");
    setSilhueta("");
    setOcasiao("");
    setTecidoSugerido("");
    setColors([]);
    setSizes([]);
    setImageUrl("");
    setDescription("");
    setMaterials([]);
    setOperations([]);
    setSellPrice(0);
    setOverheadPct(20);
    setShowNewColl(collections.length === 0);
    _matId = 0;
    _opId = 0;
  };

  // —— Render ——
  const currentStep = WIZARD_STEPS[step];
  const isLastStep = step === WIZARD_STEPS.length - 1;
  const progress = ((step + 1) / WIZARD_STEPS.length) * 100;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
              <Sparkles className="size-5" />
            </div>
            <div>
              <DialogTitle>Novo Produto</DialogTitle>
              <DialogDescription>
                Guia rápido para criar um produto completo, do briefing ao piloto.
              </DialogDescription>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-between mt-3">
            {WIZARD_STEPS.map((s, idx) => {
              const SIcon = s.icon;
              const isActive = idx === step;
              const isDone = idx < step;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => idx < step && setStep(idx)}
                  className={cn(
                    "flex items-center gap-1.5 text-[11px] transition-colors",
                    isActive && "text-primary font-medium",
                    isDone && "text-emerald-600 cursor-pointer hover:text-emerald-700",
                    !isActive && !isDone && "text-muted-foreground",
                  )}
                >
                  <div
                    className={cn(
                      "size-6 rounded-full flex items-center justify-center",
                      isActive && "bg-primary/15 text-primary",
                      isDone && "bg-emerald-500/15 text-emerald-600",
                      !isActive && !isDone && "bg-muted text-muted-foreground",
                    )}
                  >
                    {isDone ? (
                      <CheckCircle2 className="size-3.5" />
                    ) : (
                      <SIcon className="size-3.5" />
                    )}
                  </div>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              );
            })}
          </div>
        </DialogHeader>

        <div className="py-4">
          {/* ========== PASSO 0: IDENTIDADE ========== */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <HelpCircle className="size-3.5" />
                Informe os dados básicos para identificar seu produto
              </div>

              <div className="space-y-2">
                <Label htmlFor="w-name">
                  Nome do produto <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="w-name"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Vestido Florença Midi"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="w-coll">
                    Coleção <span className="text-destructive">*</span>
                  </Label>
                  {!showNewColl ? (
                    <button
                      type="button"
                      onClick={() => setShowNewColl(true)}
                      className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <Plus className="size-3" /> Criar nova
                    </button>
                  ) : (
                    collections.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowNewColl(false)}
                        className="text-[11px] text-muted-foreground hover:underline inline-flex items-center gap-1"
                      >
                        <X className="size-3" /> Selecionar existente
                      </button>
                    )
                  )}
                </div>
                {!showNewColl ? (
                  <Select value={collectionId} onValueChange={setCollectionId}>
                    <SelectTrigger id="w-coll">
                      <SelectValue placeholder="Selecione a coleção" />
                    </SelectTrigger>
                    <SelectContent>
                      {collections.length === 0 ? (
                        <SelectItem value="none" disabled>
                          Nenhuma coleção — crie uma
                        </SelectItem>
                      ) : (
                        collections.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} ({c.season} {c.year})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 space-y-2">
                    <Input
                      placeholder="Nome da coleção (ex.: Alto Verão 2026)"
                      value={newCollName}
                      onChange={(e) => setNewCollName(e.target.value)}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={newCollSeason} onValueChange={setNewCollSeason}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SEASONS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={currentYear - 1}
                        max={currentYear + 3}
                        value={newCollYear}
                        onChange={(e) => setNewCollYear(Number(e.target.value))}
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="w-full"
                      disabled={!newCollName.trim() || createCollectionMut.isPending}
                      onClick={() => createCollectionMut.mutate()}
                    >
                      {createCollectionMut.isPending ? (
                        <><Loader2 className="size-3.5 animate-spin mr-2" /> Criando…</>
                      ) : (
                        "Criar coleção e usar"
                      )}
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="w-sku">
                  SKU{" "}
                  <span className="text-[11px] text-muted-foreground font-normal">
                    (código de referência)
                  </span>
                </Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      id="w-sku"
                      value={skuAuto ? suggestedSku : sku}
                      onChange={(e) => {
                        setSkuAuto(false);
                        setSku(e.target.value.toUpperCase());
                      }}
                      placeholder="VST-A1B2"
                    />
                  </div>
                  {!skuAuto && (
                    <Button type="button" variant="outline" size="sm" onClick={() => { setSkuAuto(true); setSku(""); }}>
                      Gerar auto
                    </Button>
                  )}
                </div>
                {skuAuto && suggestedSku && (
                  <p className="text-[11px] text-muted-foreground">
                    SKU gerado automaticamente baseado no nome.
                  </p>
                )}
              </div>

              <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                <div className="font-medium text-foreground mb-1">📌 O que é SKU?</div>
                É o código único que identifica este produto no sistema.
              </div>
            </div>
          )}

          {/* ========== PASSO 1: CARACTERÍSTICAS ========== */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <HelpCircle className="size-3.5" />
                Defina o visual e as variações do seu produto
              </div>

              <div className="space-y-2">
                <Label htmlFor="w-cat">Categoria <span className="text-destructive">*</span></Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="w-cat">
                    <SelectValue placeholder="Selecione o tipo de peça" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Cores / Variações</Label>
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setColors((prev) => prev.includes(c.value) ? prev.filter((v) => v !== c.value) : [...prev, c.value])}
                      className={cn(
                        "rounded-full px-3 py-1 text-[11px] border transition-colors",
                        colors.includes(c.value)
                          ? "bg-primary/15 text-primary border-primary/40"
                          : "bg-card text-muted-foreground border-border hover:border-muted-foreground/40",
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tamanhos (grade)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {SIZE_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSizes((prev) => prev.includes(s) ? prev.filter((v) => v !== s) : [...prev, s])}
                      className={cn(
                        "rounded px-2.5 py-1 text-[11px] border transition-colors",
                        sizes.includes(s)
                          ? "bg-primary/15 text-primary border-primary/40"
                          : "bg-card text-muted-foreground border-border hover:border-muted-foreground/40",
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Silhueta</Label>
                  <Select value={silhueta} onValueChange={setSilhueta}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo de silhueta" />
                    </SelectTrigger>
                    <SelectContent>
                      {SILHOUETTES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label} — {s.desc}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ocasião de uso</Label>
                  <Select value={ocasiao} onValueChange={setOcasiao}>
                    <SelectTrigger>
                      <SelectValue placeholder="Quando usar" />
                    </SelectTrigger>
                    <SelectContent>
                      {OCCASIONS.map((o) => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="w-tecido">Tecido sugerido (opcional)</Label>
                <Input id="w-tecido" value={tecidoSugerido} onChange={(e) => setTecidoSugerido(e.target.value)} placeholder="Ex.: Crepe Seda, Malha Algodão 30.1, Linho Viscose…" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="w-desc">Descrição (opcional)</Label>
                <Textarea id="w-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Breve descrição do produto, inspiração, referências…" rows={2} />
              </div>

              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs">
                <div className="font-medium text-amber-700 dark:text-amber-300 mb-1">💡 Dica</div>
                Cores, tamanhos, silhueta e imagem podem ser ajustados depois.
              </div>
            </div>
          )}

          {/* ========== PASSO 2: FICHA TÉCNICA ========== */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <HelpCircle className="size-3.5" />
                Materiais e operações da ficha técnica
              </div>

              {/* ---- MATERIAIS ---- */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <Ruler className="size-4 text-primary" /> Materiais (BOM)
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => setMatPickerOpen(true)}>
                      <Library className="size-3" /> Biblioteca
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => setMaterials((prev) => [...prev, newMat()])}>
                      <Plus className="size-3" /> Em branco
                    </Button>
                  </div>
                </div>
                {materials.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2">
                    Nenhum material adicionado. Clique em "Material" para adicionar.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {materials.map((mat, idx) => (
                      <MaterialRow key={mat.id} mat={mat} idx={idx} onUpdate={updateMaterial} onDelete={deleteMaterial} />
                    ))}
                  </div>
                )}
                {materials.length > 0 && (
                  <div className="text-xs text-right text-muted-foreground font-medium tabular-nums">
                    Total materiais: {fmt(materialsCost)}
                  </div>
                )}
              </div>

              {/* ---- OPERAÇÕES ---- */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="size-4 text-primary" /> Operações (BOP)
                  </div>
                  <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => setOperations((prev) => [...prev, newOp()])}>
                    <Plus className="size-3" /> Operação
                  </Button>
                </div>
                {operations.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2">
                    Nenhuma operação adicionada.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {operations.map((op, idx) => (
                      <OperationRow key={op.id} op={op} idx={idx} onUpdate={updateOperation} onDelete={deleteOperation} />
                    ))}
                  </div>
                )}
                {operations.length > 0 && (
                  <div className="text-xs text-right text-muted-foreground font-medium tabular-nums">
                    Total mão de obra: {fmt(laborCost)}
                  </div>
                )}
              </div>

              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs">
                <div className="font-medium text-primary mb-1">Dica</div>
                Preencha os materiais e operações agora, ou deixe para completar depois no Workspace do Produto.
              </div>

              {user && (
                <MaterialPickerDialog
                  ownerId={user.id}
                  open={matPickerOpen}
                  onOpenChange={setMatPickerOpen}
                  onPick={handlePickFromLibrary}
                  onCreateBlank={() => {
                    setMaterials((prev) => [...prev, newMat()]);
                    setMatPickerOpen(false);
                  }}
                />
              )}
            </div>
          )}

          {/* ========== PASSO 3: CUSTOS ========== */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <HelpCircle className="size-3.5" />
                Configure o preço de venda e veja a margem estimada
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="w-sell">Preço de venda sugerido (R$)</Label>
                  <Input
                    id="w-sell"
                    type="number"
                    step="0.01"
                    min={0}
                    value={sellPrice || ""}
                    onChange={(e) => setSellPrice(Number(e.target.value) || 0)}
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="w-overhead">Overhead (%)</Label>
                  <Input
                    id="w-overhead"
                    type="number"
                    step="1"
                    min={0}
                    max={100}
                    value={overheadPct}
                    onChange={(e) => setOverheadPct(Number(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* Card de resumo de custos */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Wallet className="size-4 text-primary" />
                  <span className="text-sm font-medium">Resumo de custos</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg bg-muted/30 p-2">
                    <div className="text-[10px] text-muted-foreground uppercase">Materiais</div>
                    <div className="text-base font-semibold tabular-nums">{fmt(materialsCost)}</div>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-2">
                    <div className="text-[10px] text-muted-foreground uppercase">Mão de obra</div>
                    <div className="text-base font-semibold tabular-nums">{fmt(laborCost)}</div>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-2">
                    <div className="text-[10px] text-muted-foreground uppercase">Overhead ({overheadPct}%)</div>
                    <div className="text-base font-semibold tabular-nums">{fmt(subtotal * overheadPct / 100)}</div>
                  </div>
                  <div className="rounded-lg bg-primary/10 border border-primary/30 p-2">
                    <div className="text-[10px] text-primary uppercase font-medium">Custo total</div>
                    <div className="text-base font-semibold tabular-nums text-primary">{fmt(totalCost)}</div>
                  </div>
                </div>

                {/* Indicador de margem */}
                {sellPrice > 0 && estimatedMargin !== null && (
                  <div className={cn(
                    "rounded-lg p-3 flex items-center gap-3",
                    estimatedMargin >= 50
                      ? "bg-emerald-500/10 border border-emerald-500/30"
                      : estimatedMargin >= 30
                        ? "bg-amber-500/10 border border-amber-500/30"
                        : "bg-rose-500/10 border border-rose-500/30",
                  )}>
                    {estimatedMargin >= 50 ? (
                      <TrendingUp className="size-5 text-emerald-600" />
                    ) : estimatedMargin >= 30 ? (
                      <TrendingDown className="size-5 text-amber-600" />
                    ) : (
                      <TrendingDown className="size-5 text-rose-600" />
                    )}
                    <div>
                      <div className="text-xs font-semibold">
                        Margem estimada: <span className={cn(
                          "text-base",
                          estimatedMargin >= 50 ? "text-emerald-600" : estimatedMargin >= 30 ? "text-amber-600" : "text-rose-600",
                        )}>
                          {estimatedMargin.toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Preço R$ {sellPrice.toFixed(2)} · Custo R$ {totalCost.toFixed(2)}
                        {estimatedMargin < 30 && " · ⚠️ Margem baixa"}
                      </div>
                    </div>
                  </div>
                )}
                {(!sellPrice || sellPrice <= 0) && (
                  <div className="text-xs text-muted-foreground">
                    Defina um preço de venda para ver a margem estimada.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========== PASSO 4: REVISÃO ========== */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <CheckCircle2 className="size-3.5 text-emerald-600" />
                Revise os dados antes de criar
              </div>

              {/* Dados do produto */}
              <div className="rounded-xl border border-border bg-card divide-y divide-border">
                <div className="p-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Nome</span>
                  <span className="text-sm font-medium">{name}</span>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">SKU</span>
                  <span className="text-sm font-mono">{skuAuto ? suggestedSku : sku}</span>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Coleção</span>
                  <span className="text-sm">{collections.find((c) => c.id === collectionId)?.name ?? "—"}</span>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Categoria</span>
                  <span className="text-sm capitalize">{category || "—"}</span>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Cores</span>
                  <span className="text-sm">
                    {colors.length ? colors.map((c) => COLOR_OPTIONS.find((o) => o.value === c)?.label ?? c).join(", ") : "—"}
                  </span>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Tamanhos</span>
                  <span className="text-sm">{sizes.length ? sizes.join(", ") : "—"}</span>
                </div>
              </div>

              {/* Resumo da ficha técnica */}
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="text-xs font-semibold mb-2 flex items-center gap-2">
                  <FileText className="size-3.5 text-primary" /> Ficha técnica
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center justify-between p-1.5 rounded bg-muted/30">
                    <span className="text-muted-foreground">Materiais</span>
                    <span className="font-medium tabular-nums">{materials.length} itens · {fmt(materialsCost)}</span>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded bg-muted/30">
                    <span className="text-muted-foreground">Operações</span>
                    <span className="font-medium tabular-nums">{operations.length} itens · {fmt(laborCost)}</span>
                  </div>
                </div>
              </div>

              {/* Resumo de custos */}
              <div className="rounded-xl border border-primary/40 bg-primary/5 p-3">
                <div className="text-xs font-semibold flex items-center gap-2 mb-2">
                  <Wallet className="size-3.5 text-primary" /> Custos
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">Custo total</div>
                    <div className="text-base font-bold tabular-nums text-primary">{fmt(totalCost)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Preço venda</div>
                    <div className="text-base font-bold tabular-nums">{sellPrice > 0 ? fmt(sellPrice) : "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Margem</div>
                    <div className={cn(
                      "text-base font-bold tabular-nums",
                      estimatedMargin !== null && estimatedMargin >= 50 ? "text-emerald-600" :
                      estimatedMargin !== null && estimatedMargin >= 30 ? "text-amber-600" :
                      estimatedMargin !== null ? "text-rose-600" : ""
                    )}>
                      {estimatedMargin !== null ? `${estimatedMargin.toFixed(1)}%` : "—"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline do que vem depois */}
              <div className="rounded-lg bg-muted/30 p-4">
                <div className="text-xs font-medium mb-2">📋 O que acontece depois da criação?</div>
                <ol className="space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="size-5 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0 text-[10px] font-medium">1</span>
                    Você será levado ao <strong>Workspace do Produto</strong>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="size-5 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0 text-[10px] font-medium">2</span>
                    O <strong>Ciclo de Vida</strong> mostrará as etapas do produto
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="size-5 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0 text-[10px] font-medium">3</span>
                    Complete a <strong>Ficha Técnica</strong> e solicite <strong>Protótipo</strong>
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
          {step > 0 ? (
            <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="size-4 mr-1" /> Voltar
            </Button>
          ) : (
            <span />
          )}

          <div className="flex gap-2">
            {!isLastStep ? (
              <Button type="button" onClick={() => setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1))} disabled={!canAdvance}>
                {step === WIZARD_STEPS.length - 2 ? "Revisar" : "Continuar"}
                <ArrowRight className="size-4 ml-1" />
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() => createMut.mutate()}
                  disabled={createMut.isPending || !name.trim() || collectionId === "none"}
                >
                  {createMut.isPending ? (
                    <><Loader2 className="size-4 animate-spin mr-2" /> Criando…</>
                  ) : (
                    <><Sparkles className="size-4 mr-1.5" /> Criar Produto</>
                  )}
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

