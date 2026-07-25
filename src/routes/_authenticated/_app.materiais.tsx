import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFabNewAction } from "@/components/contextual-fab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Search, Package, ImageOff, Pencil, X, Save } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";
import { StorageUploader } from "@/components/storage-uploader";
import { QuickSupplierDialog } from "@/components/quick-supplier-dialog";

export const Route = createFileRoute("/_authenticated/_app/materiais")({
  head: () => ({
    meta: [
      { title: "Biblioteca de Materiais · USE MODA PLM" },
      { name: "description", content: "Tecidos, aviamentos e cores reutilizáveis entre coleções." },
    ],
  }),
  component: Page,
});

type Supplier = { id: string; name: string };
type Item = {
  id: string;
  kind: string;
  code: string;
  name: string;
  composition: string | null;
  color_hex: string | null;
  unit: string | null;
  reference_cost: number;
  active: boolean;
  image_url: string | null;
  preferred_supplier_id: string | null;
  preferred_supplier?: Supplier | null;
};

const KINDS = ["tecido", "aviamento", "cor", "estampa", "etiqueta", "outros"] as const;

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quickSupplierOpen, setQuickSupplierOpen] = useState(false);
  useFabNewAction(() => setDialogOpen(true));

  const [form, setForm] = useState({
    kind: "tecido",
    code: "",
    name: "",
    composition: "",
    color_hex: "",
    unit: "m",
    reference_cost: 0,
    image_url: "" as string | null | "",
    preferred_supplier_id: null as string | null,
  });

  const items = useQuery({
    queryKey: ["material-library"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("material_library")
        .select(
          "*, preferred_supplier:suppliers!material_library_preferred_supplier_id_fkey(id,name)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  const suppliers = useQuery({
    queryKey: ["suppliers-lite"],
    queryFn: async () => {
      const { data } = await supabase
        .from("suppliers")
        .select("id,name")
        .eq("active", true)
        .order("name");
      return (data ?? []) as Supplier[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const payload = {
        owner_id: user!.id,
        kind: form.kind,
        code: form.code,
        name: form.name,
        composition: form.composition || null,
        color_hex: form.color_hex || null,
        unit: form.unit,
        reference_cost: form.reference_cost,
        image_url: form.image_url || null,
        preferred_supplier_id: form.preferred_supplier_id,
      };
      const { error } = await (supabase as any).from("material_library").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Material adicionado");
      setForm({
        kind: "tecido",
        code: "",
        name: "",
        composition: "",
        color_hex: "",
        unit: "m",
        reference_cost: 0,
        image_url: "",
        preferred_supplier_id: null,
      });
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["material-library"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      // Guardrail: bloqueia exclusão se o material estiver em fichas técnicas
      const { data: usage, error: usageErr } = await (supabase as any).rpc(
        "material_library_usage",
        { _material_id: id },
      );
      if (usageErr) throw usageErr;
      if (Array.isArray(usage) && usage.length > 0) {
        const samples = usage
          .slice(0, 3)
          .map((u: any) => u.product_sku || u.tech_sheet_code)
          .filter(Boolean)
          .join(", ");
        const extra = usage.length > 3 ? ` (+${usage.length - 3})` : "";
        throw new Error(
          `Material em uso em ${usage.length} ficha(s) técnica(s): ${samples}${extra}. Remova das fichas antes de excluir.`,
        );
      }
      const { error } = await (supabase as any).from("material_library").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["material-library"] });
      toast.success("Material excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return (items.data ?? []).filter((it) => {
      if (filter !== "todos" && it.kind !== filter) return false;
      if (!t) return true;
      return (
        it.name.toLowerCase().includes(t) ||
        it.code.toLowerCase().includes(t) ||
        (it.composition ?? "").toLowerCase().includes(t) ||
        (it.preferred_supplier?.name ?? "").toLowerCase().includes(t)
      );
    });
  }, [items.data, filter, search]);

  const selected = useMemo(
    () => (items.data ?? []).find((i) => i.id === selectedId) ?? null,
    [items.data, selectedId],
  );

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        eyebrow="Biblioteca"
        title="Biblioteca de Materiais"
        description="Tecidos, aviamentos e cores reutilizáveis entre coleções."
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-1">
                <Plus className="h-4 w-4" /> Novo material
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Novo material</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <StorageUploader
                    bucket="materials"
                    value={form.image_url || null}
                    onChange={(url) => setForm({ ...form, image_url: url || "" })}
                    accept="image/*"
                    kind="image"
                    label="Foto do material"
                  />
                </div>
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select
                  value={form.preferred_supplier_id ?? "none"}
                  onValueChange={(v) =>
                    setForm({ ...form, preferred_supplier_id: v === "none" ? null : v })
                  }
                >
                  <SelectTrigger><SelectValue placeholder="Fornecedor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem fornecedor</SelectItem>
                    {suppliers.data?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Código"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
                <Input
                  placeholder="Nome"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <Input
                  placeholder="Composição"
                  value={form.composition}
                  onChange={(e) => setForm({ ...form, composition: e.target.value })}
                  className="md:col-span-2"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-10">Cor</span>
                  <Input
                    type="color"
                    value={form.color_hex || "#000000"}
                    onChange={(e) => setForm({ ...form, color_hex: e.target.value })}
                    className="w-16 p-1 h-9"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Unid."
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Custo ref."
                    value={form.reference_cost}
                    onChange={(e) => setForm({ ...form, reference_cost: Number(e.target.value) })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button
                  onClick={() => add.mutate()}
                  disabled={!form.code || !form.name || add.isPending}
                >
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1 max-w-lg">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, código, composição, fornecedor…"
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <TagButton active={filter === "todos"} onClick={() => setFilter("todos")}>
          Todos <span className="opacity-60 ml-1">{items.data?.length ?? 0}</span>
        </TagButton>
        {KINDS.map((k) => {
          const count = items.data?.filter((i) => i.kind === k).length ?? 0;
          return (
            <TagButton key={k} active={filter === k} onClick={() => setFilter(k)}>
              {k} <span className="opacity-60 ml-1">{count}</span>
            </TagButton>
          );
        })}
      </div>

      {items.isLoading ? (
        <div className="text-center text-muted-foreground py-12">Carregando biblioteca…</div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed rounded-xl py-16 text-center text-muted-foreground">
          <Package className="size-10 mx-auto mb-2 opacity-40" />
          Nenhum material encontrado.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map((it) => (
            <MaterialCard
              key={it.id}
              item={it}
              onOpen={() => setSelectedId(it.id)}
              onDelete={() => remove.mutate(it.id)}
            />
          ))}
        </div>
      )}

      <MaterialDetailSheet
        item={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelectedId(null)}
        suppliers={suppliers.data ?? []}
        onDelete={() => selected && remove.mutate(selected.id)}
      />
    </div>
  );
}

function TagButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function MaterialCard({
  item,
  onOpen,
  onDelete,
}: {
  item: Item;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative rounded-xl border border-border bg-card overflow-hidden hover:shadow-lg hover:border-primary/40 transition text-left"
    >
      <div
        className="aspect-square w-full relative overflow-hidden"
        style={{
          background: item.image_url
            ? undefined
            : item.color_hex || "hsl(var(--muted))",
        }}
      >
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-full object-cover group-hover:scale-105 transition"
            loading="lazy"
          />
        ) : !item.color_hex ? (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <ImageOff className="size-8" />
          </div>
        ) : null}
        <span className="absolute top-2 left-2 text-[10px] font-medium bg-background/85 backdrop-blur px-2 py-0.5 rounded-full border border-border/50">
          {item.kind}
        </span>
        <span
          role="button"
          tabIndex={0}
          aria-label="Excluir material"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              onDelete();
            }
          }}
          className="absolute top-2 right-2 size-7 rounded-full bg-background/90 backdrop-blur opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-destructive hover:bg-destructive hover:text-destructive-foreground cursor-pointer"
        >
          <Trash2 className="size-3.5" />
        </span>
      </div>
      <div className="p-2.5 space-y-0.5">
        <div className="font-medium text-sm leading-tight line-clamp-2">{item.name}</div>
        <div className="text-[11px] text-muted-foreground truncate">
          {item.preferred_supplier?.name ?? "Sem fornecedor"}
        </div>
        <div className="flex items-baseline justify-between pt-1">
          <span className="text-[10px] font-mono text-muted-foreground truncate">{item.code}</span>
          <span className="text-sm font-semibold tabular-nums">
            R$ {Number(item.reference_cost ?? 0).toFixed(2)}
            <span className="text-[10px] text-muted-foreground font-normal">
              /{item.unit ?? "un"}
            </span>
          </span>
        </div>
      </div>
    </button>
  );
}

