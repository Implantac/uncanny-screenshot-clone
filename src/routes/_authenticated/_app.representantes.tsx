import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserCircle2, Plus, Trash2, Pencil, Mail, Phone, Percent } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_app/representantes")({
  head: () => ({ meta: [{ title: "Representantes · USE MODA OS" }] }),
  component: RepresentantesPage,
});

type Rep = {
  id: string;
  owner_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  commission_rate: number;
  active: boolean;
  notes: string | null;
  created_at: string;
};

function RepresentantesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Rep | null>(null);

  const { data: reps = [], isLoading } = useQuery({
    queryKey: ["representatives"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("representatives")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Rep[];
    },
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("representatives").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["representatives"] });
      toast.success("Representante removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <UserCircle2 className="size-6 text-primary" /> Representantes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Equipe comercial externa e comissões.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="size-4" /> Novo
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Carregando…</div>
      ) : reps.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <h3 className="font-semibold mb-1">Nenhum representante ainda</h3>
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
            className="mt-3"
          >
            Cadastrar
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {reps.map((r) => (
            <div key={r.id} className="glass rounded-xl p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold truncate">{r.name}</h3>
                {r.active ? (
                  <Badge
                    variant="outline"
                    className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  >
                    Ativo
                  </Badge>
                ) : (
                  <Badge variant="outline">Inativo</Badge>
                )}
              </div>
              <div className="space-y-1.5 text-sm">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Percent className="size-3" /> Comissão:{" "}
                  <span className="font-semibold text-foreground">
                    {Number(r.commission_rate).toFixed(1)}%
                  </span>
                </p>
                {r.email && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="size-3" /> {r.email}
                  </p>
                )}
                {r.phone && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="size-3" /> {r.phone}
                  </p>
                )}
              </div>
              {r.notes && <p className="text-xs text-muted-foreground line-clamp-2">{r.notes}</p>}
              {r.owner_id === user?.id && (
                <div className="flex justify-end gap-1 pt-2 border-t border-border">
                  <button
                    onClick={() => {
                      setEditing(r);
                      setOpen(true);
                    }}
                    className="size-7 grid place-items-center rounded hover:bg-muted"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    onClick={() => confirm("Remover?") && delMut.mutate(r.id)}
                    className="size-7 grid place-items-center rounded hover:bg-destructive/20 text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <RepDialog open={open} onOpenChange={setOpen} editing={editing} userId={user?.id} />
    </div>
  );
}

function RepDialog({
  open,
  onOpenChange,
  editing,
  userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Rep | null;
  userId?: string;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: "",
    email: "",
    phone: "",
    commission_rate: 0,
    active: true,
    notes: "",
  });

  useEffect(() => {
    if (open && editing) {
      setF({
        name: editing.name,
        email: editing.email || "",
        phone: editing.phone || "",
        commission_rate: Number(editing.commission_rate),
        active: editing.active,
        notes: editing.notes || "",
      });
    } else if (open) {
      setF({ name: "", email: "", phone: "", commission_rate: 0, active: true, notes: "" });
    }
  }, [open, editing]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sessão expirada");
      const payload = {
        name: f.name,
        email: f.email || null,
        phone: f.phone || null,
        commission_rate: f.commission_rate,
        active: f.active,
        notes: f.notes || null,
      };
      if (editing) {
        const { error } = await supabase
          .from("representatives")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("representatives")
          .insert({ ...payload, owner_id: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["representatives"] });
      toast.success(editing ? "Atualizado" : "Criado");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar representante" : "Novo representante"}</DialogTitle>
          <DialogDescription>Comissão e contato.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMut.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={f.email}
                onChange={(e) => setF({ ...f, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Comissão (%)</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={f.commission_rate}
              onChange={(e) => setF({ ...f, commission_rate: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={f.notes}
              onChange={(e) => setF({ ...f, notes: e.target.value })}
              rows={2}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <Label>Ativo</Label>
            <Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saveMut.isPending}>
              {saveMut.isPending ? "Salvando…" : editing ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
