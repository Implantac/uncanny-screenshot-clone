import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getPublicPassport } from "@/lib/dpp.functions";
import { ShieldCheck, Leaf, Globe, MapPin } from "lucide-react";

export const Route = createFileRoute("/dpp/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Digital Product Passport · ${params.id.slice(0, 8)}` },
      { name: "description", content: "Rastreabilidade, origem e impacto ambiental desta peça." },
      { property: "og:title", content: "Digital Product Passport · USE MODA" },
      { property: "og:description", content: "Rastreabilidade, origem e impacto ambiental desta peça." },
    ],
  }),
  loader: ({ params, context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["public-passport", params.id],
      queryFn: () => getPublicPassport({ data: { id: params.id } }),
    }),
  component: PublicPassport,
  errorComponent: () => <Fallback msg="Não foi possível carregar o passaporte." />,
  notFoundComponent: () => <Fallback msg="Passaporte não encontrado." />,
});

function Fallback({ msg }: { msg: string }) {
  return (
    <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
      <div className="text-center space-y-3">
        <ShieldCheck className="size-10 mx-auto text-muted-foreground" />
        <div className="text-sm text-muted-foreground">{msg}</div>
        <Link to="/" className="text-xs text-primary underline">Voltar</Link>
      </div>
    </div>
  );
}

function PublicPassport() {
  const { id } = Route.useParams();
  const { data: p } = useSuspenseQuery({
    queryKey: ["public-passport", id],
    queryFn: () => getPublicPassport({ data: { id } }),
  });
  if (!p) return <Fallback msg="Passaporte não encontrado." />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-xl mx-auto p-5 sm:p-8 space-y-6">
        <header className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center">
            <ShieldCheck className="size-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Digital Product Passport</div>
            <div className="font-semibold">USE MODA</div>
          </div>
        </header>

        {p.image_url && (
          <img src={p.image_url} alt={p.name} className="w-full aspect-square object-cover rounded-xl border border-border" />
        )}

        <div>
          <div className="text-xs text-muted-foreground tabular-nums">{p.sku} · {p.lote}</div>
          <h1 className="text-2xl font-semibold mt-1">{p.name}</h1>
          {p.collection && <div className="text-sm text-muted-foreground">{p.collection.name} {p.collection.season}/{p.collection.year}</div>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card icon={<Leaf className="size-4 text-emerald-500" />} label="CO₂ por peça" value={`${p.co2} kg`} />
          <Card icon={<Globe className="size-4 text-primary" />} label="Certificações" value={p.cert} />
          <Card icon={<MapPin className="size-4 text-warning" />} label="Origem" value={p.origem} />
          <Card icon={<ShieldCheck className="size-4 text-muted-foreground" />} label="Peças emitidas" value={String(p.emitidos)} />
        </div>

        {(p.composition || p.care || p.repairability != null) && (
          <div className="rounded-xl border border-border p-4 space-y-2 text-sm">
            {p.composition && (<div><div className="text-[10px] uppercase tracking-widest text-muted-foreground">Composição</div><div>{p.composition}</div></div>)}
            {p.care && (<div><div className="text-[10px] uppercase tracking-widest text-muted-foreground">Cuidados</div><div>{p.care}</div></div>)}
            {p.repairability != null && (<div><div className="text-[10px] uppercase tracking-widest text-muted-foreground">Reparabilidade</div><div>{p.repairability}/10</div></div>)}
          </div>
        )}

        <div className="rounded-xl border border-border p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Cadeia produtiva</div>
          <div className="flex flex-wrap gap-1.5">
            {p.stages.map((s) => (
              <span key={s} className="px-2 py-1 rounded-full text-xs bg-emerald-500/15 text-emerald-500">{s}</span>
            ))}
          </div>
        </div>

        <div className="text-[10px] text-muted-foreground text-center">
          Verificado por USE MODA OS · v{p.version} · ID {(p.record_id ?? p.id).slice(0, 8)}
        </div>
      </div>
    </div>
  );
}

function Card({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 font-medium truncate">{value}</div>
    </div>
  );
}
