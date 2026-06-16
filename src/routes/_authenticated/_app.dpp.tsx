import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, QrCode, Leaf, Globe, Loader2, Printer, ExternalLink, Send } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useServerFn } from "@tanstack/react-start";
import { publishPassport } from "@/lib/dpp.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_app/dpp")({
  head: () => ({
    meta: [
      { title: "Digital Product Passport · USE MODA OS" },
      { name: "description", content: "Rastreabilidade e compliance ESG por peça." },
    ],
  }),
  component: DPP,
});

const CERTS = ["GOTS · OEKO-TEX", "OEKO-TEX", "BCI · OEKO-TEX", "GOTS", "European Flax"];
const ORIGINS = ["Brasil · SP", "Brasil · MG", "Brasil · SC", "Portugal", "Itália"];
const STAGES = ["Fiação", "Tecelagem", "Tinturaria", "Confecção", "Acabamento", "Distribuição"];

function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

type Passport = {
  id: string; sku: string; name: string; category: string | null;
  lote: string; emitidos: number; co2: string; cert: string;
  origem: string; col: { name: string; season: string; year: number } | null;
};

function DPP() {
  useRealtime("products", ["dpp"]);
  const [selected, setSelected] = useState<Passport | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["dpp"],
    queryFn: async () => {
      const { data: products } = await supabase
        .from("products")
        .select("id, sku, name, category, collection_id, collections(name, season, year)")
        .order("updated_at", { ascending: false })
        .limit(12);
      return products ?? [];
    },
  });

  const items: Passport[] = (data ?? []).map((p) => {
    const h = hash(p.id);
    return {
      id: p.id, sku: p.sku, name: p.name, category: p.category,
      lote: `L-${String(h % 9999).padStart(4, "0")}`,
      emitidos: 100 + (h % 500),
      co2: (2 + ((h % 70) / 10)).toFixed(1),
      cert: CERTS[h % CERTS.length],
      origem: ORIGINS[h % ORIGINS.length],
      col: (p as any).collections ?? null,
    };
  });

  const avgCo2 = items.length ? (items.reduce((s, i) => s + Number(i.co2), 0) / items.length).toFixed(1) : "—";

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
          <ShieldCheck className="size-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Digital Product Passport</h1>
          <p className="text-sm text-muted-foreground">Rastreabilidade, compliance ESG e EU DPP</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: "Passaportes emitidos", v: items.reduce((s, i) => s + i.emitidos, 0).toLocaleString("pt-BR"), i: QrCode },
          { l: "Pegada de CO₂ média", v: `${avgCo2} kg`, i: Leaf },
          { l: "Produtos rastreados", v: items.length.toLocaleString("pt-BR"), i: ShieldCheck },
          { l: "Certificações ativas", v: new Set(items.map((i) => i.cert)).size, i: Globe },
        ].map((k) => {
          const Icon = k.i;
          return (
            <div key={k.l} className="glass rounded-xl p-5">
              <Icon className="size-5 text-primary" />
              <div className="text-2xl font-semibold mt-3 tabular-nums">{k.v}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{k.l}</div>
            </div>
          );
        })}
      </div>

      {isLoading ? (
        <div className="glass rounded-xl p-12 grid place-items-center text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center text-sm text-muted-foreground">Nenhum produto para emitir DPP. Cadastre produtos primeiro.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className="glass rounded-xl p-5 text-left hover:bg-muted/30 transition-colors group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground tabular-nums truncate">{p.sku} · {p.lote}</div>
                  <div className="font-medium mt-0.5 truncate">{p.name}</div>
                </div>
                <div className="size-12 rounded-md bg-foreground/10 grid place-items-center shrink-0 group-hover:bg-primary/15 transition-colors">
                  <QrCode className="size-7" />
                </div>
              </div>
              <div className="mt-4 space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Peças emitidas</span><span className="tabular-nums font-medium">{p.emitidos}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">CO₂ por peça</span><span className="tabular-nums font-medium">{p.co2} kg</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Coleção</span><span className="font-medium truncate ml-2">{p.col ? `${p.col.name} ${p.col.season}/${p.col.year}` : "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Certificações</span><span className="font-medium text-emerald-400">{p.cert}</span></div>
              </div>
              <div className="mt-3 text-[10px] uppercase tracking-widest text-primary inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                Ver passaporte <ExternalLink className="size-3" />
              </div>
            </button>
          ))}
        </div>
      )}

      <PassportDialog passport={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function PassportQR({ id }: { id: string }) {
  const url = typeof window !== "undefined" ? `${window.location.origin}/dpp/${id}` : `/dpp/${id}`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(url)}`;
  return (
    <div className="space-y-2">
      <img src={qr} alt="QR Code" className="w-44 h-44 mx-auto rounded-md bg-white p-2" />
      <a href={`/dpp/${id}`} target="_blank" rel="noreferrer" className="block text-center text-xs text-primary underline truncate">
        /dpp/{id.slice(0, 8)}
      </a>
    </div>
  );
}

function PassportDialog({ passport, onClose }: { passport: Passport | null; onClose: () => void }) {
  return (
    <Dialog open={!!passport} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Passaporte digital</DialogTitle>
          <DialogDescription>Rastreabilidade completa da peça.</DialogDescription>
        </DialogHeader>
        {passport && (
          <div className="space-y-4">
            <div className="text-center">
              <PassportQR id={passport.id} />
              <div className="text-xs text-muted-foreground mt-2 tabular-nums">{passport.sku} · {passport.lote}</div>
              <div className="font-semibold mt-1">{passport.name}</div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <Field label="Coleção" value={passport.col ? `${passport.col.name} ${passport.col.season}/${passport.col.year}` : "—"} />
              <Field label="Origem" value={passport.origem} />
              <Field label="Categoria" value={passport.category || "—"} />
              <Field label="Certificações" value={passport.cert} accent />
              <Field label="Peças emitidas" value={String(passport.emitidos)} />
              <Field label="CO₂ por peça" value={`${passport.co2} kg`} />
            </div>
            <div className="glass rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Cadeia produtiva</div>
              <div className="flex flex-wrap gap-1.5">
                {STAGES.map((s, i) => (
                  <span key={s} className={`px-2 py-0.5 rounded-full text-[11px] ${i < STAGES.length - 1 ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <Button variant="outline" className="w-full gap-2" onClick={() => window.print()}>
              <Printer className="size-4" /> Imprimir / salvar PDF
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-0.5 truncate ${accent ? "text-emerald-400 font-medium" : "font-medium"}`}>{value}</div>
    </div>
  );
}
