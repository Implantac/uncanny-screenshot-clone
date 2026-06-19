import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, X, FileText, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

type Props = {
  bucket: string;
  value: string | null | undefined;
  onChange: (signedUrl: string | null, path: string | null) => void;
  accept?: string;
  kind?: "image" | "file";
  /** Texto pequeno para acessibilidade / placeholder */
  label?: string;
};

/**
 * Upload para Supabase Storage (privado) com URL assinada (1 ano).
 * Caminho: <auth.uid()>/<timestamp>-<safe-filename>
 */
export function StorageUploader({ bucket, value, onChange, accept, kind = "file", label }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("Faça login para enviar arquivos.");
      const safe = file.name.replace(/[^\w.-]+/g, "_");
      const path = `${uid}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });
      if (error) throw error;
      const { data: signed, error: sErr } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (sErr) throw sErr;
      onChange(signed.signedUrl, path);
      toast.success("Arquivo enviado");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no upload");
    } finally {
      setBusy(false);
    }
  }

  const hasValue = !!value;
  const Icon = kind === "image" ? ImageIcon : FileText;

  return (
    <div className="space-y-2">
      <input
        ref={ref}
        type="file"
        accept={accept ?? (kind === "image" ? "image/*" : undefined)}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      {hasValue ? (
        <div className="flex items-center gap-2">
          {kind === "image" ? (
            <img
              src={value!}
              alt={label ?? ""}
              className="size-16 rounded-lg border border-border object-cover bg-muted"
            />
          ) : (
            <a
              href={value!}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <FileText className="size-4" /> Abrir arquivo
            </a>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => ref.current?.click()}
            disabled={busy}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}{" "}
            Trocar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(null, null)}
            disabled={busy}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => ref.current?.click()}
          disabled={busy}
          className="gap-2"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <Icon className="size-4" /> <Upload className="size-3.5" />
            </>
          )}
          {busy ? "Enviando…" : (label ?? "Enviar arquivo")}
        </Button>
      )}
    </div>
  );
}
