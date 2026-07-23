import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Loader2,
  ChevronDown,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type GateRow = { requirement: string; ok: boolean; detail: string | null };
type Approval = {
  id: string;
  gate_key: string;
  decision: "pendente" | "aprovado" | "rejeitado";
  approver_id: string | null;
  note: string | null;
  decided_at: string | null;
};

/**
 * StageGatePanel — versão expansível do StageGateBadge.
 * Mostra os requisitos de liberação com CTA "resolver agora" e
 * botões de aprovação/rejeição por gate, gravados em product_approvals.
 */
export function StageGatePanel({ productId }: { productId: string }) {
  const qc = useQueryClient();

  const gatesQ = useQuery({
    queryKey: ["product-gate-status", productId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("product_gate_status", {
        _product_id: productId,
      });
      if (error) throw error;
      return (data ?? []) as GateRow[];
    },
    staleTime: 30_000,
  });

  const approvalsQ = useQuery({
    queryKey: ["product-approvals", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_approvals")
        .select("id, gate_key, decision, approver_id, note, decided_at")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Approval[];
    },
    staleTime: 30_000,
  });

  const decide = useMutation({
    mutationFn: async (input: {
      gate_key: string;
      decision: "aprovado" | "rejeitado";
    }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Sem sessão");
      const { data: prod } = await supabase
        .from("products")
        .select("owner_id")
        .eq("id", productId)
        .maybeSingle();
      if (!prod?.owner_id) throw new Error("Produto sem dono");
      const { error } = await supabase.from("product_approvals").insert({
        product_id: productId,
        owner_id: prod.owner_id,
        gate_key: input.gate_key,
        decision: input.decision,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(`Gate "${v.gate_key}" ${v.decision}`);
      qc.invalidateQueries({ queryKey: ["product-approvals", productId] });
      qc.invalidateQueries({ queryKey: ["product-events", productId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const latestByGate = useMemo(() => {
    const map = new Map<string, Approval>();
    (approvalsQ.data ?? []).forEach((a) => {
      if (!map.has(a.gate_key)) map.set(a.gate_key, a);
    });
    return map;
  }, [approvalsQ.data]);

  if (gatesQ.isLoading) {
    return (
      <Badge variant="outline" className="gap-1.5">
        <Loader2 className="size-3 animate-spin" /> Gates
      </Badge>
    );
  }

  const gates = gatesQ.data ?? [];
  const missing = gates.filter((g) => !g.ok);
  const ready = missing.length === 0 && gates.length > 0;

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
          style={{
            borderColor: ready
              ? "hsl(var(--success) / 0.4)"
              : missing.length >= 3
                ? "hsl(var(--destructive) / 0.4)"
                : "hsl(38 92% 50% / 0.4)",
            color: ready
              ? "hsl(var(--success))"
              : missing.length >= 3
                ? "hsl(var(--destructive))"
                : "hsl(38 92% 40%)",
            backgroundColor: ready
              ? "hsl(var(--success) / 0.1)"
              : missing.length >= 3
                ? "hsl(var(--destructive) / 0.1)"
                : "hsl(38 92% 50% / 0.1)",
          }}
        >
          {ready ? (
            <CheckCircle2 className="size-3.5" />
          ) : (
            <ShieldAlert className="size-3.5" />
          )}
          {ready
            ? "Pronto para produção"
            : `${gates.length - missing.length}/${gates.length} gates`}
          <ChevronDown className="size-3" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 w-[380px] rounded-md border bg-popover shadow-md">
        <div className="border-b p-3">
          <div className="text-sm font-semibold">Stage Gates & Aprovações</div>
          <div className="text-xs text-muted-foreground">
            Requisitos e decisões formais para liberar produção
          </div>
        </div>
        <ul className="divide-y max-h-[420px] overflow-auto">
          {gates.map((g) => {
            const approval = latestByGate.get(g.requirement);
            const decided =
              approval?.decision === "aprovado" ||
              approval?.decision === "rejeitado";
            return (
              <li key={g.requirement} className="p-3">
                <div className="flex items-start gap-2">
                  {g.ok ? (
                    <CheckCircle2 className="size-4 shrink-0 text-success mt-0.5" />
                  ) : (
                    <XCircle className="size-4 shrink-0 text-destructive mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{g.requirement}</div>
                    {g.detail && (
                      <div className="text-xs text-muted-foreground">
                        {g.detail}
                      </div>
                    )}
                    {approval && (
                      <div className="mt-1 text-[11px]">
                        <Badge
                          variant="outline"
                          className={
                            approval.decision === "aprovado"
                              ? "border-success/40 text-success"
                              : approval.decision === "rejeitado"
                                ? "border-destructive/40 text-destructive"
                                : ""
                          }
                        >
                          {approval.decision}
                          {approval.decided_at
                            ? ` · ${new Date(approval.decided_at).toLocaleDateString("pt-BR")}`
                            : ""}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
                {g.ok && !decided && (
                  <div className="mt-2 flex gap-2 pl-6">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-xs"
                      disabled={decide.isPending}
                      onClick={() =>
                        decide.mutate({
                          gate_key: g.requirement,
                          decision: "aprovado",
                        })
                      }
                    >
                      <ThumbsUp className="size-3" /> Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-xs"
                      disabled={decide.isPending}
                      onClick={() =>
                        decide.mutate({
                          gate_key: g.requirement,
                          decision: "rejeitado",
                        })
                      }
                    >
                      <ThumbsDown className="size-3" /> Rejeitar
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {!ready && (
          <div className="border-t bg-muted/30 p-3 text-xs text-muted-foreground">
            Resolva os itens acima antes de mover o produto para{" "}
            <strong>active</strong>.
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
