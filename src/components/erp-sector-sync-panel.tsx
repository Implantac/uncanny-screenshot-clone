import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  verifyErpSectorSync,
  applyErpSectorSync,
  type SyncRow,
} from "@/lib/erp-sector-sync.functions";
import { CheckCircle2, AlertTriangle, RefreshCw, Link2Off, ChevronRight } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function ErpSectorSyncPanel() {
  const qc = useQueryClient();
  const verify = useServerFn(verifyErpSectorSync);
  const apply = useServerFn(applyErpSectorSync);
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ["erp-sector-sync"],
    queryFn: () => verify(),
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const syncAll = useMutation({
    mutationFn: async () => {
      const divergent = q.data?.rows.filter((r) => r.status === "divergent") ?? [];
      if (divergent.length === 0) return { updated: 0, requested: 0 };
      return apply({ data: { order_ids: divergent.map((r) => r.order_id) } });
    },
    onSuccess: (res) => {
      toast.success(`${res.updated} OP(s) sincronizada(s) com o ERP`);
      qc.invalidateQueries({ queryKey: ["erp-sector-sync"] });
      qc.invalidateQueries({ queryKey: ["pcp-orders"] });
      qc.invalidateQueries({ queryKey: ["pcp", "orders"] });
    },
    onError: (e: unknown) => toast.error((e as Error).message ?? "Falha ao sincronizar"),
  });

  const data = q.data;
  const loading = q.isPending;
  const divergentCount = data?.divergent ?? 0;
  const okCount = data?.ok ?? 0;
  const total = data?.total ?? 0;
  const hasIssue = divergentCount > 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div
        className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${
          loading
            ? "border-muted bg-muted/30"
            : hasIssue
              ? "border-amber-500/40 bg-amber-50 dark:bg-amber-950/20"
              : "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/20"
        }`}
        role="status"
        aria-live="polite"
      >
        {loading ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Verificando setores no ERP…</span>
          </>
        ) : hasIssue ? (
          <>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="font-medium">
              {divergentCount} OP(s) com setor divergente do ERP
            </span>
            <span className="text-muted-foreground">
              · {okCount}/{total} em sincronia
            </span>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="font-medium">
              {okCount}/{total} OP(s) em sincronia com o ERP
            </span>
            {(data?.no_link ?? 0) > 0 && (
              <span className="text-muted-foreground inline-flex items-center gap-1">
                <Link2Off className="h-3 w-3" /> {data?.no_link} sem vínculo
              </span>
            )}
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => q.refetch()}
            disabled={loading || q.isRefetching}
          >
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${q.isRefetching ? "animate-spin" : ""}`} />
            Reverificar
          </Button>
          {hasIssue && (
            <Button
              size="sm"
              onClick={() => syncAll.mutate()}
              disabled={syncAll.isPending}
            >
              Sincronizar tudo
            </Button>
          )}
          <SheetTrigger asChild>
            <Button size="sm" variant="outline">
              Detalhes <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </SheetTrigger>
        </div>
      </div>

      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Sincronização de setores ERP ↔ PLM</SheetTitle>
          <SheetDescription>
            Cada OP é comparada com o setor atual no ERP Usesoft (tabela indpcpst).
            A leitura no ERP é read-only; ajustes acontecem apenas no PLM.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          {(data?.rows ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma OP ativa para verificar.</p>
          )}
          {(data?.rows ?? []).map((r) => (
            <RowItem key={r.order_id} r={r} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function statusVariant(s: SyncRow["status"]): { label: string; cls: string } {
  switch (s) {
    case "ok":
      return { label: "OK", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" };
    case "divergent":
      return { label: "Divergente", cls: "bg-amber-100 text-amber-900 border-amber-300" };
    case "no_link":
      return { label: "Sem vínculo ERP", cls: "bg-muted text-muted-foreground" };
    case "erp_missing":
      return { label: "ERP sem setor", cls: "bg-slate-100 text-slate-800 border-slate-300" };
    case "unmapped_sector":
      return { label: "Setor não mapeado", cls: "bg-rose-100 text-rose-900 border-rose-300" };
  }
}

function RowItem({ r }: { r: SyncRow }) {
  const v = statusVariant(r.status);
  return (
    <div className="rounded-md border p-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono font-medium">{r.code}</div>
        <Badge variant="outline" className={v.cls}>
          {v.label}
        </Badge>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-muted-foreground">
        <div>
          PLM: <span className="font-mono text-foreground">{r.plm_stage}</span>
        </div>
        <div>
          ERP:{" "}
          <span className="font-mono text-foreground">
            {r.erp_sector_name ?? "—"}
            {r.erp_stage ? ` (${r.erp_stage})` : ""}
          </span>
        </div>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{r.message}</p>
    </div>
  );
}
