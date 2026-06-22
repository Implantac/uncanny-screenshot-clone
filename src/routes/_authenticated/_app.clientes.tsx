import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, Plus, Trash2, Pencil, Mail, Phone, MapPin, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { syncErpCustomers } from "@/lib/erp-import.functions";


export const Route = createFileRoute("/_authenticated/_app/clientes")({
  head: () => ({ meta: [{ title: "Clientes · USE MODA OS" }] }),
  component: ClientesPage,
});

type Customer = {
  id: string;
  owner_id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  created_at: string;
};

function ClientesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Customer[];
    },
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Cliente removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Users className="size-6 text-primary" /> Clientes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Cadastro de clientes B2B e varejo.</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="size-4" /> Novo Cliente
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Carregando…</div>
      ) : customers.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <h3 className="font-semibold mb-1">Nenhum cliente ainda</h3>
          <p className="text-sm text-muted-foreground mb-4">Cadastre seu primeiro cliente.</p>
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            Cadastrar cliente
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {customers.map((c) => (
            <div key={c.id} className="glass rounded-xl p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{c.name}</h3>
                  {c.document && (
                    <p className="text-xs text-muted-foreground mt-0.5">{c.document}</p>
                  )}
                </div>
              </div>
              <div className="space-y-1.5 text-sm">
                {c.email && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="size-3" /> {c.email}
                  </p>
                )}
                {c.phone && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="size-3" /> {c.phone}
                  </p>
                )}
                {(c.city || c.state) && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="size-3" /> {[c.city, c.state].filter(Boolean).join(" / ")}
                  </p>
                )}
              </div>
              {c.notes && <p className="text-xs text-muted-foreground line-clamp-2">{c.notes}</p>}
              {c.owner_id === user?.id && (
                <div className="flex justify-end gap-1 pt-2 border-t border-border">
                  <button
                    onClick={() => {
                      setEditing(c);
                      setOpen(true);
                    }}
                    className="size-7 grid place-items-center rounded hover:bg-muted"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    onClick={() => confirm("Remover este cliente?") && delMut.mutate(c.id)}
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

      <CustomerDialog open={open} onOpenChange={setOpen} editing={editing} userId={user?.id} />
    </div>
  );
}

function CustomerDialog({
  open,
  onOpenChange,
  editing,
  userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Customer | null;
  userId?: string;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: "",
    document: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    notes: "",
  });

  useEffect(() => {
    if (open && editing) {
      setF({
        name: editing.name,
        document: editing.document || "",
        email: editing.email || "",
        phone: editing.phone || "",
        city: editing.city || "",
        state: editing.state || "",
        notes: editing.notes || "",
      });
    } else if (open) {
      setF({ name: "", document: "", email: "", phone: "", city: "", state: "", notes: "" });
    }
  }, [open, editing]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sessão expirada");
      const payload = {
        name: f.name,
        document: f.document || null,
        email: f.email || null,
        phone: f.phone || null,
        city: f.city || null,
        state: f.state || null,
        notes: f.notes || null,
      };
      if (editing) {
        const { error } = await supabase.from("customers").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert({ ...payload, owner_id: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success(editing ? "Cliente atualizado" : "Cliente criado");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>Dados cadastrais e contato.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMut.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Nome / Razão social</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>CPF / CNPJ</Label>
            <Input value={f.document} onChange={(e) => setF({ ...f, document: e.target.value })} />
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
          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>UF</Label>
              <Input
                value={f.state}
                onChange={(e) => setF({ ...f, state: e.target.value })}
                maxLength={2}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={f.notes}
              onChange={(e) => setF({ ...f, notes: e.target.value })}
              rows={2}
            />
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
