import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ImageIcon, Loader2, Package, Pencil, Plus, Search, Tag, Trash2, Upload } from "lucide-react";
import { exportToCsv } from "@/lib/csv";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos · USE MODA OS" },
      { name: "description", content: "Catálogo premium com histórico, coleção vinculada, preços e visão de margem." },
    ],
  }),
  component: ProdutosPage,
});

type Product = {
  id: string;
  owner_id: string;
  collection_id: string | null;
  sku: string;
  name: string;
  category: string | null;
  product_group: string | null;
  subgroup: string | null;
  product_class: string | null;
  grade: string | null;
  description: string | null;
  cost_price: number;
  sell_price: number;
  status: "rascunho" | "desenvolvimento" | "aprovado" | "producao" | "descontinuado";
  image_url: string | null;
  sizes: string[];
  colors: string[];
  created_at: string;
};

const GROUPS = ["Feminino", "Masculino", "Infantil", "Unissex", "Acessórios"];
const SUBGROUPS = ["Superior", "Inferior", "Vestido", "Conjunto", "Sobreposição", "Íntimo", "Praia", "Acessório"];
const CLASSES = ["Camiseta", "Camisa", "Blusa", "Vestido", "Saia", "Calça", "Short", "Bermuda", "Jaqueta", "Casaco", "Macacão", "Body"];
const GRADES = ["PP-GG", "P-GG", "PP-XGG", "36-46", "38-48", "40-50", "1-4", "4-10", "10-16", "Único"];

type CollectionRef = { id: string; name: string; season: string; year: number };

const STATUS_LABELS: Record<Product["status"], string> = {
  rascunho: "Rascunho",
  desenvolvimento: "Em desenvolvimento",
  aprovado: "Aprovado",
  producao: "Em produção",
  descontinuado: "Descontinuado",
};

const STATUS_COLORS: Record<Product["status"], string> = {
  rascunho: "bg-muted text-muted-foreground",
  desenvolvimento: "bg-warning/20 text-warning border-warning/30",
  aprovado: "bg-info/20 text-info border-info/30",
  producao: "bg-primary/20 text-primary border-primary/30",
  descontinuado: "bg-destructive/20 text-destructive border-destructive/30",
};

function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function resolveImageUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("/")) return path;
  const { data } = await supabase.storage.from("product-images").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

function ProdutosPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  useRealtime("products", ["products", "collections-ref"]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Product[];
    },
  });

  const { data: collections = [] } = useQuery({
    queryKey: ["collections-ref"],
    queryFn: async () => {
      const { data, error } = await supabase.from("collections").select("id, name, season, year").order("created_at", { ascending: false });
      if (error) throw error;
      return data as CollectionRef[];
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) =>
      [product.name, product.sku, product.category || "", STATUS_LABELS[product.status]].some((value) => value.toLowerCase().includes(term)),
    );
  }, [products, search]);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => (current && filtered.some((item) => item.id === current) ? current : filtered[0].id));
  }, [filtered]);

  const selected = useMemo(() => filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null, [filtered, selectedId]);
  const selectedCollection = useMemo(() => collections.find((item) => item.id === selected?.collection_id) ?? null, [collections, selected?.collection_id]);

  const summary = useMemo(() => {
    const totalMargin = products.reduce((sum, item) => sum + (Number(item.sell_price || 0) - Number(item.cost_price || 0)), 0);
    const avgMargin = products.length ? totalMargin / products.length : 0;
    return {
      total: products.length,
      active: products.filter((item) => item.status !== "descontinuado").length,
      inDev: products.filter((item) => item.status === "desenvolvimento").length,
      avgMargin,
    };
  }, [products]);

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto removido");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">Módulo 4</div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Package className="size-6 text-primary" /> Produtos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Catálogo premium com leitura rápida de coleção, margem, status e histórico do item.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => exportToCsv("produtos", products.map((product) => ({ ...product, status: STATUS_LABELS[product.status] })), [
              { key: "sku", label: "SKU" },
              { key: "name", label: "Nome" },
              { key: "category", label: "Categoria" },
              { key: "status", label: "Status" },
              { key: "cost_price", label: "Custo" },
              { key: "sell_price", label: "Venda" },
              { key: "sizes", label: "Tamanhos" },
              { key: "colors", label: "Cores" },
            ])}
            disabled={!products.length}
            className="gap-2"
          >
            <Download className="size-4" /> Exportar CSV
          </Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2">
            <Plus className="size-4" /> Novo produto
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Total no catálogo" value={String(summary.total)} />
        <SummaryCard label="Itens ativos" value={String(summary.active)} />
        <SummaryCard label="Em desenvolvimento" value={String(summary.inDev)} />
        <SummaryCard label="Margem média" value={brl(summary.avgMargin)} />
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Carregando…</div>
      ) : products.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <Package className="size-10 text-primary mx-auto mb-3" />
          <h2 className="font-semibold mb-1">Nenhum produto cadastrado</h2>
          <p className="text-sm text-muted-foreground mb-4">Comece o catálogo adicionando o primeiro SKU da operação.</p>
          <Button onClick={() => { setEditing(null); setOpen(true); }}>Cadastrar produto</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-4">
          <section className="glass rounded-xl p-4 space-y-3">
            <div className="relative">
              <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por SKU, nome ou categoria" className="pl-9" />
            </div>
            <div className="space-y-2">
              {filtered.map((product) => {
                const active = product.id === selected?.id;
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setSelectedId(product.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${active ? "border-primary/40 bg-primary/10" : "border-border bg-background/30 hover:bg-muted/30"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{product.name}</div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Tag className="size-3" /> {product.sku}</div>
                      </div>
                      <Badge variant="outline" className={STATUS_COLORS[product.status]}>{STATUS_LABELS[product.status]}</Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{product.category || "Sem categoria"}</span>
                      <span>{brl(Number(product.sell_price || 0))}</span>
                    </div>
                  </button>
                );
              })}
              {!filtered.length && <div className="text-sm text-muted-foreground text-center py-8">Nenhum resultado para essa busca.</div>}
            </div>
          </section>

          {selected && (
            <ProductDetail
              product={selected}
              collection={selectedCollection}
              canEdit={selected.owner_id === user?.id}
              onEdit={() => {
                setEditing(selected);
                setOpen(true);
              }}
              onDelete={() => deleteMut.mutate(selected.id)}
            />
          )}
        </div>
      )}

      <ProductDialog open={open} onOpenChange={setOpen} editing={editing} userId={user?.id} collections={collections} />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-xl p-5">
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function ProductDetail({
  product,
  collection,
  canEdit,
  onEdit,
  onDelete,
}: {
  product: Product;
  collection: CollectionRef | null;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { data: imageUrl } = useQuery({
    queryKey: ["product-detail-image", product.image_url],
    queryFn: () => resolveImageUrl(product.image_url),
    staleTime: 50 * 60 * 1000,
  });

  const margin = Number(product.sell_price || 0) - Number(product.cost_price || 0);
  const marginPct = Number(product.sell_price || 0) > 0 ? (margin / Number(product.sell_price)) * 100 : 0;

  const timeline = [
    { label: "Produto criado", detail: new Date(product.created_at).toLocaleDateString("pt-BR") },
    { label: "Status atual", detail: STATUS_LABELS[product.status] },
    { label: "Coleção", detail: collection ? `${collection.name} · ${collection.season} ${collection.year}` : "Sem coleção vinculada" },
  ];

  return (
    <section className="space-y-4">
      <div className="glass rounded-xl overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-0">
          <div className="min-h-[320px] bg-muted/20 overflow-hidden">
            {imageUrl ? (
              <img src={imageUrl} alt={product.name} className="size-full object-cover" loading="lazy" />
            ) : (
              <div className="size-full grid place-items-center text-muted-foreground">
                <ImageIcon className="size-10 text-primary/70" />
              </div>
            )}
          </div>

          <div className="p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={STATUS_COLORS[product.status]}>{STATUS_LABELS[product.status]}</Badge>
              {product.product_group && <Badge variant="outline">{product.product_group}</Badge>}
              {product.subgroup && <Badge variant="outline">{product.subgroup}</Badge>}
              {product.product_class && <Badge variant="outline">{product.product_class}</Badge>}
              {product.grade && <Badge variant="outline">Grade {product.grade}</Badge>}
              {collection && <Badge variant="outline">{collection.name}</Badge>}
            </div>

            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-2">SKU</div>
              <h2 className="text-2xl font-semibold tracking-tight">{product.name}</h2>
              <p className="text-sm text-muted-foreground mt-2">{product.sku}{product.description ? ` · ${product.description}` : ""}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <SummaryCard label="Preço de custo" value={brl(Number(product.cost_price || 0))} />
              <SummaryCard label="Preço de venda" value={brl(Number(product.sell_price || 0))} />
              <SummaryCard label="Margem unitária" value={brl(margin)} />
              <SummaryCard label="Margem %" value={`${marginPct.toFixed(1)}%`} />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-2">Tamanhos</div>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.length ? product.sizes.map((size) => <Badge key={size} variant="secondary">{size}</Badge>) : <span className="text-sm text-muted-foreground">Sem grade cadastrada</span>}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-2">Cores</div>
                <div className="flex flex-wrap gap-2 items-center">
                  {product.colors.length ? product.colors.map((color) => (
                    <div key={color} className="flex items-center gap-2 rounded-full border border-border px-2 py-1 text-xs">
                      <span className="size-3 rounded-full border border-border" style={{ background: color }} />
                      {color}
                    </div>
                  )) : <span className="text-sm text-muted-foreground">Sem cores cadastradas</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4">
        <div className="glass rounded-xl p-5 space-y-4">
          <div>
            <div className="text-sm font-semibold">Timeline visual</div>
            <div className="text-xs text-muted-foreground mt-1">Rastro principal do produto dentro do catálogo.</div>
          </div>
          <div className="space-y-4">
            {timeline.map((step, index) => (
              <div key={step.label} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="size-8 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-semibold">{index + 1}</div>
                  {index < timeline.length - 1 && <div className="w-px flex-1 bg-border mt-2" />}
                </div>
                <div className="pb-4">
                  <div className="font-medium">{step.label}</div>
                  <div className="text-sm text-muted-foreground mt-1">{step.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-xl p-5 space-y-4">
          <div>
            <div className="text-sm font-semibold">Leitura comercial</div>
            <div className="text-xs text-muted-foreground mt-1">Resumo rápido para estilo, comercial e pricing.</div>
          </div>
          {[
            collection ? `Vinculado à coleção ${collection.name}, pronta para leitura comercial integrada.` : "Produto ainda não conectado a uma coleção.",
            margin > 0 ? `Margem bruta positiva de ${brl(margin)} por item.` : "Preço de venda abaixo ou igual ao custo cadastrado.",
            product.status === "aprovado" || product.status === "producao" ? "Produto apto para fluxo comercial." : "Produto ainda em fase de desenvolvimento interno.",
          ].map((line) => (
            <div key={line} className="rounded-xl border border-border bg-background/30 p-3 text-sm text-muted-foreground">{line}</div>
          ))}

          {canEdit && (
            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" onClick={onEdit} className="gap-2"><Pencil className="size-4" /> Editar</Button>
              <Button variant="outline" onClick={onDelete} className="gap-2 text-destructive hover:text-destructive"><Trash2 className="size-4" /> Remover</Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ProductDialog({
  open,
  onOpenChange,
  editing,
  userId,
  collections,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  editing: Product | null;
  userId?: string;
  collections: CollectionRef[];
}) {
  const queryClient = useQueryClient();
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [productGroup, setProductGroup] = useState<string>("none");
  const [subgroup, setSubgroup] = useState<string>("none");
  const [productClass, setProductClass] = useState<string>("none");
  const [grade, setGrade] = useState<string>("none");
  const [description, setDescription] = useState("");
  const [costPrice, setCostPrice] = useState(0);
  const [sellPrice, setSellPrice] = useState(0);
  const [status, setStatus] = useState<Product["status"]>("rascunho");
  const [collectionId, setCollectionId] = useState<string>("none");
  const [sizesStr, setSizesStr] = useState("");
  const [colorsStr, setColorsStr] = useState("");
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setSku(editing.sku);
      setName(editing.name);
      setCategory(editing.category || "");
      setProductGroup(editing.product_group || "none");
      setSubgroup(editing.subgroup || "none");
      setProductClass(editing.product_class || "none");
      setGrade(editing.grade || "none");
      setDescription(editing.description || "");
      setCostPrice(Number(editing.cost_price));
      setSellPrice(Number(editing.sell_price));
      setStatus(editing.status);
      setCollectionId(editing.collection_id || "none");
      setSizesStr(editing.sizes.join(", "));
      setColorsStr(editing.colors.join(", "));
      setImagePath(editing.image_url);
      resolveImageUrl(editing.image_url).then(setPreviewUrl);
      return;
    }
    reset();
  }, [editing, open]);

  function reset() {
    setSku("");
    setName("");
    setCategory("");
    setProductGroup("none");
    setSubgroup("none");
    setProductClass("none");
    setGrade("none");
    setDescription("");
    setCostPrice(0);
    setSellPrice(0);
    setStatus("rascunho");
    setCollectionId("none");
    setSizesStr("");
    setColorsStr("");
    setImagePath(null);
    setPreviewUrl(null);
  }

  async function handleUpload(file: File) {
    if (!userId) {
      toast.error("Sessão expirada");
      return;
    }
    setUploading(true);
    try {
      const extension = file.name.split(".").pop() || "jpg";
      const path = `${userId}/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: false });
      if (error) throw error;
      setImagePath(path);
      setPreviewUrl(await resolveImageUrl(path));
      toast.success("Imagem enviada");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sessão expirada");
      const payload = {
        sku,
        name,
        category: category || null,
        product_group: productGroup === "none" ? null : productGroup,
        subgroup: subgroup === "none" ? null : subgroup,
        product_class: productClass === "none" ? null : productClass,
        grade: grade === "none" ? null : grade,
        description: description || null,
        cost_price: costPrice,
        sell_price: sellPrice,
        status,
        collection_id: collectionId === "none" ? null : collectionId,
        image_url: imagePath,
        sizes: sizesStr.split(",").map((item) => item.trim()).filter(Boolean),
        colors: colorsStr.split(",").map((item) => item.trim()).filter(Boolean),
      };
      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert({ ...payload, owner_id: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(editing ? "Produto atualizado" : "Produto criado");
      onOpenChange(false);
      reset();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={(value) => {
      onOpenChange(value);
      if (!value) reset();
    }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle>
          <DialogDescription>Cadastro de catálogo com coleção vinculada, preços e variações.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => {
          event.preventDefault();
          saveMut.mutate();
        }} className="space-y-4">
          <div className="space-y-2">
            <Label>Imagem</Label>
            <div className="flex items-center gap-3">
              <div className="size-20 rounded-lg overflow-hidden bg-muted/40 grid place-items-center shrink-0">
                {previewUrl ? <img src={previewUrl} alt="Preview do produto" className="size-full object-cover" /> : <ImageIcon className="size-6 text-muted-foreground/40" />}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleUpload(file);
              }} />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-2">
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                {imagePath ? "Trocar imagem" : "Enviar imagem"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>SKU</Label>
              <Input value={sku} onChange={(event) => setSku(event.target.value)} placeholder="VST-001" required />
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Vestido Florença" required />
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/30 p-3 space-y-3">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Classificação</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Grupo</Label>
                <Select value={productGroup} onValueChange={setProductGroup}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não definido</SelectItem>
                    {GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subgrupo</Label>
                <Select value={subgroup} onValueChange={setSubgroup}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não definido</SelectItem>
                    {SUBGROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Classe</Label>
                <Select value={productClass} onValueChange={setProductClass}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não definido</SelectItem>
                    {CLASSES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Categoria livre</Label>
                <Input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Ex: Festa" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Narrativa comercial, modelagem, diferencial do produto..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Preço de custo</Label>
              <Input type="number" step="0.01" value={costPrice} onChange={(event) => setCostPrice(Number(event.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Preço de venda</Label>
              <Input type="number" step="0.01" value={sellPrice} onChange={(event) => setSellPrice(Number(event.target.value))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as Product["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([key, value]) => <SelectItem key={key} value={key}>{value}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Coleção</Label>
              <Select value={collectionId} onValueChange={setCollectionId}>
                <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {collections.map((collection) => (
                    <SelectItem key={collection.id} value={collection.id}>{collection.name} ({collection.season} {collection.year})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Grade</Label>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger><SelectValue placeholder="Selecione a grade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não definida</SelectItem>
                  {GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tamanhos da grade</Label>
              <Input value={sizesStr} onChange={(event) => setSizesStr(event.target.value)} placeholder="P, M, G, GG" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cores</Label>
            <Input value={colorsStr} onChange={(event) => setColorsStr(event.target.value)} placeholder="#111111, #f4ede2 ou Preto, Off-white" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending ? "Salvando…" : editing ? "Atualizar" : "Criar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}