import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Sparkles, Tag } from "lucide-react";
import { toast } from "sonner";
import { SkuPerformancePanel } from "@/components/sku-performance-panel";

export const Route = createFileRoute("/_authenticated/_app/variantes")({
  head: () => ({
    meta: [
      { title: "Variantes & SKU · USE MODA OS" },
      { name: "description", content: "Cores, tamanhos e SKUs por produto. Base para grade de produção." },
    ],
  }),
  component: VariantsPage,
});

type Product = { id: string; sku: string; name: string };
type Color = { id: string; product_id: string; name: string; hex: string | null; position: number; active: boolean };
type Size = { id: string; product_id: string; label: string; position: number; active: boolean };
type Variant = { id: string; product_id: string; color_id: string | null; size_id: string | null; sku: string; ean: string | null; active: boolean };

function VariantsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [productId, setProductId] = useState<string>("");

  const products = useQuery({
    queryKey: ["variants-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, sku, name").order("name");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  const colors = useQuery({
    queryKey: ["variant-colors", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("product_color_options").select("*").eq("product_id", productId).order("position");
      if (error) throw error;
      return (data ?? []) as Color[];
    },
  });

  const sizes = useQuery({
    queryKey: ["variant-sizes", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("product_size_options").select("*").eq("product_id", productId).order("position");
      if (error) throw error;
      return (data ?? []) as Size[];
    },
  });

  const variants = useQuery({
    queryKey: ["product-variants", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("product_variants").select("*").eq("product_id", productId);
      if (error) throw error;
      return (data ?? []) as Variant[];
    },
  });

  const addColor = useMutation({
    mutationFn: async (v: { name: string; hex: string }) => {
      const { error } = await (supabase as any).from("product_color_options").insert({
        owner_id: user!.id, product_id: productId, name: v.name, hex: v.hex || null, position: (colors.data?.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["variant-colors", productId] }); toast.success("Cor adicionada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const addSize = useMutation({
    mutationFn: async (v: { label: string }) => {
      const { error } = await (supabase as any).from("product_size_options").insert({
        owner_id: user!.id, product_id: productId, label: v.label, position: (sizes.data?.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["variant-sizes", productId] }); toast.success("Tamanho adicionado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const delColor = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("product_color_options").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["variant-colors", productId] }),
  });
  const delSize = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("product_size_options").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["variant-sizes", productId] }),
  });
  const delVariant = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("product_variants").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["product-variants", productId] }),
  });

  const product = products.data?.find((p) => p.id === productId);

  const generate = useMutation({
    mutationFn: async () => {
      if (!product) throw new Error("Selecione um produto");
      const existing = new Set((variants.data ?? []).map((v) => `${v.color_id ?? ""}|${v.size_id ?? ""}`));
      const rows: any[] = [];
      const cs = colors.data ?? [];
      const ss = sizes.data ?? [];
      const pairs: Array<{ c: Color | null; s: Size | null }> =
        cs.length && ss.length ? cs.flatMap((c) => ss.map((s) => ({ c, s })))
        : cs.length ? cs.map((c) => ({ c, s: null as any }))
        : ss.length ? ss.map((s) => ({ c: null as any, s }))
        : [];
      for (const { c, s } of pairs) {
        const key = `${c?.id ?? ""}|${s?.id ?? ""}`;
        if (existing.has(key)) continue;
        const parts = [product.sku, c?.name?.slice(0, 3).toUpperCase(), s?.label].filter(Boolean);
        rows.push({
          owner_id: user!.id, product_id: productId,
          color_id: c?.id ?? null, size_id: s?.id ?? null,
          sku: parts.join("-"), active: true,
        });
      }
      if (!rows.length) return 0;
      const { error } = await (supabase as any).from("product_variants").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => { qc.invalidateQueries({ queryKey: ["product-variants", productId] }); toast.success(`${n} SKU(s) gerado(s)`); },
    onError: (e: any) => toast.error(e.message),
  });

  const variantRows = useMemo(() => {
    const cMap = new Map((colors.data ?? []).map((c) => [c.id, c]));
    const sMap = new Map((sizes.data ?? []).map((s) => [s.id, s]));
    return (variants.data ?? []).map((v) => ({
      ...v,
      colorName: v.color_id ? cMap.get(v.color_id)?.name ?? "—" : "—",
      sizeLabel: v.size_id ? sMap.get(v.size_id)?.label ?? "—" : "—",
    }));
  }, [variants.data, colors.data, sizes.data]);

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Variantes & SKU</h1>
          <p className="text-sm text-muted-foreground">Cores, tamanhos e SKUs gerados por combinação.</p>
        </div>
        <Select value={productId} onValueChange={setProductId}>
          <SelectTrigger className="w-[320px]"><SelectValue placeholder="Selecione um produto…" /></SelectTrigger>
          <SelectContent>
            {(products.data ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.sku} · {p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      {!productId ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
          Selecione um produto para gerenciar a grade.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ColorPanel colors={colors.data ?? []} loading={colors.isLoading} onAdd={(v) => addColor.mutate(v)} onDelete={(id) => delColor.mutate(id)} />
          <SizePanel sizes={sizes.data ?? []} loading={sizes.isLoading} onAdd={(v) => addSize.mutate(v)} onDelete={(id) => delSize.mutate(id)} />

          <div className="lg:col-span-2 rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Tag className="size-4 text-primary" />
                <h2 className="font-medium">SKUs ({variantRows.length})</h2>
              </div>
              <Button size="sm" onClick={() => generate.mutate()} disabled={generate.isPending}>
                <Sparkles className="size-4 mr-1" /> Gerar combinações
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs">
                  <tr>
                    <th className="text-left px-3 py-2">SKU</th>
                    <th className="text-left px-3 py-2">Cor</th>
                    <th className="text-left px-3 py-2">Tamanho</th>
                    <th className="text-left px-3 py-2">EAN</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="px-3 py-2 w-12" />
                  </tr>
                </thead>
                <tbody>
                  {variantRows.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Sem variantes ainda. Adicione cores e tamanhos e clique em Gerar.</td></tr>
                  ) : variantRows.map((v) => (
                    <tr key={v.id} className="border-t border-border">
                      <td className="px-3 py-2 font-mono">{v.sku}</td>
                      <td className="px-3 py-2">{v.colorName}</td>
                      <td className="px-3 py-2">{v.sizeLabel}</td>
                      <td className="px-3 py-2 text-muted-foreground">{v.ean ?? "—"}</td>
                      <td className="px-3 py-2"><Badge variant={v.active ? "default" : "secondary"}>{v.active ? "ativo" : "inativo"}</Badge></td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="ghost" size="icon" onClick={() => delVariant.mutate(v.id)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ColorPanel({ colors, loading, onAdd, onDelete }: { colors: Color[]; loading: boolean; onAdd: (v: { name: string; hex: string }) => void; onDelete: (id: string) => void }) {
  const [name, setName] = useState("");
  const [hex, setHex] = useState("#000000");
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="p-4 border-b border-border"><h2 className="font-medium">Cores</h2></div>
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <Input placeholder="Ex: Azul Marinho" value={name} onChange={(e) => setName(e.target.value)} />
          <input type="color" value={hex} onChange={(e) => setHex(e.target.value)} className="h-10 w-12 rounded border border-border bg-transparent" />
          <Button onClick={() => { if (!name.trim()) return; onAdd({ name: name.trim(), hex }); setName(""); }}>
            <Plus className="size-4" />
          </Button>
        </div>
        <div className="space-y-1">
          {loading ? <p className="text-sm text-muted-foreground">Carregando…</p> :
            colors.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma cor.</p> :
            colors.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/40">
                <div className="flex items-center gap-2">
                  <span className="size-5 rounded border border-border" style={{ background: c.hex ?? "transparent" }} />
                  <span className="text-sm">{c.name}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onDelete(c.id)}><Trash2 className="size-4" /></Button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function SizePanel({ sizes, loading, onAdd, onDelete }: { sizes: Size[]; loading: boolean; onAdd: (v: { label: string }) => void; onDelete: (id: string) => void }) {
  const [label, setLabel] = useState("");
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="p-4 border-b border-border"><h2 className="font-medium">Tamanhos</h2></div>
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <Input placeholder="Ex: P, M, G ou 38" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Button onClick={() => { if (!label.trim()) return; onAdd({ label: label.trim() }); setLabel(""); }}>
            <Plus className="size-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {loading ? <p className="text-sm text-muted-foreground">Carregando…</p> :
            sizes.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum tamanho.</p> :
            sizes.map((s) => (
              <Badge key={s.id} variant="secondary" className="gap-1">
                {s.label}
                <button onClick={() => onDelete(s.id)} className="ml-1 hover:text-destructive"><Trash2 className="size-3" /></button>
              </Badge>
            ))}
        </div>
      </div>
    </div>
  );
}