function MaterialDetailSheet({
  item,
  open,
  onOpenChange,
  suppliers,
  onDelete,
}: {
  item: Item | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  suppliers: Supplier[];
  onDelete: () => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Item | null>(item);

  useEffect(() => {
    setDraft(item);
    setEditing(false);
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = useMutation({
    mutationFn: async () => {
      if (!draft) return;
      const { error } = await (supabase as any)
        .from("material_library")
        .update({
          kind: draft.kind,
          code: draft.code,
          name: draft.name,
          composition: draft.composition || null,
          color_hex: draft.color_hex || null,
          unit: draft.unit || null,
          reference_cost: draft.reference_cost,
          image_url: draft.image_url || null,
          preferred_supplier_id: draft.preferred_supplier_id,
        })
        .eq("id", draft.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Material atualizado");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["material-library"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!item || !draft) return null;
  const d = draft;
  const set = <K extends keyof Item>(k: K, v: Item[K]) => setDraft({ ...d, [k]: v });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            {editing ? "Editar material" : d.name}
          </SheetTitle>
          <SheetDescription className="font-mono text-xs">{d.code}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {editing ? (
            <StorageUploader
              bucket="materials"
              value={d.image_url}
              onChange={(url) => set("image_url", url || null)}
              accept="image/*"
              kind="image"
              label="Foto do material"
            />
          ) : (
            <div
              className="aspect-square w-full rounded-xl overflow-hidden border border-border relative"
              style={{ background: d.image_url ? undefined : d.color_hex || "hsl(var(--muted))" }}
            >
              {d.image_url ? (
                <img src={d.image_url} alt={d.name} className="w-full h-full object-cover" />
              ) : !d.color_hex ? (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <ImageOff className="size-12" />
                </div>
              ) : null}
              <span className="absolute top-3 left-3 text-xs font-medium bg-background/90 backdrop-blur px-2.5 py-1 rounded-full border border-border/50">
                {d.kind}
              </span>
            </div>
          )}

          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Categoria">
                <Select value={d.kind} onValueChange={(v) => set("kind", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Fornecedor">
                <Select
                  value={d.preferred_supplier_id ?? "none"}
                  onValueChange={(v) => set("preferred_supplier_id", v === "none" ? null : v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem fornecedor</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Código">
                <Input value={d.code} onChange={(e) => set("code", e.target.value)} />
              </Field>
              <Field label="Nome">
                <Input value={d.name} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <Field label="Composição" className="sm:col-span-2">
                <Input
                  value={d.composition ?? ""}
                  onChange={(e) => set("composition", e.target.value)}
                />
              </Field>
              <Field label="Cor">
                <Input
                  type="color"
                  value={d.color_hex || "#000000"}
                  onChange={(e) => set("color_hex", e.target.value)}
                  className="w-16 p-1 h-9"
                />
              </Field>
              <Field label="Unidade">
                <Input value={d.unit ?? ""} onChange={(e) => set("unit", e.target.value)} />
              </Field>
              <Field label="Custo ref.">
                <Input
                  type="number"
                  value={d.reference_cost}
                  onChange={(e) => set("reference_cost", Number(e.target.value))}
                />
              </Field>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Info label="Categoria" value={d.kind} />
                <Info label="Fornecedor" value={d.preferred_supplier?.name ?? "—"} />
                <Info label="Unidade" value={d.unit ?? "—"} />
                <Info
                  label="Custo referência"
                  value={`R$ ${Number(d.reference_cost ?? 0).toFixed(2)} / ${d.unit ?? "un"}`}
                />
              </div>
              {d.composition && (
                <div className="rounded-lg border border-border bg-card/40 p-3">
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wide mb-1">
                    Composição
                  </div>
                  <div className="text-sm">{d.composition}</div>
                </div>
              )}
              {d.color_hex && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className="inline-block size-5 rounded border border-border"
                    style={{ background: d.color_hex }}
                  />
                  <span className="font-mono">{d.color_hex}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-border">
            {editing ? (
              <>
                <Button
                  onClick={() => update.mutate()}
                  disabled={update.isPending || !d.code || !d.name}
                  className="gap-1"
                >
                  <Save className="h-4 w-4" /> Salvar
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDraft(item);
                    setEditing(false);
                  }}
                  className="gap-1"
                >
                  <X className="h-4 w-4" /> Cancelar
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => setEditing(true)} className="gap-1">
                  <Pencil className="h-4 w-4" /> Editar
                </Button>
                <Button
                  variant="ghost"
                  className="gap-1 text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm(`Excluir "${item.name}"?`)) onDelete();
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Excluir
                </Button>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`space-y-1 block ${className ?? ""}`}>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="text-[10px] uppercase text-muted-foreground tracking-wide mb-1">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
