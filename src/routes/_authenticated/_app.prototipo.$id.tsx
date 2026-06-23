import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Video,
  Calendar,
  Tag,
  Factory,
  Clock,
  Compass,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  SECTORS,
  PrototypeAdjustmentsButton,
  type AdjustmentSector,
} from "@/components/prototype-adjustments";
import { toast } from "sonner";
import { PrototypeApprovalGate } from "@/components/prototype-approval-gate";
import { PrototypeGatesPanel } from "@/components/prototype-gates-panel";
import { PrototypeHandoffTimeline } from "@/components/prototype-handoff-timeline";

export const Route = createFileRoute("/_authenticated/_app/prototipo/$id")({
  head: () => ({
    meta: [
      { title: "Protótipo · USE MODA PLM" },
      { name: "description", content: "Timeline visual completa do protótipo." },
    ],
  }),
  component: PrototipoPage,
});

type Attachment = { url: string; kind: "photo" | "video"; name?: string };
type Adjustment = {
  id: string;
  sector: AdjustmentSector | null;
  reason: string;
  status: "aberto" | "em_andamento" | "concluido" | "cancelado";
  notes: string | null;
  attachments: Attachment[];
  resolved_at: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<Adjustment["status"], string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};
const STATUS_TONE: Record<Adjustment["status"], string> = {
  aberto: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  em_andamento: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  concluido: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  cancelado: "bg-muted text-muted-foreground border-border",
};
const STAGE_LABEL: Record<string, string> = {
  solicitado: "Solicitado",
  em_confeccao: "Em confecção",
  em_prova: "Em prova",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
};

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 36e5);
  if (h < 1) return `${Math.floor(diff / 60000)} min`;
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function PrototipoPage() {
  const { id } = useParams({ from: "/_authenticated/_app/prototipo/$id" });
  const qc = useQueryClient();
  useRealtime("prototype_adjustments", ["prototipo-adj", id]);

  const { data: proto, isLoading } = useQuery({
    queryKey: ["prototipo", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prototypes")
        .select(
          "id, code, stage, notes, due_date, created_at, current_sector, needs_adjustment, product_id, supplier_id, products(name, sku, image_url, collection_id), suppliers(name)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return data as any;
    },
  });

  const { data: adjustments = [] } = useQuery({
    queryKey: ["prototipo-adj", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prototype_adjustments" as never)
        .select("*")
        .eq("prototype_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Adjustment[];
    },
  });

  const stats = useMemo(() => {
    const open = adjustments.filter(
      (a) => a.status === "aberto" || a.status === "em_andamento",
    ).length;
    const done = adjustments.filter((a) => a.status === "concluido").length;
    const photos = adjustments
      .flatMap((a) => a.attachments ?? [])
      .filter((a) => a.kind === "photo");
    return { open, done, total: adjustments.length, photos };
  }, [adjustments]);

  const resolve = useMutation({
    mutationFn: async (adjId: string) => {
      const { error } = await supabase
        .from("prototype_adjustments" as never)
        .update({ status: "concluido", resolved_at: new Date().toISOString() } as never)
        .eq("id", adjId);
      if (error) throw error;
      const { data: pend } = await supabase
        .from("prototype_adjustments" as never)
        .select("id")
        .eq("prototype_id", id)
        .in("status", ["aberto", "em_andamento"]);
      if (!pend || pend.length === 0) {
        await supabase
          .from("prototypes")
          .update({ needs_adjustment: false } as never)
          .eq("id", id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prototipo-adj", id] });
      qc.invalidateQueries({ queryKey: ["prototipo", id] });
      toast.success("Ajuste concluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Carregando…</div>;
  if (!proto) {
    return (
      <div className="p-6 space-y-4">
        <Link to="/prototipos">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4 mr-1" />
            Voltar
          </Button>
        </Link>
        <div className="rounded-xl border border-border bg-card/50 p-8 text-center text-muted-foreground">
          Protótipo não encontrado.
        </div>
      </div>
    );
  }

  const sectorLabel = proto.current_sector
    ? (SECTORS.find((s) => s.key === proto.current_sector)?.label ?? proto.current_sector)
    : null;

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/prototipos">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4 mr-1" />
            Protótipos
          </Button>
        </Link>
        {proto.products?.collection_id && (
          <Link
            to="/colecao-360/$id"
            params={{ id: proto.products.collection_id }}
          >
            <Button variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10">
              <Compass className="size-4 mr-1" />
              Ver Coleção 360º
            </Button>
          </Link>
        )}
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
          {STAGE_LABEL[proto.stage] ?? proto.stage}
        </Badge>
        {proto.needs_adjustment && (
          <Badge variant="outline" className="bg-amber-500/15 text-amber-600 border-amber-500/30">
            <AlertTriangle className="size-3 mr-1" /> Precisa ajuste
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-5">
        {/* Foto + dados */}
        <div className="space-y-3">
          <div className="aspect-square rounded-xl overflow-hidden bg-muted/40 border border-border">
            {proto.products?.image_url ? (
              <img
                src={proto.products.image_url}
                alt={proto.products?.name}
                className="size-full object-cover"
              />
            ) : (
              <div className="size-full grid place-items-center text-muted-foreground text-sm">
                <Sparkles className="size-8" />
              </div>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-3 space-y-2 text-sm">
            <div>
              <div className="font-mono text-[11px] text-muted-foreground">{proto.code}</div>
              <div className="font-semibold">{proto.products?.name ?? "—"}</div>
              <div className="text-xs text-muted-foreground">{proto.products?.sku}</div>
            </div>
            {sectorLabel && (
              <div className="flex items-center gap-2 text-xs">
                <Factory className="size-3.5 text-primary" />{" "}
                <span>
                  Setor atual: <b>{sectorLabel}</b>
                </span>
              </div>
            )}
            {proto.suppliers?.name && (
              <div className="flex items-center gap-2 text-xs">
                <Tag className="size-3.5 text-muted-foreground" />{" "}
                <span>{proto.suppliers.name}</span>
              </div>
            )}
            {proto.due_date && (
              <div className="flex items-center gap-2 text-xs">
                <Calendar className="size-3.5 text-muted-foreground" />{" "}
                <span>Prazo: {new Date(proto.due_date).toLocaleDateString("pt-BR")}</span>
              </div>
            )}
            {proto.notes && (
              <div className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">
                {proto.notes}
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <KpiMini label="Total" value={stats.total} />
            <KpiMini
              label="Abertos"
              value={stats.open}
              tone={stats.open > 0 ? "text-amber-600" : ""}
            />
            <KpiMini label="OK" value={stats.done} tone="text-emerald-600" />
          </div>
          <PrototypeAdjustmentsButton
            prototypeId={proto.id}
            prototypeCode={proto.code}
            defaultSector={proto.current_sector ?? null}
            needsAdjustment={proto.needs_adjustment}
          />
        </div>

        <PrototypeApprovalGate prototypeId={proto.id} currentStage={proto.stage} />

        {/* Timeline full-page */}
        <div className="space-y-4">
          <PrototypeGatesPanel prototypeId={proto.id} />
          <PrototypeHandoffTimeline
            prototypeId={proto.id}
            currentSector={proto.current_sector ?? null}
          />
          {stats.photos.length > 0 && (
            <div>
              <div className="text-sm font-semibold mb-2 flex items-center gap-2">
                <ImageIcon className="size-4 text-primary" /> Galeria · {stats.photos.length} fotos
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {stats.photos.slice(0, 12).map((a, i) => (
                  <a
                    key={i}
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="aspect-square rounded-lg overflow-hidden bg-muted/40 border border-border hover:border-primary transition-colors"
                  >
                    <img src={a.url} alt="" className="size-full object-cover" loading="lazy" />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="glass rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold flex items-center gap-2">
                <Clock className="size-4 text-primary" /> Linha do tempo do protótipo
              </div>
              <span className="text-xs text-muted-foreground">{adjustments.length} eventos</span>
            </div>

            {adjustments.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center rounded-lg border border-dashed border-border">
                Nenhum ajuste registrado ainda. A timeline aparece aqui conforme a peça evolui.
              </div>
            ) : (
              <ol className="relative border-l-2 border-border ml-3 space-y-4">
                {/* Marco inicial: criado em */}
                <li className="pl-5 relative">
                  <span className="absolute -left-[7px] top-2 size-3 rounded-full bg-primary border-2 border-background" />
                  <div className="text-xs font-semibold text-primary">Protótipo criado</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(proto.created_at).toLocaleString("pt-BR")} · há{" "}
                    {relTime(proto.created_at)}
                  </div>
                </li>
                {adjustments.map((a) => {
                  const dot =
                    a.status === "concluido"
                      ? "bg-emerald-500 border-emerald-500"
                      : a.status === "em_andamento"
                        ? "bg-blue-500 border-blue-500 animate-pulse"
                        : a.status === "cancelado"
                          ? "bg-muted-foreground border-muted-foreground"
                          : "bg-amber-500 border-amber-500";
                  return (
                    <li key={a.id} className="pl-5 relative">
                      <span
                        className={`absolute -left-[7px] top-3 size-3 rounded-full border-2 ${dot}`}
                      />
                      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={STATUS_TONE[a.status]}>
                              {STATUS_LABEL[a.status]}
                            </Badge>
                            {a.sector && (
                              <Badge variant="outline">
                                {SECTORS.find((s) => s.key === a.sector)?.label ?? a.sector}
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {new Date(a.created_at).toLocaleString("pt-BR")} · há{" "}
                              {relTime(a.created_at)}
                            </span>
                          </div>
                          {(a.status === "aberto" || a.status === "em_andamento") && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7"
                              onClick={() => resolve.mutate(a.id)}
                            >
                              <CheckCircle2 className="size-3.5 mr-1" /> Marcar como concluído
                            </Button>
                          )}
                        </div>
                        <div className="text-sm font-medium">{a.reason}</div>
                        {a.notes && <div className="text-xs text-muted-foreground">{a.notes}</div>}
                        {a.resolved_at && (
                          <div className="text-[11px] text-emerald-600">
                            Resolvido em {new Date(a.resolved_at).toLocaleString("pt-BR")}
                          </div>
                        )}
                        {a.attachments?.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {a.attachments.map((att, i) =>
                              att.kind === "photo" ? (
                                <a
                                  key={i}
                                  href={att.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="size-16 rounded-lg overflow-hidden border border-border bg-muted/40 hover:border-primary"
                                >
                                  <img
                                    src={att.url}
                                    alt=""
                                    className="size-full object-cover"
                                    loading="lazy"
                                  />
                                </a>
                              ) : (
                                <a
                                  key={i}
                                  href={att.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-border hover:bg-muted/40"
                                >
                                  <Video className="size-3" /> vídeo
                                </a>
                              ),
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiMini({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-2 text-center">
      <div className={`text-lg font-semibold tabular-nums ${tone ?? ""}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
    </div>
  );
}
