import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Building2, Loader2, Globe, Phone, Mail, MapPin } from "lucide-react";

type QuickSupplierDialogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Callback após criar fornecedor com sucesso */
  onCreated?: (supplier: { id: string; name: string }) => void;
};

/**
 * QuickSupplierDialog — Dialog minimalista para cadastrar fornecedor inline,
 * sem precisar navegar para a página de fornecedores.
 */
export function QuickSupplierDialog({
  open,
  onOpenChange,
  onCreated,
}: QuickSupplierDialogProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const createMut = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Sessão expirada");
      if (!name.trim()) throw new Error("Informe o nome do fornecedor");

      const { data, error } = await supabase
        .from("suppliers")
        .insert({
          owner_id: user.id,
          name: name.trim(),
          trade_name: tradeName.trim() || null,
          contact_name: contactName.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          website: website.trim() || null,
          address: address.trim() || null,
          notes: notes.trim() || null,
          status: "ativo",
        })
        .select("id, name")
        .single();
      if (error) throw error;
      return data as { id: string; name: string };
    },
    onSuccess: (data) => {
      toast.success(`Fornecedor "${data.name}" criado!`);
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      onCreated?.(data);
      reset();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reset = () => {
    setName("");
    setTradeName("");
    setContactName("");
    setEmail("");
    setPhone("");
    setWebsite("");
    setAddress("");
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
              <Building2 className="size-5" />
            </div>
            <div>
              <DialogTitle>Novo Fornecedor</DialogTitle>
              <DialogDescription>
                Cadastro rápido de parceiro comercial.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="qs-name">
                Razão Social <span className="text-destructive">*</span>
              </Label>
              <Input
                id="qs-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Tecidos Premium Ltda"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="qs-trade">Nome Fantasia</Label>
              <Input
                id="qs-trade"
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                placeholder="Opcional"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="qs-contact">Contato</Label>
              <Input
                id="qs-contact"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Nome do contato"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qs-email">
                <Mail className="size-3 inline mr-1 text-muted-foreground" />
                Email
              </Label>
              <Input
                id="qs-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contato@fornecedor.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qs-phone">
                <Phone className="size-3 inline mr-1 text-muted-foreground" />
                Telefone
              </Label>
              <Input
                id="qs-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-8888"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qs-web">
                <Globe className="size-3 inline mr-1 text-muted-foreground" />
                Website
              </Label>
              <Input
                id="qs-web"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qs-addr">
                <MapPin className="size-3 inline mr-1 text-muted-foreground" />
                Endereço
              </Label>
              <Input
                id="qs-addr"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Cidade / UF"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qs-notes">Observações</Label>
            <textarea
              id="qs-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Formas de pagamento, prazos, observações…"
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => createMut.mutate()}
            disabled={!name.trim() || createMut.isPending}
          >
            {createMut.isPending ? (
              <><Loader2 className="size-4 animate-spin mr-2" /> Salvando…</>
            ) : (
              <><Building2 className="size-4 mr-1.5" /> Criar Fornecedor</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

