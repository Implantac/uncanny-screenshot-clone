import { useState, useMemo } from "react";
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
  PenTool,
  FileText,
  Scissors,
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
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type CollectionRef = { id: string; name: string; season: string; year: number };

/**
 * WIZARD DE CRIAÇÃO — 4 passos simples
 *
 * Passo 1: Identidade — Nome, SKU, Coleção
 * Passo 2: Características — Categoria, Cores, Tamanhos, Imagem
 * Passo 3: Ficha Técnica — Materiais, Medidas (opcional no início)
 * Passo 4: Revisão e próximo passo — Resumo + o que fazer agora
 */
const WIZARD_STEPS = [
  { id: "identidade", label: "Identidade", icon: Shirt },
  { id: "caracteristicas", label: "Características", icon: Palette },
  { id: "ficha", label: "Ficha técnica", icon: FileText },
  { id: "revisao", label: "Revisão", icon: CheckCircle2 },
] as const;

const CATEGORIES = [
  "Vestido",
  "Blusa",
  "Camisa",
  "Calça",
  "Saia",
  "Short",
  "Jaqueta",
  "Casaco",
  "Macacão",
  "Body",
  "Top",
  "Cropped",
  "Bermuda",
  "Kimono",
  "Coletê",
  "Outro",
];

const COLOR_OPTIONS = [
  { value: "preto", label: "Preto" },
  { value: "branco", label: "Branco" },
  { value: "vermelho", label: "Vermelho" },
  { value: "azul", label: "Azul" },
  { value: "verde", label: "Verde" },
  { value: "amarelo", label: "Amarelo" },
  { value: "rosa", label: "Rosa" },
  { value: "roxo", label: "Roxo" },
  { value: "laranja", label: "Laranja" },
  { value: "marrom", label: "Marrom" },
  { value: "cinza", label: "Cinza" },
  { value: "bege", label: "Bege" },
  { value: "estampa", label: "Estampado" },
  { value: "listrado", label: "Listrado" },
  { value: "poa", label: "Poá" },
];

