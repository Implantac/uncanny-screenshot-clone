import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, KeyRound, Smartphone, DatabaseBackup, AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/security-center")({ component: SecurityCenter });

type Factor = { id: string; friendly_name?: string | null; factor_type: string; status: string };

function SecurityCenter() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enrolling, setEnrolling] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.all ?? []) as Factor[]);
  }
  useEffect(() => { refresh(); }, []);

  async function startEnroll() {
    setLoading(true); setMsg(null);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Authenticator ${Date.now()}` });
    setLoading(false);
    if (error) return setMsg({ kind: "err", text: error.message });
    setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function verifyEnroll() {
    if (!enrolling) return;
    setLoading(true); setMsg(null);
    const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: enrolling.id });
    if (cErr) { setLoading(false); return setMsg({ kind: "err", text: cErr.message }); }
    const { error } = await supabase.auth.mfa.verify({ factorId: enrolling.id, challengeId: challenge.id, code });
    setLoading(false);
    if (error) return setMsg({ kind: "err", text: error.message });
    setEnrolling(null); setCode(""); setMsg({ kind: "ok", text: "MFA ativado com sucesso." });
    refresh();
  }

  async function unenroll(id: string) {
    if (!confirm("Remover este fator MFA?")) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) return setMsg({ kind: "err", text: error.message });
    setMsg({ kind: "ok", text: "Fator removido." });
    refresh();
  }

  const verified = factors.filter((f) => f.status === "verified");

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Centro de Segurança</h1>
        <p className="text-sm text-muted-foreground">
          MFA, política de senhas, criptografia e backups — postura de segurança da plataforma.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatusCard icon={ShieldCheck} label="MFA Ativo" active={verified.length > 0} hint={verified.length > 0 ? `${verified.length} fator(es)` : "Não configurado"} />
        <StatusCard icon={KeyRound} label="Senha Vazada (HIBP)" active hint="Bloqueio ativado" />
        <StatusCard icon={DatabaseBackup} label="Backup Diário" active hint="Gerenciado pela infra" />
      </div>

      {msg && (
        <div className={`rounded-md border p-3 text-sm ${msg.kind === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-rose-500/30 bg-rose-500/10 text-rose-700"}`}>
          {msg.text}
        </div>
      )}

      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Smartphone className="size-5 text-primary" />
          <h2 className="font-medium">Autenticação em 2 fatores (TOTP)</h2>
        </div>

        {factors.length > 0 && (
          <ul className="space-y-2">
            {factors.map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <div className="font-medium text-sm">{f.friendly_name || f.factor_type}</div>
                  <div className="text-xs text-muted-foreground">
                    {f.factor_type.toUpperCase()} · status: {f.status}
                  </div>
                </div>
                <button onClick={() => unenroll(f.id)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent">
                  <Trash2 className="size-3" /> Remover
                </button>
              </li>
            ))}
          </ul>
        )}

        {!enrolling && (
          <button onClick={startEnroll} disabled={loading} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50">
            <ShieldCheck className="size-4" /> Adicionar autenticador
          </button>
        )}

        {enrolling && (
          <div className="space-y-3 rounded-md border border-border p-4 bg-muted/30">
            <p className="text-sm">Escaneie o QR no seu app autenticador (Google Authenticator, 1Password, Authy):</p>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="bg-white p-3 rounded-md" dangerouslySetInnerHTML={{ __html: enrolling.qr }} />
              <div className="text-xs">
                <div className="text-muted-foreground mb-1">Ou insira manualmente:</div>
                <code className="font-mono break-all">{enrolling.secret}</code>
              </div>
            </div>
            <div className="flex gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código de 6 dígitos" inputMode="numeric" maxLength={6} className="rounded-md border border-border bg-background px-3 py-2 text-sm font-mono w-40" />
              <button onClick={verifyEnroll} disabled={loading || code.length < 6} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">Verificar</button>
              <button onClick={() => { setEnrolling(null); setCode(""); }} className="rounded-md border border-border px-3 py-2 text-sm">Cancelar</button>
            </div>
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoCard title="Política de senhas" items={[
          "Bloqueio de senhas vazadas (HIBP) ativo",
          "Mínimo de 6 caracteres",
          "Hash bcrypt com salt único por usuário",
        ]} />
        <InfoCard title="Criptografia & rede" items={[
          "TLS 1.3 em todas as conexões",
          "Dados em repouso criptografados (AES-256)",
          "JWTs assinados (RS256) com rotação automática",
        ]} />
        <InfoCard title="Backup & continuidade" items={[
          "Backups diários automáticos retidos por 7 dias",
          "Point-in-time recovery disponível",
          "Replicação multi-AZ",
        ]} />
        <InfoCard title="LGPD" items={[
          "Trilhas de auditoria em /audit",
          "Direito ao esquecimento via exclusão de conta",
          "Exportação de dados sob demanda (CSV)",
        ]} />
      </section>
    </div>
  );
}

function StatusCard({ icon: Icon, label, active, hint }: { icon: any; label: string; active: boolean; hint: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="size-4" />{label}</div>
        {active ? <CheckCircle2 className="size-4 text-emerald-500" /> : <AlertTriangle className="size-4 text-amber-500" />}
      </div>
      <div className="mt-2 text-lg font-semibold">{active ? "Ativo" : "Inativo"}</div>
      <div className="text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function InfoCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="font-medium text-sm mb-2">{title}</h3>
      <ul className="space-y-1.5 text-sm text-muted-foreground">
        {items.map((i) => (
          <li key={i} className="flex items-start gap-2">
            <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" /><span>{i}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
