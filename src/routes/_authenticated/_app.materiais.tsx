import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Search, Package, ImageOff } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";
import { StorageUploader } from "@/components/storage-uploader";

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
      const { error } = await (supabase as any).from("material_library").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["material-library"] }),
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

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Library className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Biblioteca de Materiais</h1>
            <p className="text-sm text-muted-foreground">
              Tecidos, aviamentos e cores reutilizáveis entre coleções.
            </p>
          </div>
        </div>
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
      </header>

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
            <MaterialCard key={it.id} item={it} onDelete={() => remove.mutate(it.id)} />
          ))}
        </div>
      )}
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

function MaterialCard({ item, onDelete }: { item: Item; onDelete: () => void }) {
  return (
    <div className="group relative rounded-xl border border-border bg-card overflow-hidden hover:shadow-lg hover:border-primary/40 transition">
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
        <button
          onClick={onDelete}
          aria-label="Excluir material"
          className="absolute top-2 right-2 size-7 rounded-full bg-background/90 backdrop-blur opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-destructive hover:bg-destructive hover:text-destructive-foreground"
        >
          <Trash2 className="size-3.5" />
        </button>
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
    </div>
  );
}
