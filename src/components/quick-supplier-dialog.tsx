import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { toast } from "sonner";

/**
 * Modal enxuto para criar fornecedor sem sair do contexto (material, ficha, etc).
 * Devolve o id recém-criado via onCreated para o chamador auto-selecionar.
 */
export function QuickSupplierDialog({
  open,
  onOpenChange,
  onCreated,
  invalidateKeys = [["suppliers-lite"], ["suppliers"]],
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated?: (supplier: { id: string; name: string }) => void;
  invalidateKeys?: readonly (readonly unknown[])[];
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        owner_id: user!.id,
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        active: true,
      };
      const { data, error } = await (supabase as any)
        .from("suppliers")
        .insert(payload)
        .select("id,name")
        .single();
      if (error) throw error;
      return data as { id: string; name: string };
    },
    onSuccess: (row) => {
      toast.success("Fornecedor criado");
      setName("");
      setEmail("");
      setPhone("");
      invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k as unknown[] }));
      onCreated?.(row);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-4 text-primary" /> Novo fornecedor
          </DialogTitle>
          <DialogDescription>
            Cadastro rápido — refine depois em Fornecedores.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            autoFocus
            placeholder="Nome do fornecedor *"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder="E-mail (opcional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            placeholder="Telefone (opcional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={!name.trim() || create.isPending}
            className="gap-1"
          >
            <Plus className="size-4" /> Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
