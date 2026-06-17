import { useState } from "react";
import { AlertTriangle, Clock, CheckCircle2, MessageSquare, Megaphone, Pause, Sparkles } from "lucide-react";
import { show as showSection, CAT_LABEL, type Cat } from "./notifications-filter";

export type AlertsData = {
  critical: Array<{ id: string; name: string; balance: number | string; minimum: number | string; unit: string }>;
  overdue: Array<{ id: string; code: string; due_date: string; progress?: number | null }>;
  stuck: Array<{ id: string; code: string; stage: string; stage_updated_at: string }>;
  oldProtos: Array<{ id: string; code: string; name: string; stage: string; updated_at: string }>;
  comments: Array<{ id: string; kind: "proto" | "op"; refCode: string; body: string; when: string }>;
  marketing: Array<{ id: string; title: string; body?: string | null; link?: string | null }>;
};

/** Painel presentacional da Central de alertas. Sem router/supabase — fácil de testar. */
export function AlertsPanel({
  data,
  initialCat = "all",
  onMarketingClick,
  LinkAs = "a",
}: {
  data: AlertsData;
  initialCat?: Cat;
  onMarketingClick?: (id: string) => void;
  LinkAs?: React.ElementType;
}) {
  const [cat, setCat] = useState<Cat>(initialCat);
  const counts: Record<Cat, number> = {
    all: 0,
    estoque: data.critical.length,
    atraso: data.overdue.length,
    parado: data.stuck.length,
    proto: data.oldProtos.length,
    comentario: data.comments.length,
    marketing: data.marketing.length,
  };
  counts.all = counts.estoque + counts.atraso + counts.parado + counts.proto + counts.comentario + counts.marketing;
  const total = counts.all;
  const show = (k: Exclude<Cat, "all">) => showSection(cat, k);

  return (
    <div data-testid="alerts-panel">
      <div className="px-4 py-3 border-b border-border">
        <div className="text-sm font-semibold">Central de alertas</div>
        <div className="text-xs text-muted-foreground" data-testid="alerts-total">
          {total} alerta{total === 1 ? "" : "s"} no total
        </div>
      </div>
      <div className="px-2 py-2 border-b border-border flex flex-wrap gap-1" role="tablist">
        {(Object.keys(CAT_LABEL) as Cat[]).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={cat === k}
            data-testid={`chip-${k}`}
            onClick={() => setCat(k)}
            className={`text-[11px] px-2 py-1 rounded-md inline-flex items-center gap-1 ${
              cat === k ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
            }`}
          >
            {CAT_LABEL[k]}
            {counts[k] > 0 && <span className="tabular-nums opacity-80" data-testid={`count-${k}`}>{counts[k]}</span>}
          </button>
        ))}
      </div>
      <div className="max-h-96 overflow-y-auto" data-testid="alerts-list">
        {(cat === "all" ? total === 0 : counts[cat] === 0) && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground" data-testid="empty-state">
            <CheckCircle2 className="size-8 text-success mx-auto mb-2" />
            {cat === "all" ? "Tudo sob controle" : `Sem alertas em ${CAT_LABEL[cat]}`}
          </div>
        )}
        {show("estoque") && data.critical.map((i) => (
          <LinkAs key={`inv-${i.id}`} to="/almoxarifado" href="/almoxarifado" data-testid="item-estoque" className="flex gap-3 px-4 py-3 border-b border-border last:border-0">
            <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{i.name}</div>
              <div className="text-xs text-muted-foreground tabular-nums">Estoque {Number(i.balance)} {i.unit} · mín {Number(i.minimum)}</div>
            </div>
          </LinkAs>
        ))}
        {show("marketing") && data.marketing.map((m) => (
          <LinkAs key={`mkt-${m.id}`} to={m.link || "/marketing"} href={m.link || "/marketing"}
            onClick={() => onMarketingClick?.(m.id)} data-testid="item-marketing"
            className="flex gap-3 px-4 py-3 border-b border-border last:border-0">
            <Megaphone className="size-4 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{m.title}</div>
              {m.body && <div className="text-xs text-muted-foreground truncate">{m.body}</div>}
            </div>
          </LinkAs>
        ))}
        {show("atraso") && data.overdue.map((o) => (
          <LinkAs key={`op-${o.id}`} to="/pcp" href="/pcp" data-testid="item-atraso" className="flex gap-3 px-4 py-3 border-b border-border last:border-0">
            <Clock className="size-4 text-destructive shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">OP {o.code} atrasada</div>
              <div className="text-xs text-muted-foreground">Prazo {o.due_date} · {o.progress ?? 0}%</div>
            </div>
          </LinkAs>
        ))}
        {show("parado") && data.stuck.map((o) => {
          const days = Math.floor((Date.now() - new Date(o.stage_updated_at).getTime()) / 86_400_000);
          return (
            <LinkAs key={`stuck-${o.id}`} to="/pcp-kanban" href="/pcp-kanban" data-testid="item-parado" className="flex gap-3 px-4 py-3 border-b border-border last:border-0">
              <Pause className="size-4 text-warning shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">OP {o.code} parada em {o.stage}</div>
                <div className="text-xs text-muted-foreground">Sem movimento há {days} dia{days === 1 ? "" : "s"}</div>
              </div>
            </LinkAs>
          );
        })}
        {show("proto") && data.oldProtos.map((p) => {
          const days = Math.floor((Date.now() - new Date(p.updated_at).getTime()) / 86_400_000);
          return (
            <LinkAs key={`proto-${p.id}`} to="/prototipos" href="/prototipos" data-testid="item-proto" className="flex gap-3 px-4 py-3 border-b border-border last:border-0">
              <Sparkles className="size-4 text-warning shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">Protótipo {p.code} sem evolução</div>
                <div className="text-xs text-muted-foreground truncate">{p.name} · {p.stage} há {days} dias</div>
              </div>
            </LinkAs>
          );
        })}
        {show("comentario") && data.comments.map((c) => (
          <LinkAs key={`cm-${c.id}`} to={c.kind === "proto" ? "/prototipos" : "/pcp-kanban"} href={c.kind === "proto" ? "/prototipos" : "/pcp-kanban"}
            data-testid="item-comentario" className="flex gap-3 px-4 py-3 border-b border-border last:border-0">
            <MessageSquare className="size-4 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">
                {c.kind === "proto" ? "Protótipo" : "OP"} {c.refCode} · novo comentário
              </div>
              <div className="text-xs text-muted-foreground truncate">{c.body}</div>
            </div>
          </LinkAs>
        ))}
      </div>
    </div>
  );
}
