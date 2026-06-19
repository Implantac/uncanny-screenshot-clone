import { QrCode, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

type Props = { batchCode: string; batchId: string };

/**
 * QR code que abre o próprio lote no celular (operador escaneia e cai direto
 * na página do lote para apontar passagens, ocorrências, etc.).
 */
export function LoteQrButton({ batchCode, batchId }: Props) {
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/lote/${batchId}`
      : `/lote/${batchId}`;

  const print = () => {
    const w = window.open("", "_blank", "width=420,height=520");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>QR Lote ${batchCode}</title>
      <style>body{font-family:system-ui;text-align:center;padding:24px}h1{font-size:18px;margin:0 0 8px}p{color:#666;font-size:12px;margin:4px 0 16px}img,svg{width:280px;height:280px}</style>
      </head><body><h1>Lote ${batchCode}</h1><p>${url}</p><div id="q"></div>
      <script>document.getElementById('q').innerHTML = \`${document.getElementById(`qr-${batchId}`)?.outerHTML ?? ""}\`;setTimeout(()=>window.print(),200);</script>
      </body></html>`);
    w.document.close();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <QrCode className="size-4" /> QR
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[260px] space-y-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Escaneie no chão de fábrica
        </div>
        <div className="bg-white rounded-lg p-3 grid place-items-center">
          <QRCodeSVG id={`qr-${batchId}`} value={url} size={216} level="M" />
        </div>
        <div className="text-[11px] text-muted-foreground break-all">{url}</div>
        <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={print}>
          <Printer className="size-3.5" /> Imprimir etiqueta
        </Button>
      </PopoverContent>
    </Popover>
  );
}
