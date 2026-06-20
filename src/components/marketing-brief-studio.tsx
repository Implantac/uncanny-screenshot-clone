import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Sparkles,
  Plus,
  Wand2,
  Rocket,
  FileText,
  Trash2,
  Lightbulb,
} from "lucide-react";
import {
  generateBriefPlan,
  promoteBriefToCampaign,
  suggestLifecycleBriefs,
} from "@/lib/marketing-brief.functions";

type Brief = {
  id: string;
  title: string;
  objective: string;
  target_audience: string | null;
  key_message: string | null;
  tone: string | null;
  channels: string[] | null;
  budget: number | null;
  kpi_target: string | null;
  lifecycle_trigger: string | null;
  collection_id: string | null;
  product_id: string | null;
  campaign_id: string | null;
  status: string;
  ai_plan: { text?: string; generated_at?: string } | null;
  created_at: string;
};

type Collection = { id: string; name: string; status: string };

const STATUS_STYLE: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  plano_gerado: "bg-violet-500/15 text-violet-400",
  campanha_criada: "bg-emerald-500/15 text-emerald-400",
};

export function MarketingBriefStudio() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Brief>>({});
  const [viewing, setViewing] = useState<Brief | null>(null);

  const genFn = useServerFn(generateBriefPlan);
  const promoteFn = useServerFn(promoteBriefToCampaign);
  const suggestFn = useServerFn(suggestLifecycleBriefs);

  const { data: briefs = [] } = useQuery({
    queryKey: ["marketing_briefs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_briefs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Brief[];
    },
  });

  const { data: collections = [] } = useQuery({
    queryKey: ["collections_for_briefs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("collections")
        .select("id, name, status")
        .order("created_at", { ascending: false });
      return (data ?? []) as Collection[];
    },
  });

  const { data: suggestionsResp } = useQuery({
    queryKey: ["brief_suggestions"],
    queryFn: () => suggestFn(),
  });
  const suggestions = suggestionsResp?.suggestions ?? [];

  const saveMut = useMutation({
    mutationFn: async (b: Partial<Brief>) => {
      if (!user) throw new Error("Sem usuário");
      const payload = {
        owner_id: user.id,
        title: b.title ?? "Novo brief",
        objective: b.objective ?? "",
        target_audience: b.target_audience ?? null,
        key_message: b.key_message ?? null,
        tone: b.tone ?? null,
        channels: b.channels ?? [],
        budget: b.budget ?? 0,
        kpi_target: b.kpi_target ?? null,
        lifecycle_trigger: b.lifecycle_trigger ?? null,
        collection_id: b.collection_id ?? null,
        status: "rascunho",
      };
      const { data, error } = await supabase
        .from("marketing_briefs")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing_briefs"] });
      qc.invalidateQueries({ queryKey: ["brief_suggestions"] });
      toast.success("Brief salvo");
      setOpen(false);
      setDraft({});
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_briefs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing_briefs"] });
      qc.invalidateQueries({ queryKey: ["brief_suggestions"] });
      toast.success("Brief removido");
    },
  });

  const genMut = useMutation({
    mutationFn: async (id: string) => genFn({ data: { briefId: id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing_briefs"] });
      toast.success("Plano de IA gerado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const promoteMut = useMutation({
    mutationFn: async (id: string) => promoteFn({ data: { briefId: id } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["marketing_briefs"] });
      qc.invalidateQueries({ queryKey: ["marketing_campaigns"] });
      toast.success(res.reused ? "Campanha já existia" : "Campanha criada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="size-5" /> Brief Studio
          </h3>
          <p className="text-sm text-muted-foreground">
            Brief → plano de IA → campanha, sincronizado com o lifecycle da coleção.
          </p>
        </div>
        <Button onClick={() => { setDraft({}); setOpen(true); }}>
          <Plus className="size-4 mr-1" /> Novo brief
        </Button>
      </div>

      {suggestions.length > 0 && (
        <Card className="p-4 border-dashed">
          <div className="flex items-center gap-2 mb-2 text-sm font-medium">
            <Lightbulb className="size-4 text-amber-400" />
            Sugestões automáticas pelo lifecycle
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {suggestions.slice(0, 6).filter((s): s is NonNullable<typeof s> => !!s).map((s) => (
              <button
                key={`${s.collectionId}:${s.trigger}`}
                onClick={() => {
                  setDraft({
                    title: s.title,
                    objective: s.objective,
                    collection_id: s.collectionId,
                    lifecycle_trigger: s.trigger,
                    channels: ["instagram", "tiktok"],
                  });
                  setOpen(true);
                }}
                className="text-left p-3 rounded-md border bg-muted/40 hover:bg-muted/70 transition"
              >
                <div className="text-xs uppercase text-muted-foreground">{s.trigger}</div>
                <div className="text-sm font-medium">{s.title}</div>
                <div className="text-xs text-muted-foreground line-clamp-2">{s.objective}</div>
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-2">
        {briefs.length === 0 && (
          <div className="text-sm text-muted-foreground p-6 border rounded-md text-center">
            Nenhum brief ainda. Crie um ou use uma sugestão acima.
          </div>
        )}
        {briefs.map((b) => (
          <Card key={b.id} className="p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{b.title}</span>
                <Badge className={STATUS_STYLE[b.status] ?? ""}>{b.status}</Badge>
                {b.lifecycle_trigger && (
                  <Badge variant="outline" className="text-xs">{b.lifecycle_trigger}</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground line-clamp-1">{b.objective}</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setViewing(b)}>
              <Sparkles className="size-4 mr-1" />
              {b.ai_plan ? "Ver plano" : "Detalhes"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={genMut.isPending}
              onClick={() => genMut.mutate(b.id)}
            >
              <Wand2 className="size-4 mr-1" /> Gerar plano
            </Button>
            <Button
              size="sm"
              disabled={!b.ai_plan || !!b.campaign_id || promoteMut.isPending}
              onClick={() => promoteMut.mutate(b.id)}
            >
              <Rocket className="size-4 mr-1" />
              {b.campaign_id ? "Campanha ✓" : "Virar campanha"}
            </Button>
            <Button size="icon" variant="ghost" onClick={() => delMut.mutate(b.id)}>
              <Trash2 className="size-4" />
            </Button>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo brief de marketing</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label>Título</Label>
              <Input
                value={draft.title ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              />
            </div>
            <div className="grid gap-1">
              <Label>Objetivo</Label>
              <Textarea
                rows={2}
                value={draft.objective ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, objective: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label>Público-alvo</Label>
                <Input
                  value={draft.target_audience ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, target_audience: e.target.value }))}
                />
              </div>
              <div className="grid gap-1">
                <Label>Tom de voz</Label>
                <Input
                  value={draft.tone ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, tone: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-1">
              <Label>Mensagem-chave</Label>
              <Textarea
                rows={2}
                value={draft.key_message ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, key_message: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1">
                <Label>Budget (R$)</Label>
                <Input
                  type="number"
                  value={draft.budget ?? 0}
                  onChange={(e) => setDraft((d) => ({ ...d, budget: Number(e.target.value) }))}
                />
              </div>
              <div className="grid gap-1">
                <Label>KPI alvo</Label>
                <Input
                  placeholder="ROAS 3.0"
                  value={draft.kpi_target ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, kpi_target: e.target.value }))}
                />
              </div>
              <div className="grid gap-1">
                <Label>Canais (vírgula)</Label>
                <Input
                  value={(draft.channels ?? []).join(", ")}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      channels: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label>Coleção (lifecycle)</Label>
                <Select
                  value={draft.collection_id ?? "none"}
                  onValueChange={(v) =>
                    setDraft((d) => ({ ...d, collection_id: v === "none" ? null : v }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— nenhuma —</SelectItem>
                    {collections.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label>Gatilho lifecycle</Label>
                <Select
                  value={draft.lifecycle_trigger ?? "none"}
                  onValueChange={(v) =>
                    setDraft((d) => ({ ...d, lifecycle_trigger: v === "none" ? null : v }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— nenhum —</SelectItem>
                    <SelectItem value="lancamento">Lançamento</SelectItem>
                    <SelectItem value="entregue">Sustentação</SelectItem>
                    <SelectItem value="markdown">Markdown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => saveMut.mutate(draft)}
              disabled={!draft.title || !draft.objective || saveMut.isPending}
            >
              Salvar brief
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewing?.title}</DialogTitle>
          </DialogHeader>
          {viewing?.ai_plan?.text ? (
            <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap">
              {viewing.ai_plan.text}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Plano ainda não foi gerado. Use "Gerar plano" no card do brief.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
