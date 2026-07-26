import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { ArrowLeft, ScanLine, AlertTriangle, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_app/scan")({
  head: () => ({
    meta: [
      { title: "Escanear lote · USE MODA PLM" },
      { name: "description", content: "Escaneie o QR de um lote para apontar produção." },
    ],
  }),
  component: ScanPage,
});

const UUID_RX = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

type Suggestion = {
  id: string;
  batch_code: string | null;
  code: string;
  product_sku: string | null;
  product_name: string | null;
  stage: string | null;
};

function ScanPage() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);

  async function go(target: string) {
    setBusy(true);
    const m = target.match(UUID_RX);
    if (m) {
      navigate({ to: "/apontar/$id", params: { id: m[1] } });
      return;
    }
    const code = target.trim();
    if (!code) {
      setBusy(false);
      return;
    }
    // Exact batch_code match first
    const { data: exact } = await supabase
      .from("production_orders")
      .select("id")
      .eq("batch_code", code)
      .limit(1)
      .maybeSingle();
    if (exact?.id) {
      navigate({ to: "/apontar/$id", params: { id: exact.id } });
      return;
    }
    toast.error(`Lote "${code}" não encontrado`);
    setBusy(false);
  }

  // Partial search: batch_code OR product SKU/name
  useEffect(() => {
    const q = manual.trim();
    if (q.length < 2 || UUID_RX.test(q)) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const like = `%${q}%`;
      const { data } = await supabase
        .from("production_orders")
        .select("id, batch_code, current_stage, products:product_id(sku, name)")
        .or(`batch_code.ilike.${like},product_sku.ilike.${like}`)
        .limit(8);
      if (cancelled) return;
      const rows = (data ?? []).map((r: {
        id: string;
        batch_code: string | null;
        current_stage: string | null;
        products?: { sku?: string | null; name?: string | null } | null;
      }) => ({
        id: r.id,
        batch_code: r.batch_code,
        current_stage: r.current_stage,
        product_sku: r.products?.sku ?? null,
        product_name: r.products?.name ?? null,
      })) as Suggestion[];
      setSuggestions(rows);
      setSearching(false);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [manual]);

  useEffect(() => {
    const id = "qr-reader";
    if (!containerRef.current) return;
    const scanner = new Html5Qrcode(id, { verbose: false });
    scannerRef.current = scanner;
    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          if (busy) return;
          scanner.stop().catch(() => {});
          go(decoded);
        },
        () => {},
      )
      .catch((e) => setError(e?.message ?? "Não foi possível abrir a câmera"));

    return () => {
      scanner.stop().catch(() => {});
      scanner.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/lotes" className="p-2 -ml-2 rounded-md hover:bg-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Chão de fábrica
          </div>
          <div className="text-base font-semibold">Escanear lote</div>
        </div>
        <ScanLine className="size-5 text-muted-foreground" />
      </header>

      <main className="px-4 py-4 space-y-5 max-w-xl mx-auto">
        <section className="rounded-xl overflow-hidden border border-border bg-black aspect-square relative">
          <div id="qr-reader" ref={containerRef} className="absolute inset-0" />
          <div className="pointer-events-none absolute inset-8 border-2 border-primary/70 rounded-2xl" />
        </section>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm p-3 flex items-start gap-2">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">Câmera indisponível</div>
              <div className="text-xs opacity-80">{error}</div>
            </div>
          </div>
        )}

        <section className="rounded-xl border border-border bg-card p-4 space-y-2">
          <label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Keyboard className="size-3.5" /> Digitar código do lote
          </label>
          <div className="flex gap-2">
            <Input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="ex: L-2026-001"
              onKeyDown={(e) => e.key === "Enter" && go(manual)}
            />
            <Button onClick={() => go(manual)} disabled={busy || !manual.trim()}>
              Abrir
            </Button>
          </div>
        </section>

        <p className="text-[11px] text-muted-foreground text-center">
          Aponte a câmera para o QR impresso no lote. Sem QR? Digite o código.
        </p>
      </main>
    </div>
  );
}
