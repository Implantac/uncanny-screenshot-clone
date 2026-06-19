import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Lock, DatabaseBackup, KeyRound, FileText, Mail } from "lucide-react";

export const Route = createFileRoute("/trust")({
  component: TrustPage,
  head: () => ({
    meta: [
      { title: "Trust & Security · USE MODA PLM" },
      {
        name: "description",
        content:
          "Como protegemos seus dados: criptografia, controle de acesso, autenticação multifator, backups e privacidade (LGPD).",
      },
      { property: "og:title", content: "Trust & Security · USE MODA PLM" },
      {
        property: "og:description",
        content:
          "Visão geral dos controles de segurança, privacidade e continuidade do USE MODA PLM.",
      },
    ],
  }),
});

function TrustPage() {
  const sections = [
    {
      icon: Lock,
      title: "Criptografia",
      items: [
        "TLS 1.3 em todas as conexões de rede",
        "Dados em repouso criptografados (AES-256)",
        "Tokens de sessão assinados (JWT RS256) com rotação automática",
      ],
    },
    {
      icon: ShieldCheck,
      title: "Controle de acesso",
      items: [
        "Row-Level Security (RLS) em todas as tabelas sensíveis",
        "Papéis e setores aplicados no servidor — nunca no cliente",
        "MFA TOTP disponível para todos os usuários",
        "Bloqueio de senhas vazadas (HIBP)",
      ],
    },
    {
      icon: DatabaseBackup,
      title: "Backup & continuidade",
      items: [
        "Backups diários automáticos com retenção de 7 dias",
        "Point-in-time recovery disponível na infraestrutura",
        "Replicação multi-AZ no banco gerenciado",
      ],
    },
    {
      icon: KeyRound,
      title: "Segredos & integrações",
      items: [
        "Segredos armazenados fora do código, injetados apenas no runtime do servidor",
        "Webhooks externos validados por assinatura HMAC",
        "Tokens do portal do fornecedor imutáveis após criação",
      ],
    },
    {
      icon: FileText,
      title: "Privacidade (LGPD)",
      items: [
        "Trilhas de auditoria disponíveis aos administradores",
        "Direito ao esquecimento via exclusão de conta",
        "Exportação de dados sob demanda (CSV)",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Voltar
          </Link>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Trust & Security</h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            Esta página descreve os controles de segurança, privacidade e continuidade aplicados ao
            USE MODA PLM. O conteúdo é mantido pela equipe do produto e reflete a configuração atual
            da plataforma — não constitui certificação independente.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10 space-y-8">
        {sections.map((s) => (
          <section key={s.title} className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <s.icon className="size-5 text-primary" />
              <h2 className="font-medium">{s.title}</h2>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {s.items.map((i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <Mail className="size-5 text-primary" />
            <h2 className="font-medium">Relate uma vulnerabilidade</h2>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Encontrou um problema de segurança? Escreva para{" "}
            <a className="text-primary underline" href="mailto:security@usemoda.com">
              security@usemoda.com
            </a>{" "}
            com detalhes reproduzíveis. Não divulgue publicamente até que tenhamos avaliado.
          </p>
        </section>
      </main>
    </div>
  );
}
