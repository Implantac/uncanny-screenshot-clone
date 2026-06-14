import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { ShieldCheck, Activity, AlertTriangle, Download } from "lucide-react";

export const Route = createFileRoute("/_app/audit")({ component: Audit });

type Log = {
  id: string;
  user_id: string | null;
  actor_email: string | null;
  entity: string;
  entity_id: string | null;
  action: string;
  payload: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

async function load(): Promise<Log[]> {
  const { data } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  return (data ?? []) as Log[];
}

const ACTION_COLORS: Record<string, string> = {
  create: "bg-emerald-500/15 text-emerald-600",
  insert: "bg-emerald-500/15 text-emerald-600",
  update: "bg-blue-500/15 text-blue-600",
  delete: "bg-rose-500/15 text-rose-600",
  login: "bg-violet-500/15 text-violet-600",
  logout: "bg-slate-500/15 text-slate-600",
  export: "bg-amber-500/15 text-amber-600",
};

function colorFor(a: string) {
  return ACTION_COLORS[a.toLowerCase()] ?? "bg-muted text-foreground";
}

function Audit() {
  const { data, isLoading } = useQuery({ queryKey: ["audit-logs"], queryFn: load });
  const logs = data ?? [];
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const entities = useMemo(() => Array.from(new Set(logs.map((l) => l.entity))).sort(), [logs]);
  const actions = useMemo(() => Array.from(new Set(logs.map((l) => l.action))).sort(), [logs]);

  const filtered = useMemo(
    () =>
      logs.filter(
        (l) =>
          (entityFilter === "all" || l.entity === entityFilter) &&
          (actionFilter === "all" || l.action === actionFilter)
      ),
    [logs, entityFilter, actionFilter]
  );

  const sensitive = logs.filter((l) => ["delete", "export"].includes(l.action.toLowerCase())).length;
  const last24h = logs.filter((l) => Date.now() - new Date(l.created_at).getTime() < 86_400_000).length;

  function exportCsv() {
    const header = ["created_at", "actor", "entity", "entity_id", "action", "ip"].join(",");
    const rows = filtered.map((l) =>
      [l.created_at, l.actor_email ?? l.user_id ?? "", l.entity, l.entity_id ?? "", l.action, l.ip_address ?? ""]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Auditoria & LGPD</h1>
          <p className="text-sm text-muted-foreground">
            Rastreabilidade completa de ações dos usuários — quem fez o quê, quando e de onde.
          </p>
        </div>
        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent"
        >
          <Download className="size-4" /> Exportar CSV
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi icon={Activity} label="Eventos (24h)" value={last24h.toLocaleString("pt-BR")} />
        <Kpi icon={ShieldCheck} label="Total registrado" value={logs.length.toLocaleString("pt-BR")} />
        <Kpi icon={AlertTriangle} label="Ações sensíveis" value={sensitive.toLocaleString("pt-BR")} />
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="all">Todas as entidades</option>
          {entities.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="all">Todas as ações</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left p-3">Data</th>
              <th className="text-left p-3">Ator</th>
              <th className="text-left p-3">Entidade</th>
              <th className="text-left p-3">Ação</th>
              <th className="text-left p-3">ID</th>
              <th className="text-left p-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum evento registrado.</td></tr>
            )}
            {filtered.map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="p-3 whitespace-nowrap text-muted-foreground">
                  {new Date(l.created_at).toLocaleString("pt-BR")}
                </td>
                <td className="p-3">{l.actor_email ?? l.user_id ?? "—"}</td>
                <td className="p-3 font-medium">{l.entity}</td>
                <td className="p-3">
                  <span className={`inline-flex rounded-md px-2 py-0.5 text-xs ${colorFor(l.action)}`}>
                    {l.action}
                  </span>
                </td>
                <td className="p-3 font-mono text-xs text-muted-foreground">{l.entity_id ?? "—"}</td>
                <td className="p-3 font-mono text-xs text-muted-foreground">{l.ip_address ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" /> {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
