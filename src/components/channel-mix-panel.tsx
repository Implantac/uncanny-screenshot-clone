import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Move, ShoppingBag } from "lucide-react";
import {
  CHANNELS_LIST,
  type ChannelKey,
  getChannelMix,
  setProductChannels,
} from "@/lib/collection-config.functions";
import { Badge } from "@/components/ui/badge";

const CHANNEL_LABEL: Record<ChannelKey, string> = {
  ecommerce: "E-commerce",
  varejo_proprio: "Varejo Próprio",
  multimarcas: "Multimarcas",
  franquia: "Franquia",
  outlet: "Outlet",
};

export function ChannelMixPanel({
  collectionId,
  collectionName,
}: {
  collectionId: string;
  collectionName: string;
}) {
  const listFn = useServerFn(getChannelMix);
  const setFn = useServerFn(setProductChannels);
  const qc = useQueryClient();
  const [dragging, setDragging] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["channel-mix", collectionId],
    queryFn: () => listFn({ data: { collectionId } }),
    staleTime: 30_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["channel-mix", collectionId] });
    qc.invalidateQueries({ queryKey: ["assortment", collectionId] });
  };

  const mut = useMutation({
    mutationFn: (v: { productId: string; channels: ChannelKey[] }) =>
      setFn({ data: { productId: v.productId, collectionId, channels: v.channels } }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const products = data ?? [];

  // Group products into "All channels" column + each specific channel column
  const columns = useMemo(() => {
    const all = products.filter((p) => p.channels.length === CHANNELS_LIST.length);
    const byChannel: Record<ChannelKey, typeof products> = {
      ecommerce: [],
      varejo_proprio: [],
      multimarcas: [],
      franquia: [],
      outlet: [],
    };
    for (const p of products) {
      if (p.channels.length === CHANNELS_LIST.length) continue;
      for (const ch of p.channels) byChannel[ch].push(p);
    }
    return { all, byChannel };
  }, [products]);

  if (isLoading) return null;

  const handleDrop = (ch: ChannelKey | "all", productId: string) => {
    setDragging(null);
    const product = products.find((p) => p.productId === productId);
    if (!product) return;
    const newChannels: ChannelKey[] =
      ch === "all" ? [...CHANNELS_LIST] : [ch];
    mut.mutate({ productId, channels: newChannels });
  };

  return (
    <section className="glass rounded-xl p-4 space-y-3">
      <header className="flex flex-wrap items-center gap-2">
        <Move className="size-4 text-primary" />
        <div className="font-medium text-sm">Mix por Canal</div>
        <span className="text-xs text-muted-foreground truncate">— {collectionName}</span>
        <span className="ms-auto text-[10px] text-muted-foreground">
          Arraste um produto para um canal para torná-lo exclusivo
        </span>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <ChannelColumn
          label="Todos os canais"
          count={columns.all.length}
          products={columns.all}
          onDrop={(pid) => handleDrop("all", pid)}
          onDragStart={setDragging}
          dragging={dragging}
          tone="bg-primary/5"
        />
        {CHANNELS_LIST.map((ch) => (
          <ChannelColumn
            key={ch}
            label={CHANNEL_LABEL[ch]}
            count={columns.byChannel[ch].length}
            products={columns.byChannel[ch]}
            onDrop={(pid) => handleDrop(ch, pid)}
            onDragStart={setDragging}
            dragging={dragging}
            tone="bg-muted/30"
          />
        ))}
      </div>
    </section>
  );
}

function ChannelColumn({
  label,
  count,
  products,
  onDrop,
  onDragStart,
  dragging,
  tone,
}: {
  label: string;
  count: number;
  products: Array<{
    productId: string;
    sku: string;
    name: string;
    imageUrl: string | null;
    role: string;
  }>;
  onDrop: (productId: string) => void;
  onDragStart: (productId: string | null) => void;
  dragging: string | null;
  tone: string;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const pid = e.dataTransfer.getData("text/plain");
        if (pid) onDrop(pid);
      }}
      className={`rounded-md border ${over ? "border-primary ring-1 ring-primary/40" : "border-border"} ${tone} p-2 min-h-[120px] transition`}
    >
      <div className="flex items-center gap-1 mb-2">
        <ShoppingBag className="size-3 text-muted-foreground" />
        <div className="text-[11px] font-medium truncate">{label}</div>
        <Badge variant="outline" className="ms-auto text-[10px]">
          {count}
        </Badge>
      </div>
      <div className="space-y-1">
        {products.slice(0, 8).map((p) => (
          <div
            key={p.productId}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", p.productId);
              onDragStart(p.productId);
            }}
            onDragEnd={() => onDragStart(null)}
            className={`flex items-center gap-1.5 p-1 rounded text-[10px] bg-background border border-border cursor-grab active:cursor-grabbing ${
              dragging === p.productId ? "opacity-40" : ""
            }`}
          >
            {p.imageUrl ? (
              <img src={p.imageUrl} alt="" className="size-5 rounded object-cover" />
            ) : (
              <div className="size-5 rounded bg-muted" />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-mono truncate">{p.sku}</div>
            </div>
          </div>
        ))}
        {products.length > 8 && (
          <div className="text-[10px] text-muted-foreground text-center pt-1">
            +{products.length - 8} mais
          </div>
        )}
      </div>
    </div>
  );
}
