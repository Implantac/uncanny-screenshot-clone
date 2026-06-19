import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Recycle, Sparkles, Star, Infinity as InfinityIcon, Plus, X } from "lucide-react";
import {
  getCarryOverContext,
  addProductToCollection,
  removeProductFromCollection,
  setProductRole,
  type CarryOverCandidate,
  type CollectionRosterRow,
} from "@/lib/carry-over.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ROLE_META: Record<
  CollectionRosterRow["role"],
  { label: string; icon: React.ReactNode; tone: string }
> = {
  hero: { label: "Hero", icon: <Star className="size-3" />, tone: "bg-amber-500/15 text-amber-600" },
  carry_over: {
    label: "Carry-over",
    icon: <Recycle className="size-3" />,
    tone: "bg-sky-500/15 text-sky-600",
  },
  nos: {
    label: "NOS",
    icon: <InfinityIcon className="size-3" />,
    tone: "bg-emerald-500/15 text-emerald-600",
  },
  capsule: { label: "Cápsula", icon: <Sparkles className="size-3" />, tone: "bg-fuchsia-500/15 text-fuchsia-600" },
  regular: { label: "Regular", icon: null, tone: "bg-muted text-muted-foreground" },
};

const fmt = (n: number) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;

export function CarryOverPanel({
  collectionId,
  collectionName,
}: {
  collectionId: string;
  collectionName: string;
}) {
  const ctxFn = useServerFn(getCarryOverContext);
  const addFn = useServerFn(addProductToCollection);
  const removeFn = useServerFn(removeProductFromCollection);
  const roleFn = useServerFn(setProductRole);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["carry-over", collectionId],
    queryFn: () => ctxFn({ data: { collectionId } }),
    staleTime: 30_000,
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["carry-over", collectionId] });

  const addMut = useMutation({
    mutationFn: (c: CarryOverCandidate) =>
      addFn({
        data: {
          productId: c.productId,
          targetCollectionId: collectionId,
          role: c.suggestedRole,
          sourceCollectionId: c.sourceCollectionId,
        },
      }),
    onSuccess: () => {
      toast.success("Produto adicionado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (productId: string) => removeFn({ data: { productId, collectionId } }),
    onSuccess: () => {
      toast.success("Produto removido");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleMut = useMutation({
    mutationFn: (v: { productId: string; role: CollectionRosterRow["role"] }) =>
      roleFn({ data: { productId: v.productId, collectionId, role: v.role } }),
    onSuccess: () => {
      toast.success("Papel atualizado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [tab, setTab] = useState<"roster" | "candidates">("roster");

  if (isLoading) return null;
  const roster = data?.roster ?? [];
  const candidates = data?.candidates ?? [];

  const counts = {
    total: roster.length,
    hero: roster.filter((r) => r.role === "hero").length,
    carry: roster.filter((r) => r.role === "carry_over").length,
    nos: roster.filter((r) => r.role === "nos").length,
  };
  const carryPct = counts.total ? Math.round((counts.carry / counts.total) * 100) : 0;

  return (
    <section className="glass rounded-xl p-4 space-y-3">
      <header className="flex flex-wrap items-center gap-2">
        <Recycle className="size-4 text-primary" />
        <div className="font-medium text-sm">Carry-over & NOS</div>
        <span className="text-xs text-muted-foreground truncate">— {collectionName}</span>
        <div className="ms-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant="outline">{counts.total} no mix</Badge>
          <Badge variant="outline">{counts.hero} hero</Badge>
          <Badge variant="outline">{counts.carry} carry ({carryPct}%)</Badge>
          <Badge variant="outline">{counts.nos} NOS</Badge>
        </div>
      </header>

      {carryPct < 15 && counts.total > 0 && (
        <div className="text-xs rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2.5 py-1.5">
          Coleções com menos de 15% de carry-over costumam sofrer sell-through mais baixo.
          Considere trazer 1–2 campeões da coleção anterior.
        </div>
      )}

      <div className="flex gap-1 border-b border-border text-xs">
        <button
          onClick={() => setTab("roster")}
          className={`px-3 py-1.5 -mb-px border-b-2 ${
            tab === "roster" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
          }`}
        >
          Mix atual ({roster.length})
        </button>
        <button
          onClick={() => setTab("candidates")}
          className={`px-3 py-1.5 -mb-px border-b-2 ${
            tab === "candidates"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground"
          }`}
        >
          Sugestões ({candidates.length})
        </button>
      </div>

      {tab === "roster" ? (
        roster.length === 0 ? (
          <div className="text-xs text-muted-foreground py-6 text-center">
            Nenhum produto neste mix ainda. Use a aba <b>Sugestões</b> para puxar campeões da coleção anterior.
          </div>
        ) : (
          <div className="space-y-1">
            {roster.map((r) => {
              const meta = ROLE_META[r.role];
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-2 text-xs border-b border-border/50 py-1.5"
                >
                  <div className="font-mono w-24 truncate">{r.sku}</div>
                  <div className="flex-1 truncate">{r.name}</div>
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider ${meta.tone}`}
                  >
                    {meta.icon}
                    {meta.label}
                  </span>
                  <Select
                    value={r.role}
                    onValueChange={(v) =>
                      roleMut.mutate({
                        productId: r.productId,
                        role: v as CollectionRosterRow["role"],
                      })
                    }
                  >
                    <SelectTrigger className="h-7 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">Regular</SelectItem>
                      <SelectItem value="hero">Hero</SelectItem>
                      <SelectItem value="carry_over">Carry-over</SelectItem>
                      <SelectItem value="nos">NOS</SelectItem>
                      <SelectItem value="capsule">Cápsula</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    onClick={() => removeMut.mutate(r.productId)}
                    disabled={removeMut.isPending}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )
      ) : candidates.length === 0 ? (
        <div className="text-xs text-muted-foreground py-6 text-center">
          Nenhum candidato — todos os produtos de outras coleções já estão no mix.
        </div>
      ) : (
        <div className="space-y-1.5">
          {candidates.map((c) => {
            const meta = ROLE_META[c.suggestedRole];
            return (
              <div
                key={c.productId}
                className="flex items-center gap-2 text-xs border border-border rounded-md p-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono">{c.sku}</span>
                    <span className="truncate">{c.name}</span>
                  </div>
                  <div className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                    <span>de <i>{c.sourceCollectionName}</i></span>
                    <span>· {c.units90d} un / {fmt(c.revenue90d)}</span>
                    <span>· {c.lifetimeCollections} coleções</span>
                  </div>
                  <div className="text-muted-foreground/80 mt-0.5">{c.reason}</div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider ${meta.tone}`}
                >
                  {meta.icon}
                  {meta.label}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1"
                  onClick={() => addMut.mutate(c)}
                  disabled={addMut.isPending}
                >
                  <Plus className="size-3" /> Trazer
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
