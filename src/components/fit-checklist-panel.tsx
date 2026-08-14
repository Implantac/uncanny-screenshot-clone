import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  CheckCircle2,
  Ruler,
  Shirt,
  Sparkles,
  Move,
  Heart,
  ClipboardCheck,
  ImageIcon,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface FitChecklistItem {
  id: string;
  prototype_id: string;
  encaixe: "ok" | "ajustar" | "rever";
  caimento: "ok" | "ajustar" | "rever";
  comprimento: "ok" | "ajustar" | "rever";
  conforto: "ok" | "ajustar" | "rever";
  movimento: "ok" | "ajustar" | "rever";
  observacoes: string;
  foto_antes_url: string | null;
  foto_depois_url: string | null;
  created_at: string;
}

const FIT_FIELDS = [
  { key: "encaixe", label: "Encaixe", icon: Shirt, desc: "Ombro, cavas, decote" },
  { key: "caimento", label: "Caimento", icon: Sparkles, desc: "Como a peça veste no corpo" },
  { key: "comprimento", label: "Comprimento", icon: Ruler, desc: "Manga, saia, frente/costas" },
  { key: "conforto", label: "Conforto", icon: Heart, desc: "Liberdade de movimento" },
  { key: "movimento", label: "Movimento", icon: Move, desc: "Ao andar, sentar, levantar" },
] as const;

const STATUS_ICONS = {
  ok: CheckCircle2,
  ajustar: ClipboardCheck,
  rever: Loader2,
} as const;

const STATUS_COLORS = {
  ok: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30",
  ajustar: "text-amber-600 bg-amber-500/10 border-amber-500/30",
  rever: "text-rose-600 bg-rose-500/10 border-rose-500/30",
} as const;

const STATUS_LABELS = {
  ok: "OK",
  ajustar: "Ajustar",
  rever: "Rever",
} as const;

type FitValue = "ok" | "ajustar" | "rever";

