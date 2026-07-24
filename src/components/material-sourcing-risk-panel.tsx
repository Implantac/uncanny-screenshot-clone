import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Package,
  Factory,
  Calendar,
  AlertOctagon,
  ArrowLeftRight,
  Loader2,
  Check,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  applyMaterialSupplierSwap,
  getMaterialSourcingRisks,
  simulateMaterialSupplierSwap,
  type MaterialSourcingRisk,
  type MaterialSwapSimulation,
} from "@/lib/material-sourcing-risk.functions";
import { Markdown } from "@/components/markdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function DeltaBadge({ pct, hasEstimate }: { pct: number | null; hasEstimate: boolean }) {
  if (!hasEstimate || pct == null) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
        <Minus className="size-2.5" />
        s/ estimativa
      </span>
    );
  }
  const zero = Math.abs(pct) < 0.05;
  if (zero) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
        <Minus className="size-2.5" /> ~0%
      </span>
    );
  }
  const up = pct > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-mono ${up ? "text-destructive" : "text-emerald-600"}`}
    >
      <Icon className="size-2.5" />
      {up ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

function SwapButton({ row }: { row: MaterialSourcingRisk }) {
  const qc = useQueryClient();
  const swap = useServerFn(applyMaterialSupplierSwap);
  const simulate = useServerFn(simulateMaterialSupplierSwap);
  const [pending, setPending] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const candidateIds = row.alternateSuppliers.map((s) => s.id);

  const { data: sims, isLoading: simLoading } = useQuery({
    queryKey: ["material-swap-sim", row.key, candidateIds.join(",")],
    queryFn: () =>
      simulate({
        data: {
          materialKey: row.key,
          candidateSupplierIds: candidateIds,
          materialLibraryIds: row.materialLibraryIds,
        },
      }),
    enabled: open && candidateIds.length > 0,
    staleTime: 30_000,
  });

  const simById = new Map<string, MaterialSwapSimulation>();
  (sims ?? []).forEach((s) => simById.set(s.newSupplierId, s));

  const mutation = useMutation({
    mutationFn: (vars: { newSupplierId: string; override?: { reason: string } }) =>
      swap({
        data: {
          materialKey: row.key,
          newSupplierId: vars.newSupplierId,
          materialLibraryIds: row.materialLibraryIds,
          override: vars.override,
        },
      }),
    onMutate: (v) => setPending(v.newSupplierId),
    onSuccess: (res, vars) => {
      const name = row.alternateSuppliers.find((s) => s.id === vars.newSupplierId)?.name ?? "fornecedor";
      if (res.blocked) {
        const sign = res.worstPct > 0 ? "+" : "";
        const target = res.worstProductName ?? res.worstSku ?? "produto ativo";
        const reason = window.prompt(
          `⚠️ Guardrail de custo\n\nImpacto estimado ${sign}${res.worstPct.toFixed(1)}% em ${target} (limite ${res.threshold}%, ${res.affectedActive} ficha(s) ativa(s)).\n\nDigite o motivo para prosseguir com a substituição:`,
        );
        if (reason && reason.trim().length >= 5) {
          mutation.mutate({ newSupplierId: vars.newSupplierId, override: { reason: reason.trim() } });
        } else if (reason !== null) {
          toast.warning("Motivo obrigatório (mínimo 5 caracteres) — substituição cancelada.");
        }
        return;
      }
      if (res.updated === 0) {
        toast.warning(
          `Nenhum material "${row.displayName}" encontrado no material_library — cadastre antes de aplicar substituição.`,
        );
      } else {
        toast.success(
          `${res.updated} material(is) atualizado(s) → ${name}${res.overridden ? " (override registrado)" : ""}`,
        );
      }
      qc.invalidateQueries({ queryKey: ["material-sourcing-risks"] });
      qc.invalidateQueries({ queryKey: ["tech-sheet-bom-reviews"] });
      qc.invalidateQueries({ queryKey: ["tech-sheet-cost-alerts"] });
    },
    onError: (e) => toast.error(`Falha na substituição: ${(e as Error).message}`),
    onSettled: () => setPending(null),
  });

  if (row.alternateSuppliers.length === 0) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={mutation.isPending}
          className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary disabled:opacity-50"
        >
          {mutation.isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <ArrowLeftRight className="size-3" />
          )}
          Simular & aplicar
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="text-xs">
          Trocar fornecedor em <span className="font-semibold">{row.displayName}</span>
          {simLoading && (
            <span className="ml-2 inline-flex items-center gap-1 text-muted-foreground text-[10px]">
              <Loader2 className="size-2.5 animate-spin" /> simulando…
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {row.alternateSuppliers.map((s) => {
          const sim = simById.get(s.id);
          const has = !!sim?.hasReferenceCost || sim?.estimatedUnitCost != null;
          const pct = sim?.materialsCostDeltaPct ?? null;
          return (
            <DropdownMenuItem
              key={s.id}
              disabled={mutation.isPending}
              onSelect={(e) => {
                e.preventDefault();
                mutation.mutate(s.id);
              }}
              className="flex flex-col items-stretch gap-0.5 text-xs py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">
                  {s.name ?? s.id.slice(0, 6)}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  {pending === s.id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Check className="size-3 text-emerald-500" />
                  )}
                  score {s.score}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                <span>
                  {sim?.affectedDrafts ?? 0} ficha(s){" "}
                  {sim?.estimatedUnitCost != null && (
                    <>· unit. est. {brl(sim.estimatedUnitCost)}</>
                  )}
                </span>
                <DeltaBadge pct={pct} hasEstimate={has} />
              </div>
              {sim?.worst && has && (
                <div className="text-[10px] text-muted-foreground truncate">
                  Pior: {sim.worst.productName ?? sim.worst.sku ?? sim.worst.techSheetId.slice(0, 6)} ({sim.worst.deltaPct > 0 ? "+" : ""}
                  {sim.worst.deltaPct.toFixed(1)}%)
                </div>
              )}
            </DropdownMenuItem>
          );
        })}
        {row.materialLibraryIds.length === 0 && (
          <div className="px-2 py-1.5 text-[10px] text-muted-foreground">
            Material não está cadastrado em material_library — substituição criará vínculo por nome.
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MaterialSourcingRiskPanel() {
  const fn = useServerFn(getMaterialSourcingRisks);
  const { data, isLoading } = useQuery({
    queryKey: ["material-sourcing-risks"],
    queryFn: () => fn({}),
    staleTime: 60_000,
  });

  if (isLoading || !data) return null;
  if (data.rows.length === 0) return null;

  return (
    <section className="glass rounded-xl p-4 space-y-3">
      <header className="flex items-center gap-2">
        <Package className="size-4 text-primary" />
        <div className="font-medium text-sm">Material → Sourcing</div>
        <span className="text-xs text-muted-foreground">
          — materiais com falha sistêmica no BOM
        </span>
        <div className="ml-auto flex gap-3 text-xs text-muted-foreground">
          <span>{data.summary.materialsAtRisk} em risco</span>
          <span>{data.summary.totalOpenCapas} CAPAs abertas</span>
          <span>{data.summary.totalProducts} produtos</span>
        </div>
      </header>

      <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <Markdown content={data.insight} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {data.rows.map((r) => (
          <div key={r.key} className="rounded-md border border-border p-2.5 text-xs space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium truncate">{r.displayName}</div>
              <span
                className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  r.riskLabel === "critico"
                    ? "bg-destructive/15 text-destructive"
                    : r.riskLabel === "atencao"
                      ? "bg-amber-500/15 text-amber-600"
                      : "bg-emerald-500/15 text-emerald-600"
                }`}
              >
                {r.riskLabel} · {r.riskScore}
              </span>
            </div>
            <div className="text-muted-foreground flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <AlertOctagon className="size-3" /> {r.openCapaCount}/{r.capaCount} CAPAs
              </span>
              <span className="inline-flex items-center gap-1">
                <Factory className="size-3" /> {r.productsAffected} produtos
              </span>
              {r.activeCollections[0]?.daysToLaunch != null && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="size-3" /> {r.activeCollections[0].daysToLaunch}d
                </span>
              )}
            </div>
            <div className="text-muted-foreground/90 prose prose-xs dark:prose-invert max-w-none [&_p]:my-0">
              <Markdown content={r.recommendation} />
            </div>
            {r.suppliers.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {r.suppliers.map((s) => (
                  <span
                    key={s.id}
                    className="text-[10px] border border-border rounded px-1.5 py-0.5"
                    title={`${s.capaCount} CAPAs${s.avgScore != null ? ` · score ${Math.round(s.avgScore)}` : ""}`}
                  >
                    {s.name ?? s.id.slice(0, 6)}
                    <span className="ml-1 text-destructive">×{s.capaCount}</span>
                    {s.avgScore != null && (
                      <span
                        className={`ml-1 ${s.avgScore < 60 ? "text-destructive" : "text-muted-foreground"}`}
                      >
                        {Math.round(s.avgScore)}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            )}
            {r.activeCollections.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {r.activeCollections.map((c) => (
                  <Link
                    key={c.id}
                    to="/colecao-360/$id"
                    params={{ id: c.id }}
                    className="text-[10px] border border-border rounded px-1.5 py-0.5 hover:bg-muted"
                  >
                    {c.name}
                    {c.daysToLaunch != null && (
                      <span className="ml-1 text-muted-foreground">{c.daysToLaunch}d</span>
                    )}
                  </Link>
                ))}
              </div>
            )}
            <div className="pt-1 flex justify-end">
              <SwapButton row={r} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
