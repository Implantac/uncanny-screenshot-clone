import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, Trash2, Pencil, Sparkles, Tag, Upload, ImageIcon, Loader2, Download } from "lucide-react";
import { exportToCsv } from "@/lib/csv";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

async function resolveImageUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = await supabase.storage.from("product-images").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

function ProductImage({ path }: { path: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { resolveImageUrl(path).then(setUrl); }, [path]);
  if (!path) {
    return <div className="aspect-[4/3] rounded-lg bg-muted/40 grid place-items-center"><ImageIcon className="size-8 text-muted-foreground/40" /></div>;
  }
  return <div className="aspect-[4/3] rounded-lg overflow-hidden bg-muted/40">{url && <img src={url} alt="" className="size-full object-cover" />}</div>;
}

export const Route = createFileRoute("/_app/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos · USE MODA OS" },
      { name: "description", content: "Catálogo de produtos da operação de moda." },
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
  description: string | null;
  cost_price: number;
  sell_price: number;
  status: "rascunho" | "desenvolvimento" | "aprovado" | "producao" | "descontinuado";
  image_url: string | null;
  sizes: string[];
  colors: string[];
  created_at: string;
};

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
  desenvolvimento: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  aprovado: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  producao: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  descontinuado: "bg-destructive/20 text-destructive border-destructive/30",
};

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ProdutosPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

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

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Package className="size-6 text-primary" /> Produtos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Catálogo completo — do rascunho à produção.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportToCsv("produtos", products.map((p) => ({ ...p, status: STATUS_LABELS[p.status] })), [
            { key: "sku", label: "SKU" }, { key: "name", label: "Nome" }, { key: "category", label: "Categoria" },
            { key: "status", label: "Status" }, { key: "cost_price", label: "Custo" }, { key: "sell_price", label: "Venda" },
            { key: "sizes", label: "Tamanhos" }, { key: "colors", label: "Cores" }, { key: "description", label: "Descrição" },
          ])} disabled={!products.length} className="gap-2"><Download className="size-4" />Exportar CSV</Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2">
            <Plus className="size-4" /> Novo Produto
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Carregando…</div>
      ) : products.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <Sparkles className="size-10 text-primary mx-auto mb-3" />
          <h3 className="font-semibold mb-1">Nenhum produto ainda</h3>
          <p className="text-sm text-muted-foreground mb-4">Cadastre seu primeiro produto.</p>
          <Button onClick={() => { setEditing(null); setOpen(true); }}>Cadastrar produto</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {products.map((p) => (
            <div key={p.id} className="glass rounded-xl p-5 flex flex-col gap-3 hover:border-primary/40 transition-colors">
              <ProductImage path={p.image_url} />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{p.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Tag className="size-3" />{p.sku}{p.category ? ` · ${p.category}` : ""}
                  </p>
                </div>
                <Badge variant="outline" className={STATUS_COLORS[p.status]}>{STATUS_LABELS[p.status]}</Badge>
              </div>
              {p.description && <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Custo</p>
                  <p className="font-medium">{fmtBRL(Number(p.cost_price))}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Venda</p>
                  <p className="font-medium text-primary">{fmtBRL(Number(p.sell_price))}</p>
                </div>
              </div>
              {(p.sizes.length > 0 || p.colors.length > 0) && (
                <div className="flex flex-wrap gap-1">
                  {p.sizes.map((s) => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
                  {p.colors.map((c, i) => (
                    <span key={i} className="size-5 rounded-full border border-border" style={{ background: c }} title={c} />
                  ))}
                </div>
              )}
              {p.owner_id === user?.id && (
                <div className="flex justify-end gap-1 pt-2 border-t border-border">
                  <button onClick={() => { setEditing(p); setOpen(true); }} className="size-7 grid place-items-center rounded hover:bg-muted">
                    <Pencil className="size-3.5" />
                  </button>
                  <button onClick={() => confirm("Remover este produto?") && deleteMut.mutate(p.id)} className="size-7 grid place-items-center rounded hover:bg-destructive/20 text-destructive">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ProductDialog open={open} onOpenChange={setOpen} editing={editing} userId={user?.id} collections={collections} />
    </div>
  );
}

function ProductDialog({
  open, onOpenChange, editing, userId, collections,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Product | null;
  userId?: string;
  collections: CollectionRef[];
}) {
  const qc = useQueryClient();
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
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
    if (open && editing) {
      setSku(editing.sku);
      setName(editing.name);
      setCategory(editing.category || "");
      setDescription(editing.description || "");
      setCostPrice(Number(editing.cost_price));
      setSellPrice(Number(editing.sell_price));
      setStatus(editing.status);
      setCollectionId(editing.collection_id || "none");
      setSizesStr(editing.sizes.join(", "));
      setColorsStr(editing.colors.join(", "));
      setImagePath(editing.image_url);
      resolveImageUrl(editing.image_url).then(setPreviewUrl);
    } else if (open) {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  function reset() {
    setSku(""); setName(""); setCategory(""); setDescription("");
    setCostPrice(0); setSellPrice(0); setStatus("rascunho");
    setCollectionId("none"); setSizesStr(""); setColorsStr("");
    setImagePath(null); setPreviewUrl(null);
  }

  async function handleUpload(file: File) {
    if (!userId) { toast.error("Sessão expirada"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: false });
      if (error) throw error;
      setImagePath(path);
      const url = await resolveImageUrl(path);
      setPreviewUrl(url);
      toast.success("Imagem enviada");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sessão expirada");
      const payload = {
        sku, name,
        category: category || null,
        description: description || null,
        cost_price: costPrice,
        sell_price: sellPrice,
        status,
        collection_id: collectionId === "none" ? null : collectionId,
        image_url: imagePath,
        sizes: sizesStr.split(",").map((s) => s.trim()).filter(Boolean),
        colors: colorsStr.split(",").map((s) => s.trim()).filter(Boolean),
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
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(editing ? "Produto atualizado" : "Produto criado");
      onOpenChange(false);
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle>
          <DialogDescription>Informações de catálogo, preço e variações.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }} className="space-y-4">
          <div className="space-y-2">
            <Label>Imagem</Label>
            <div className="flex items-center gap-3">
              <div className="size-20 rounded-lg overflow-hidden bg-muted/40 grid place-items-center shrink-0">
                {previewUrl ? <img src={previewUrl} alt="" className="size-full object-cover" /> : <ImageIcon className="size-6 text-muted-foreground/40" />}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-2">
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                {imagePath ? "Trocar imagem" : "Enviar imagem"}
              </Button>
              {imagePath && (
                <Button type="button" variant="ghost" size="sm" onClick={() => { setImagePath(null); setPreviewUrl(null); }}>Remover</Button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>SKU</Label>
              <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="VST-001" required />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Vestido" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Vestido Florença" required />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Preço de custo</Label>
              <Input type="number" step="0.01" value={costPrice} onChange={(e) => setCostPrice(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Preço de venda</Label>
              <Input type="number" step="0.01" value={sellPrice} onChange={(e) => setSellPrice(Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Product["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Coleção</Label>
              <Select value={collectionId} onValueChange={setCollectionId}>
                <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {collections.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.season} {c.year})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tamanhos (separados por vírgula)</Label>
            <Input value={sizesStr} onChange={(e) => setSizesStr(e.target.value)} placeholder="P, M, G, GG" />
          </div>
          <div className="space-y-2">
            <Label>Cores (hex separados por vírgula)</Label>
            <Input value={colorsStr} onChange={(e) => setColorsStr(e.target.value)} placeholder="#000000, #ffffff" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saveMut.isPending}>
              {saveMut.isPending ? "Salvando…" : editing ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