export function FitChecklistPanel({
  prototypeId,
  productId,
}: {
  prototypeId: string;
  productId?: string;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [values, setValues] = useState<Record<string, FitValue>>({
    encaixe: "ok",
    caimento: "ok",
    comprimento: "ok",
    conforto: "ok",
    movimento: "ok",
  });
  const [observacoes, setObservacoes] = useState("");
  const [fotoAntes, setFotoAntes] = useState("");
  const [fotoDepois, setFotoDepois] = useState("");

  const { data: checklist, isLoading } = useQuery({
    queryKey: ["fit-checklist", prototypeId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("prototype_fit_checklist")
        .select("*")
        .eq("prototype_id", prototypeId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as FitChecklistItem | null;
    },
    staleTime: 15_000,
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Sessão expirada");
      const { error } = await (supabase as any).from("prototype_fit_checklist").upsert({
        prototype_id: prototypeId,
        owner_id: user.id,
        encaixe: values.encaixe,
        caimento: values.caimento,
        comprimento: values.comprimento,
        conforto: values.conforto,
        movimento: values.movimento,
        observacoes: observacoes.trim(),
        foto_antes_url: fotoAntes || null,
        foto_depois_url: fotoDepois || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Checklist de fitting salvo");
      queryClient.invalidateQueries({ queryKey: ["fit-checklist", prototypeId] });
      setEditMode(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function startEdit() {
    if (checklist) {
      setValues({
        encaixe: checklist.encaixe,
        caimento: checklist.caimento,
        comprimento: checklist.comprimento,
        conforto: checklist.conforto,
        movimento: checklist.movimento,
      });
      setObservacoes(checklist.observacoes ?? "");
      setFotoAntes(checklist.foto_antes_url ?? "");
      setFotoDepois(checklist.foto_depois_url ?? "");
    }
    setEditMode(true);
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card/40 p-4 text-sm text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin inline mr-2" /> Carregando checklist…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="size-4 text-primary" />
          <span className="text-sm font-semibold">Checklist de Fitting</span>
          {checklist && (
            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600">
              {new Date(checklist.created_at).toLocaleDateString("pt-BR")}
            </Badge>
          )}
        </div>
        {!editMode && (
          <Button size="sm" variant="outline" onClick={startEdit} className="text-xs gap-1">
            <ClipboardCheck className="size-3" />
            {checklist ? "Editar" : "Preencher"}
          </Button>
        )}
      </div>

      {editMode ? (
        <div className="space-y-3">
          {FIT_FIELDS.map(({ key, label, icon: Icon, desc }) => (
            <div key={key} className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5">
                  <Icon className="size-3.5 text-primary" />
                  <span className="text-xs font-medium">{label}</span>
                  <span className="text-[10px] text-muted-foreground">— {desc}</span>
                </div>
              </div>
              <div className="flex gap-1.5 mt-1.5">
                {(["ok", "ajustar", "rever"] as FitValue[]).map((v) => {
                  const IconBtn = STATUS_ICONS[v];
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setValues((prev) => ({ ...prev, [key]: v }))}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] border transition ${
                        values[key] === v
                          ? STATUS_COLORS[v]
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <IconBtn className="size-3" />
                      {STATUS_LABELS[v]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Observações do fitting
            </label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Anotações livres sobre o fitting: ajustes necessários, sensação da peça, alterações sugeridas…"
              rows={3}
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Foto ANTES do ajuste (URL)
              </label>
              <input
                value={fotoAntes}
                onChange={(e) => setFotoAntes(e.target.value)}
                placeholder="https://…"
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
              />
              {fotoAntes && (
                <img
                  src={fotoAntes}
                  alt="Antes"
                  className="mt-1 h-16 w-16 rounded object-cover border"
                />
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Foto DEPOIS do ajuste (URL)
              </label>
              <input
                value={fotoDepois}
                onChange={(e) => setFotoDepois(e.target.value)}
                placeholder="https://…"
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
              />
              {fotoDepois && (
                <img
                  src={fotoDepois}
                  alt="Depois"
                  className="mt-1 h-16 w-16 rounded object-cover border"
                />
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setEditMode(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending ? "Salvando…" : "Salvar checklist"}
            </Button>
          </div>
        </div>
      ) : checklist ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {FIT_FIELDS.map(({ key, label }) => {
            const val = checklist[key as keyof FitChecklistItem] as FitValue;
            const Icon = STATUS_ICONS[val];
            return (
              <div key={key} className={`rounded-lg border p-2 text-center ${STATUS_COLORS[val]}`}>
                <Icon className="size-4 mx-auto mb-1" />
                <div className="text-[10px] font-medium">{label}</div>
                <div className="text-[9px] opacity-70">{STATUS_LABELS[val]}</div>
              </div>
            );
          })}
          {checklist.observacoes && (
            <div className="col-span-full text-xs text-muted-foreground bg-muted/20 rounded-lg p-2 mt-1">
              📝 {checklist.observacoes}
            </div>
          )}
          {checklist.foto_antes_url && checklist.foto_depois_url && (
            <div className="col-span-full flex gap-2 mt-1">
              <div className="flex-1">
                <div className="text-[10px] text-muted-foreground mb-1">Antes</div>
                <img
                  src={checklist.foto_antes_url}
                  alt="Antes"
                  className="h-20 w-20 rounded object-cover border"
                />
              </div>
              <div className="flex-1">
                <div className="text-[10px] text-muted-foreground mb-1">Depois</div>
                <img
                  src={checklist.foto_depois_url}
                  alt="Depois"
                  className="h-20 w-20 rounded object-cover border"
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-lg">
          <ClipboardCheck className="size-6 mx-auto mb-1 opacity-40" />
          <div>Nenhum checklist de fitting registrado.</div>
          <div className="text-[10px] mt-1">
            Preencha para registrar encaixe, caimento, comprimento e conforto do piloto.
          </div>
        </div>
      )}
    </div>
  );
}
