import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { autoPushCriticalBottlenecks } from "@/lib/auto-push.functions";

const INTERVAL_MS = 5 * 60_000;

export function AutoPushSentinel() {
  const qc = useQueryClient();
  const fn = useServerFn(autoPushCriticalBottlenecks);

  const mutation = useMutation({
    mutationFn: () => fn(),
    onSuccess: (res, _vars, _ctx) => {
      if (res.enqueued > 0) {
        toast.warning(
          `🚨 ${res.enqueued} alerta(s) crítico(s) novo(s) — push enviado para ${res.devicesReached} dispositivo(s)`,
          { duration: 6000 },
        );
        qc.invalidateQueries({ queryKey: ["push-notifications-recent"] });
      }
    },
  });

  // Auto-poll silencioso a cada 5 min — silencia falhas para não poluir
  useEffect(() => {
    const tick = () => mutation.mutate(undefined, { onError: () => {} });
    const t = setInterval(tick, INTERVAL_MS);
    // primeira execução após 15s para não competir com paint inicial
    const first = setTimeout(tick, 15_000);
    return () => {
      clearInterval(t);
      clearTimeout(first);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const last = mutation.data;

  return (
    <div className="flex items-center gap-2 text-xs">
      <Badge variant="outline" className="gap-1 bg-amber-500/10 text-amber-400 border-amber-500/30">
        <ShieldAlert className="size-3" />
        Sentinela auto-push
      </Badge>
      {last && (
        <span className="text-muted-foreground tabular-nums">
          {last.enqueued} novo(s) · {last.skipped} já enviados · {last.devicesReached} device(s)
        </span>
      )}
      <Button
        size="sm"
        variant="ghost"
        className="h-6 px-2"
        disabled={mutation.isPending}
        onClick={() =>
          mutation.mutate(undefined, {
            onSuccess: (r) => {
              if (r.enqueued === 0) toast.info("Nenhum alerta crítico novo");
            },
            onError: (e: Error) => toast.error(e.message),
          })
        }
      >
        <Zap className="size-3 mr-1" />
        Verificar agora
      </Button>
    </div>
  );
}
