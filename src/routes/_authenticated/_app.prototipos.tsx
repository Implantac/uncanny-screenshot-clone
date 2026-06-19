import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Scissors,
  Plus,
  Trash2,
  Pencil,
  Search,
  X,
  Download,
  GitCompare,
  FileText,
  Check,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PrototypeCommentsButton } from "@/components/prototype-comments";
import {
  PrototypeAdjustmentsButton,
  SECTORS,
  type AdjustmentSector,
} from "@/components/prototype-adjustments";
import { PrototypeTimelineButton } from "@/components/prototype-timeline";
import { DevIntelligencePanel } from "@/components/dev-intelligence-panel";
import { ViewPresetsDropdown, type ViewPresetFilters } from "@/components/view-presets-dropdown";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/_authenticated/_app/prototipos")({
  validateSearch: zodValidator(
    z.object({
      q: fallback(z.string().trim().max(80), "").default(""),
      stage: fallback(
        z.enum(["all", "solicitado", "em_confeccao", "em_prova", "aprovado", "reprovado"]),
        "all",
      ).default("all"),
      productId: fallback(z.string().regex(UUID_RE).optional(), undefined),
    }),
  ),
  head: () => ({
    meta: [
      { title: "Protótipos · USE MODA OS" },
      { name: "description", content: "Ciclo de protótipos, provas e aprovações." },
    ],
  }),
  component: Prototipos,
});

type Stage = "solicitado" | "em_confeccao" | "em_prova" | "aprovado" | "reprovado";
type Prototype = {
  id: string;
  owner_id: string;
  product_id: string | null;
  supplier_id: string | null;
  code: string;
  stage: Stage;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  current_sector?: AdjustmentSector | null;
  needs_adjustment?: boolean;
};
type Ref = { id: string; name: string };

const STAGE_LABEL: Record<Stage, string> = {
  solicitado: "Solicitado",
  em_confeccao: "Em confecção",
  em_prova: "Em prova",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
};
const STAGE_COLOR: Record<Stage, string> = {
  solicitado: "bg-muted text-muted-foreground",
  em_confeccao: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  em_prova: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  aprovado: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  reprovado: "bg-destructive/20 text-destructive border-destructive/30",
};

