import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCheck, AlertTriangle, MessageSquare, ImageIcon } from "lucide-react";

type Session = {
  id: string;
  iteration: number;
  status: string;
  session_date: string;
  fit_model: string | null;
  prototype_id: string | null;
};

const STATUS_TONE: Record<string, string> = {
  aberta: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
  ajustes: "border-warning/40 bg-warning/10 text-warning",
  aprovada: "border-success/40 bg-success/10 text-success",
  reprovada: "border-destructive/40 bg-destructive/10 text-destructive",
};

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  aberta: MessageSquare,
  ajustes: AlertTriangle,
  aprovada: CheckCheck,
  reprovada: AlertTriangle,
};

export function FitSessionTimeline({
  sessions,
  selectedId,
  compareId,
  onSelect,
  onCompare,
}: {
  sessions: Session[];
  selectedId: string | null;
  compareId: string | null;
  onSelect: (id: string) => void;
  onCompare: (id: string | null) => void;
}) {
  const [hero, setHero] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let cancel = false;
    (async () => {
      const ids = sessions.map((s) => s.id);
      if (ids.length === 0) return;
      const { data } = await supabase
        .from("fit_session_comments")
        .select("fit_session_id, image_url, created_at")
        .in("fit_session_id", ids)
        .not("image_url", "is", null)
        .order("created_at", { ascending: true });
      if (cancel || !data) return;
      const map: Record<string, string | null> = {};
      for (const row of data) {
        const sid = (row as { fit_session_id: string }).fit_session_id;
        if (!map[sid]) map[sid] = (row as { image_url: string | null }).image_url ?? null;
      }
      setHero(map);
    })();
    return () => {
      cancel = true;
    };
  }, [sessions]);

  if (sessions.length === 0) return null;

  const sorted = [...sessions].sort((a, b) => a.iteration - b.iteration);

  return (
    <div className="glass rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Timeline visual</div>
          <div className="text-sm font-medium">Evolução da peça — {sorted.length} prova(s)</div>
        </div>
        <div className="text-[11px] text-muted-foreground">Clique = abrir · Shift+clique = comparar</div>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {sorted.map((s, idx) => {
          const Icon = STATUS_ICON[s.status] ?? MessageSquare;
          const tone = STATUS_TONE[s.status] ?? STATUS_TONE.aberta;
          const isSelected = selectedId === s.id;
          const isCompare = compareId === s.id;
          const photo = hero[s.id];
          return (
            <div key={s.id} className="flex items-center shrink-0">
              <button
                onClick={(e) => {
                  if (e.shiftKey && selectedId && selectedId !== s.id) {
                    onCompare(isCompare ? null : s.id);
                  } else {
                    onSelect(s.id);
                  }
                }}
                className={`relative w-32 rounded-lg border-2 overflow-hidden transition hover:scale-[1.02] ${isSelected ? "border-primary shadow-md" : isCompare ? "border-warning" : "border-border"}`}
                aria-label={`Prova iteração ${s.iteration}, status ${s.status}`}
              >
                <div className="aspect-square bg-muted flex items-center justify-center">
                  {photo ? (
                    <img src={photo} alt={`Prova ${s.iteration}`} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="size-8 text-muted-foreground/40" />
                  )}
                </div>
                <div className={`px-2 py-1.5 border-t ${tone} border-t-transparent`}>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-semibold">It. {s.iteration}</span>
                    <Icon className="size-3" />
                  </div>
                  <div className="text-[10px] truncate opacity-80">
                    {new Date(s.session_date).toLocaleDateString("pt-BR")}
                  </div>
                </div>
              </button>
              {idx < sorted.length - 1 && (
                <div className="w-6 h-px bg-border mx-1" aria-hidden />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
