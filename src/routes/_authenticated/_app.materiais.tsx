import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Library } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_app/materiais")({
  head: () => ({
    meta: [
      { title: "Biblioteca de Materiais · USE MODA PLM" },
      { name: "description", content: "Tecidos, aviamentos e cores reutilizáveis entre coleções." },
    ],
  }),
  component: Page,
});

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
};

const KINDS = ["tecido", "aviamento", "cor", "estampa", "etiqueta", "outros"];

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("todos");
  const [form, setForm] = useState({
    kind: "tecido",
    code: "",
    name: "",
    composition: "",
    color_hex: "",
    unit: "m",
    reference_cost: 0,
  });

  const items = useQuery({
    queryKey: ["material-library", filter],
    queryFn: async () => {
      let q = (supabase as any)
        .from("material_library")
        .select("*")
        .order("created_at", { ascending: false });
      if (filter !== "todos") q = q.eq("kind", filter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("material_library")
        .insert({ owner_id: user!.id, ...form });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Material adicionado");
      setForm({ ...form, code: "", name: "", composition: "" });
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Library className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Biblioteca de Materiais</h1>
          <p className="text-sm text-muted-foreground">
            Tecidos, aviamentos e cores reutilizáveis entre coleções.
          </p>
        </div>
      </div>

      <div className="glass rounded-xl p-4 space-y-3">
        <h2 className="font-semibold">Novo material</h2>
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
          <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
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
          />
          <Input
            type="color"
            value={form.color_hex || "#000000"}
            onChange={(e) => setForm({ ...form, color_hex: e.target.value })}
          />
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
        <Button onClick={() => add.mutate()} disabled={!form.code || !form.name || add.isPending}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant={filter === "todos" ? "default" : "outline"}
          onClick={() => setFilter("todos")}
        >
          Todos
        </Button>
        {KINDS.map((k) => (
          <Button
            key={k}
            size="sm"
            variant={filter === k ? "default" : "outline"}
            onClick={() => setFilter(k)}
          >
            {k}
          </Button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.data?.map((it) => (
          <div key={it.id} className="glass rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-start justify-between">
              <div>
                <Badge variant="outline">{it.kind}</Badge>
                <h3 className="font-semibold mt-1">{it.name}</h3>
                <p className="text-xs text-muted-foreground">{it.code}</p>
              </div>
              {it.color_hex && (
                <div className="w-8 h-8 rounded-full border" style={{ background: it.color_hex }} />
              )}
            </div>
            {it.composition && <p className="text-sm">{it.composition}</p>}
            <div className="flex items-center justify-between mt-auto pt-2">
              <span className="text-sm font-medium">
                R$ {Number(it.reference_cost).toFixed(2)}/{it.unit}
              </span>
              <Button size="icon" variant="ghost" onClick={() => remove.mutate(it.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        {items.data?.length === 0 && (
          <p className="text-muted-foreground col-span-full text-center py-8">
            Nenhum material cadastrado.
          </p>
        )}
      </div>
    </div>
  );
}