const SIZE_OPTIONS = ["PP", "P", "M", "G", "GG", "XG", "36", "38", "40", "42", "44", "46", "48"];
const SEASONS = ["Verão", "Inverno", "Alto Verão", "Meia Estação", "Resort", "Cápsula"];

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
  const [colors, setColors] = useState<string[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");

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
      case 2:
        return true; // opcional
      case 3:
        return true;
      default:
        return true;
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

  // —— Criar produto (final) ——
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
          cost_price: 0,
          sell_price: 0,
          owner_id: user.id,
        })
        .select("id, sku, name")
        .single();
      if (prodErr) throw prodErr;

      // 2. Auto-follow: usuário vira watcher
      await supabase
        .from("product_watchers")
        .insert({ product_id: product.id, user_id: user.id, owner_id: user.id });

      return product as { id: string; sku: string; name: string };
    },
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(`"${product.name}" criado com sucesso!`);
      onOpenChange(false);
      navigate({ to: "/produto/$id", params: { id: product.id } });
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
    setColors([]);
    setSizes([]);
    setImageUrl("");
    setDescription("");
    setShowNewColl(collections.length === 0);
  };

  // —— Render ——
  const currentStep = WIZARD_STEPS[step];
  const StepIcon = currentStep.icon;
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
          {/* ========== PASSO 1: IDENTIDADE ========== */}
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
                        <>
                          <Loader2 className="size-3.5 animate-spin mr-2" /> Criando…
                        </>
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSkuAuto(true);
                        setSku("");
                      }}
                    >
                      Gerar auto
                    </Button>
                  )}
                </div>
                {skuAuto && suggestedSku && (
                  <p className="text-[11px] text-muted-foreground">
                    SKU gerado automaticamente baseado no nome. Digite para personalizar.
                  </p>
                )}
              </div>

              <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                <div className="font-medium text-foreground mb-1">📌 O que é SKU?</div>
                É o código único que identifica este produto no sistema. Use o gerado ou crie o seu.
              </div>
            </div>
          )}

          {/* ========== PASSO 2: CARACTERÍSTICAS ========== */}
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
                      <SelectItem key={c} value={c.toLowerCase()}>
                        {c}
                      </SelectItem>
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
                      onClick={() =>
                        setColors((prev) =>
                          prev.includes(c.value)
                            ? prev.filter((v) => v !== c.value)
                            : [...prev, c.value],
                        )
                      }
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
                {colors.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Nenhuma cor selecionada. Você pode adicionar depois.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Tamanhos (grade)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {SIZE_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() =>
                        setSizes((prev) =>
                          prev.includes(s)
                            ? prev.filter((v) => v !== s)
                            : [...prev, s],
                        )
                      }
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
                {sizes.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Nenhum tamanho selecionado. Você pode definir a grade depois.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="w-desc">Descrição (opcional)</Label>
                <Textarea
                  id="w-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Breve descrição do produto, inspiração, tecido sugerido…"
                  rows={2}
                />
              </div>

              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs">
                <div className="font-medium text-amber-700 dark:text-amber-300 mb-1">💡 Dica</div>
                Não se preocupe em acertar tudo agora. Cores, tamanhos e imagem podem ser ajustados depois.
              </div>
            </div>
          )}

          {/* ========== PASSO 3: FICHA TÉCNICA (OPCIONAL NO INÍCIO) ========== */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <HelpCircle className="size-3.5" />
                Configure os detalhes técnicos ou pule e faça depois
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-primary" />
                    <span className="text-sm font-medium">Ficha técnica</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Materiais, aviamentos, medidas e operações de costura.
                  </p>
                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30 bg-amber-500/10">
                    ⏳ Fazer depois
                  </Badge>
                </div>

                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Ruler className="size-4 text-primary" />
                    <span className="text-sm font-medium">Tabela de medidas</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Pontos de medida por tamanho com tolerâncias.
                  </p>
                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30 bg-amber-500/10">
                    ⏳ Fazer depois
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="w-image">URL da imagem (opcional)</Label>
                <Input
                  id="w-image"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://…"
                />
              </div>

              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs">
                <div className="font-medium text-primary mb-1">✅ Ficha técnica pode vir depois</div>
                O produto será criado como "rascunho". Quando estiver pronto, acesse a aba "Ficha técnica" dentro do produto para preencher materiais, medidas e custos.
              </div>
            </div>
          )}

          {/* ========== PASSO 4: REVISÃO ========== */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <CheckCircle2 className="size-3.5 text-emerald-600" />
                Revise os dados antes de criar
              </div>

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
                  <span className="text-sm">
                    {collections.find((c) => c.id === collectionId)?.name ?? "—"}
                  </span>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Categoria</span>
                  <span className="text-sm capitalize">{category || "—"}</span>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Cores</span>
                  <span className="text-sm">
                    {colors.length
                      ? colors
                          .map(
                            (c) =>
                              COLOR_OPTIONS.find((o) => o.value === c)?.label ?? c,
                          )
                          .join(", ")
                      : "—"}
                  </span>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Tamanhos</span>
                  <span className="text-sm">{sizes.length ? sizes.join(", ") : "—"}</span>
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
                    O <strong>Ciclo de Vida</strong> mostrará as 9 etapas do produto (Concepção → Produção)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="size-5 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0 text-[10px] font-medium">3</span>
                    Complete a <strong>Ficha Técnica</strong> e solicite <strong>Protótipo</strong> para avançar
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="size-5 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0 text-[10px] font-medium">4</span>
                    Após aprovações, o produto segue para <strong>PCP e Produção</strong>
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
              <Button
                type="button"
                onClick={() => setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1))}
                disabled={!canAdvance}
              >
                {step === WIZARD_STEPS.length - 2 ? "Revisar" : "Continuar"}{" "}
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
                    <>
                      <Loader2 className="size-4 animate-spin mr-2" /> Criando…
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4 mr-1.5" /> Criar Produto
                    </>
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