function Prototipos() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useRealtime("prototypes", ["prototypes"]);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { q, stage: stageFilter, productId: deepProductId } = search;
  const setQ = (v: string) =>
    navigate({ search: (p: typeof search) => ({ ...p, q: v }), replace: true });
  const setStageFilter = (v: string) =>
    navigate({
      search: (p: typeof search) => ({ ...p, stage: v as typeof search.stage }),
      replace: true,
    });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Prototype | null>(null);
  const [form, setForm] = useState({
    code: "",
    product_id: "",
    supplier_id: "",
    stage: "solicitado" as Stage,
    due_date: "",
    notes: "",
    current_sector: "" as AdjustmentSector | "",
  });

  const handledProductIdRef = useRef<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const toggleSel = (id: string) =>
    setSelectedIds((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : s.length >= 3 ? s : [...s, id],
    );

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["prototypes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prototypes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Prototype[];
    },
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["products-ref"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,image_url")
        .order("name");
      if (error) throw error;
      return data as (Ref & { image_url: string | null })[];
    },
  });

  useEffect(() => {
    if (!deepProductId || productsLoading) return;
    if (handledProductIdRef.current === deepProductId) return;
    handledProductIdRef.current = deepProductId;
    const exists = products.some((p) => p.id === deepProductId);
    if (!exists) {
      toast.error("Produto não encontrado ou inválido");
      navigate({ search: (p: typeof search) => ({ ...p, productId: undefined }), replace: true });
      return;
    }
    setEditing(null);
    setForm({
      code: "",
      product_id: deepProductId,
      supplier_id: "",
      stage: "solicitado",
      due_date: "",
      notes: "",
      current_sector: "",
    });
    setOpen(true);
    navigate({ search: (p: typeof search) => ({ ...p, productId: undefined }), replace: true });
  }, [deepProductId, productsLoading, products, navigate]);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-ref"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id,name").order("name");
      if (error) throw error;
      return data as Ref[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      if (!form.code.trim()) throw new Error("Código obrigatório");
      const payload = {
        owner_id: user.id,
        code: form.code.trim(),
        product_id: form.product_id || null,
        supplier_id: form.supplier_id || null,
        stage: form.stage,
        due_date: form.due_date || null,
        notes: form.notes.trim() || null,
        current_sector: form.current_sector || null,
      };
      if (editing) {
        const { error } = await supabase.from("prototypes").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("prototypes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prototypes"] });
      toast.success(editing ? "Protótipo atualizado" : "Protótipo criado");
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prototypes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prototypes"] });
      toast.success("Removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("prototypes")
        .update({ stage: "aprovado", needs_adjustment: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prototypes"] });
      toast.success("Protótipo aprovado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  function reset() {
    setOpen(false);
    setEditing(null);
    setForm({
      code: "",
      product_id: "",
      supplier_id: "",
      stage: "solicitado",
      due_date: "",
      notes: "",
      current_sector: "",
    });
  }

  function openEdit(p: Prototype) {
    setEditing(p);
    setForm({
      code: p.code,
      product_id: p.product_id ?? "",
      supplier_id: p.supplier_id ?? "",
      stage: p.stage,
      due_date: p.due_date ?? "",
      notes: p.notes ?? "",
      current_sector: (p.current_sector ?? "") as AdjustmentSector | "",
    });
    setOpen(true);
  }

  const productName = (id: string | null) => products.find((p) => p.id === id)?.name ?? "—";
  const supplierName = (id: string | null) => suppliers.find((s) => s.id === id)?.name ?? "—";

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((p) => {
      if (stageFilter !== "all" && p.stage !== stageFilter) return false;
      if (!term) return true;
      return (
        p.code.toLowerCase().includes(term) ||
        productName(p.product_id).toLowerCase().includes(term) ||
        supplierName(p.supplier_id).toLowerCase().includes(term)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, q, stageFilter, products, suppliers]);

  function exportSpec(p: Prototype) {
    const spec = {
      format: "USE-MODA-PROTO-SPEC/1.0",
      exported_at: new Date().toISOString(),
      prototype: {
        code: p.code,
        product: productName(p.product_id),
        supplier: supplierName(p.supplier_id),
        stage: p.stage,
        due_date: p.due_date,
        notes: p.notes,
      },
    };
    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proto-${p.code}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Spec ${p.code} exportada`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 grid place-items-center">
            <Scissors className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Protótipos</h1>
            <p className="text-sm text-muted-foreground">Solicitações, provas e aprovações</p>
          </div>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="size-4 mr-2" />
          Nova solicitação
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <>
          <DevIntelligencePanel />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(Object.keys(STAGE_LABEL) as Stage[]).map((st) => {
              const n = items.filter((i) => i.stage === st).length;
              const pct = items.length ? Math.round((n / items.length) * 100) : 0;
              return (
                <div key={st} className="rounded-xl border border-border bg-card/50 p-4 space-y-2">
                  <Badge variant="outline" className={STAGE_COLOR[st]}>
                    {STAGE_LABEL[st]}
                  </Badge>
                  <div className="text-2xl font-semibold">{n}</div>
                  <div className="h-1 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground">{pct}% do funil</div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por código, produto ou facção…"
                className="pl-9"
              />
              {q && (
                <button
                  onClick={() => setQ("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 size-6 grid place-items-center text-muted-foreground hover:text-foreground"
                  aria-label="Limpar busca"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="sm:w-56">
                <SelectValue placeholder="Etapa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas etapas</SelectItem>
                {(Object.keys(STAGE_LABEL) as Stage[]).map((st) => (
                  <SelectItem key={st} value={st}>
                    {STAGE_LABEL[st]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {(Object.keys(STAGE_LABEL) as Stage[]).map((st) => {
              const col = filtered.filter((i) => i.stage === st);
              return (
                <div
                  key={st}
                  className="rounded-xl border border-border bg-muted/10 p-3 space-y-2 min-h-[200px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{STAGE_LABEL[st]}</span>
                    <span className="text-xs text-muted-foreground">{col.length}</span>
                  </div>
                  {col.map((p) => (
                    <div
                      key={p.id}
                      className={`rounded-lg border bg-card hover:bg-muted/30 transition p-3 space-y-1 group ${p.needs_adjustment ? "border-amber-500/60" : "border-border"}`}
                    >
                      <button
                        onClick={() => user?.id === p.owner_id && openEdit(p)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-mono text-xs text-muted-foreground">{p.code}</div>
                          {p.current_sector && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded border border-border bg-muted/40 text-muted-foreground">
                              {SECTORS.find((s) => s.key === p.current_sector)?.label}
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-medium truncate">
                          {productName(p.product_id)}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {supplierName(p.supplier_id)}
                        </div>
                        {p.due_date && (
                          <div className="text-[10px] text-muted-foreground">
                            Prazo: {p.due_date}
                          </div>
                        )}
                        {p.needs_adjustment && (
                          <div className="text-[10px] text-amber-600 mt-1 font-medium">
                            ⚠ Aguardando ajuste
                          </div>
                        )}
                      </button>
                      <div className="flex justify-end gap-1 -mb-1 -mr-1 opacity-70 group-hover:opacity-100 transition">
                        {(p.stage === "em_prova" || p.stage === "em_confeccao") &&
                          !p.needs_adjustment && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Aprovar protótipo"
                              onClick={(e) => {
                                e.stopPropagation();
                                approve.mutate(p.id);
                              }}
                            >
                              <Check className="size-4 text-emerald-500" />
                            </Button>
                          )}
                        {p.stage === "aprovado" && p.product_id && (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Criar ficha técnica deste protótipo"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate({
                                to: "/ficha-tecnica",
                                search: { productId: p.product_id! },
                              });
                            }}
                          >
                            <FileText className="size-4 text-emerald-500" />
                          </Button>
                        )}
                        <Link
                          to="/prototipo/$id"
                          params={{ id: p.id }}
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        >
                          <Button size="icon" variant="ghost" title="Abrir página do protótipo">
                            <Sparkles className="size-4 text-primary" />
                          </Button>
                        </Link>
                        <PrototypeTimelineButton prototypeId={p.id} prototypeCode={p.code} />
                        <PrototypeAdjustmentsButton
                          prototypeId={p.id}
                          prototypeCode={p.code}
                          defaultSector={p.current_sector ?? null}
                          needsAdjustment={p.needs_adjustment}
                        />
                        <PrototypeCommentsButton prototypeId={p.id} prototypeCode={p.code} />
                      </div>
                    </div>
                  ))}
                  {!col.length && (
                    <p className="text-xs text-muted-foreground/60 text-center py-6">vazio</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="w-10 px-3"></th>
                  <th className="text-left px-4 py-3">Código</th>
                  <th className="text-left px-4 py-3">Produto</th>
                  <th className="text-left px-4 py-3">Facção</th>
                  <th className="text-left px-4 py-3">Etapa</th>
                  <th className="text-left px-4 py-3">Prazo</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(p.id)}
                        onChange={() => toggleSel(p.id)}
                        disabled={!selectedIds.includes(p.id) && selectedIds.length >= 3}
                        title="Selecionar para comparar (máx. 3)"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{p.code}</td>
                    <td className="px-4 py-3">{productName(p.product_id)}</td>
                    <td className="px-4 py-3">{supplierName(p.supplier_id)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={STAGE_COLOR[p.stage]}>
                        {STAGE_LABEL[p.stage]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.due_date ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => exportSpec(p)}
                          title="Exportar spec"
                        >
                          <Download className="size-4" />
                        </Button>
                        {(p.stage === "em_prova" || p.stage === "em_confeccao") &&
                          !p.needs_adjustment && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Aprovar protótipo"
                              onClick={() => approve.mutate(p.id)}
                            >
                              <Check className="size-4 text-emerald-500" />
                            </Button>
                          )}
                        {p.stage === "aprovado" && p.product_id && (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Criar ficha técnica deste protótipo"
                            onClick={() =>
                              navigate({
                                to: "/ficha-tecnica",
                                search: { productId: p.product_id! },
                              })
                            }
                          >
                            <FileText className="size-4 text-emerald-500" />
                          </Button>
                        )}
                        <PrototypeTimelineButton prototypeId={p.id} prototypeCode={p.code} />
                        <PrototypeAdjustmentsButton
                          prototypeId={p.id}
                          prototypeCode={p.code}
                          defaultSector={p.current_sector ?? null}
                          needsAdjustment={p.needs_adjustment}
                        />
                        <PrototypeCommentsButton prototypeId={p.id} prototypeCode={p.code} />
                        {user?.id === p.owner_id && (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                              <Pencil className="size-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => del.mutate(p.id)}>
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      {items.length === 0
                        ? "Nenhum protótipo ainda"
                        : "Nenhum resultado para os filtros"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selectedIds.length >= 2 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 glass rounded-full pl-4 pr-2 py-2 shadow-lg flex items-center gap-3">
          <GitCompare className="size-4 text-primary" />
          <span className="text-sm">{selectedIds.length} protótipos selecionados</span>
          <Button size="sm" onClick={() => setCompareOpen(true)}>
            Comparar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
            Limpar
          </Button>
        </div>
      )}

      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="size-5 text-primary" /> Comparar protótipos
            </DialogTitle>
          </DialogHeader>
          {(() => {
            const selected = selectedIds
              .map((id) => items.find((x) => x.id === id))
              .filter(Boolean) as Prototype[];
            const diff = (key: keyof Prototype) =>
              new Set(selected.map((p) => String(p[key] ?? "—"))).size > 1;
            const diffCls = (k: keyof Prototype) =>
              diff(k) ? "bg-amber-500/10 border-amber-500/30 rounded px-1.5 py-0.5" : "";
            return (
              <div
                className={`grid gap-3 ${selected.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}
              >
                {selected.map((p) => {
                  const prod = products.find((x) => x.id === p.product_id);
                  const days = Math.floor(
                    (Date.now() - new Date(p.created_at).getTime()) / 86400000,
                  );
                  return (
                    <div key={p.id} className="rounded-lg border border-border p-4 space-y-2">
                      <div className="aspect-square rounded-md overflow-hidden bg-muted/40 border border-border">
                        {prod?.image_url ? (
                          <img
                            src={prod.image_url}
                            alt={prod.name}
                            loading="lazy"
                            className="size-full object-cover"
                          />
                        ) : (
                          <div className="size-full grid place-items-center text-xs text-muted-foreground">
                            sem foto
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge
                          variant="outline"
                          className={`${STAGE_COLOR[p.stage]} ${diff("stage") ? "ring-1 ring-amber-500/50" : ""}`}
                        >
                          {STAGE_LABEL[p.stage]}
                        </Badge>
                        <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
                      </div>
                      <div
                        className={`text-sm font-medium ${diff("product_id") ? "bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5" : ""}`}
                      >
                        {productName(p.product_id)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Facção:{" "}
                        <span className={diffCls("supplier_id")}>
                          {supplierName(p.supplier_id)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Prazo: <span className={diffCls("due_date")}>{p.due_date ?? "—"}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Ciclo:{" "}
                        <span className={days > 30 ? "text-amber-500 font-medium" : ""}>
                          {days}d
                        </span>{" "}
                        ({new Date(p.created_at).toLocaleDateString("pt-BR")})
                      </div>
                      {p.notes && (
                        <div className="text-xs mt-2 pt-2 border-t border-border whitespace-pre-wrap">
                          {p.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
          <div className="text-[11px] text-muted-foreground pt-2 border-t border-border">
            Campos destacados em âmbar diferem entre os pilotos selecionados.
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={(o) => !o && reset()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar protótipo" : "Novo protótipo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Código *</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="PT-001"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Produto</Label>
                <Select
                  value={form.product_id}
                  onValueChange={(v) => setForm({ ...form, product_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Facção</Label>
                <Select
                  value={form.supplier_id}
                  onValueChange={(v) => setForm({ ...form, supplier_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Etapa</Label>
                <Select
                  value={form.stage}
                  onValueChange={(v) => setForm({ ...form, stage: v as Stage })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STAGE_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prazo</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Setor atual</Label>
              <Select
                value={form.current_sector}
                onValueChange={(v) => setForm({ ...form, current_sector: v as AdjustmentSector })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {SECTORS.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={reset}>
              Cancelar
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
