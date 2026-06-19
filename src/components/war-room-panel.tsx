import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  AlertOctagon,
  ShieldCheck,
  Factory,
  Wrench,
  Beaker,
  DollarSign,
  Megaphone,
  ArrowRight,
  Bell,
} from "lucide-react";
import { getWarRoomBottlenecks, type Bottleneck } from "@/lib/war-room.functions";
import { enqueuePushForCurrentUser } from "@/lib/push-notifications.functions";

const MODULE_META: Record<
  Bottleneck["module"],
  { label: string; Icon: typeof Factory; color: string }
> = {
  pcp: { label: "PCP", Icon: Factory, color: "text-blue-400" },
  qualidade: { label: "Qualidade", Icon: Beaker, color: "text-amber-400" },
  desenvolvimento: { label: "Dev", Icon: Wrench, color: "text-violet-400" },
  custo: { label: "Custo", Icon: DollarSign, color: "text-emerald-400" },
  marketing: { label: "Marketing", Icon: Megaphone, color: "text-pink-400" },
};

const SEV_BADGE: Record<Bottleneck["severity"], string> = {
  critica: "bg-red-500/15 text-red-400 border-red-500/30",
  alta: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  media: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

export function WarRoomPanel() {
  const fn = useServerFn(getWarRoomBottlenecks);
  const pushFn = useServerFn(enqueuePushForCurrentUser);
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["war-room-bottlenecks"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
  });

  const pushMutation = useMutation({
    mutationFn: (b: Bottleneck) =>
      pushFn({
        data: {
          title: `[${b.severity.toUpperCase()}] ${b.title}`,
          body: b.detail,
          link: b.action.route ?? undefined,
          kind: "war_room",
          severity: b.severity,
          payload: { bottleneck_id: b.id, module: b.module },
        },
      }),
    onSuccess: (res) => {
      if (res.enqueued > 0) {
        toast.success(`Push enviado para ${res.enqueued} dispositivo(s)`);
      } else {
        toast.warning("Nenhum dispositivo mobile ativo — registre um em /mobile");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return <Card className="p-4 h-40 animate-pulse bg-muted/30" />;
  }

  if (items.length === 0) {
    return (
      <Card className="p-6 flex items-center gap-4">
        <ShieldCheck className="size-8 text-emerald-400" />
        <div>
          <div className="font-medium">Sala de Guerra silenciosa</div>
          <div className="text-xs text-muted-foreground">
            Nenhum gargalo crítico detectado cross-módulo agora.
          </div>
        </div>
      </Card>
    );
  }

  const byModule = items.reduce<Record<string, number>>((acc, b) => {
    acc[b.module] = (acc[b.module] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <AlertOctagon className="size-4 text-red-400" />
          <h3 className="text-sm font-semibold uppercase tracking-widest">Sala de Guerra</h3>
          <Badge variant="outline" className="text-[10px]">
            {items.length} gargalo(s)
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {Object.entries(byModule).map(([m, n]) => {
            const meta = MODULE_META[m as Bottleneck["module"]];
            const Icon = meta.Icon;
            return (
              <div
                key={m}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/40"
              >
                <Icon className={`size-3 ${meta.color}`} />
                <span className="text-muted-foreground">{meta.label}</span>
                <span className="font-mono">{n}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-2">
        {items.map((b) => {
          const meta = MODULE_META[b.module];
          const Icon = meta.Icon;
          return (
            <div
              key={b.id}
              className="flex items-center gap-3 rounded-md border bg-muted/30 p-2.5"
            >
              <Icon className={`size-4 shrink-0 ${meta.color}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-[10px] ${SEV_BADGE[b.severity]}`}>
                    {b.severity}
                  </Badge>
                  <span className="text-sm font-medium truncate">{b.title}</span>
                </div>
                <div className="text-xs text-muted-foreground truncate">{b.detail}</div>
              </div>
              {b.metric && (
                <div className="text-xs font-mono text-muted-foreground hidden sm:block">
                  {b.metric}
                </div>
              )}
              {b.action.route && (
                <Button asChild size="sm" variant="ghost" className="shrink-0">
                  <Link to={b.action.route as string}>
                    {b.action.label}
                    <ArrowRight className="size-3 ml-1" />
                  </Link>
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
