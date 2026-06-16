import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Users, Lock } from "lucide-react";
import { toast } from "sonner";
import { listTeam, setUserRole, setUserSector } from "@/lib/team.functions";
import { useRoles } from "@/hooks/use-role";
import { APP_SECTORS, SECTOR_LABEL, type AppSector } from "@/lib/modules";

export const Route = createFileRoute("/_authenticated/_app/equipe")({
  head: () => ({
    meta: [{ title: "Equipe & Permissões · USE MODA OS" }],
  }),
  component: TeamPage,
});

const ROLES = ["admin", "gerente", "designer", "comprador", "vendedor"] as const;
const ROLE_LABEL: Record<string, string> = {
  admin: "Admin", gerente: "Gerente", designer: "Designer", comprador: "Comprador", vendedor: "Vendedor",
};

function TeamPage() {
  const { isAdmin, loading } = useRoles();
  const fetchTeam = useServerFn(listTeam);
  const mutateRole = useServerFn(setUserRole);
  const mutateSector = useServerFn(setUserSector);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["team"],
    queryFn: () => fetchTeam(),
    enabled: isAdmin,
  });

  const onOk = () => {
    qc.invalidateQueries({ queryKey: ["team"] });
    qc.invalidateQueries({ queryKey: ["user-sectors"] });
    qc.invalidateQueries({ queryKey: ["user-roles"] });
    toast.success("Permissões atualizadas");
  };
  const onErr = (e: any) => toast.error(e.message || "Falha ao atualizar");

  const mRole = useMutation({
    mutationFn: (vars: { userId: string; role: (typeof ROLES)[number]; enabled: boolean }) =>
      mutateRole({ data: vars }),
    onSuccess: onOk,
    onError: onErr,
  });
  const mSector = useMutation({
    mutationFn: (vars: { userId: string; sector: AppSector; enabled: boolean }) =>
      mutateSector({ data: vars }),
    onSuccess: onOk,
    onError: onErr,
  });

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  if (!isAdmin) {
    return (
      <div className="p-8 max-w-xl">
        <div className="glass rounded-2xl p-8 text-center">
          <Lock className="size-10 mx-auto text-muted-foreground mb-3" />
          <h1 className="text-lg font-semibold mb-1">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground">Apenas administradores podem gerenciar a equipe e permissões.</p>
        </div>
      </div>
    );
  }

  const busy = mRole.isPending || mSector.isPending;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
          <Users className="size-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Equipe & Permissões</h1>
          <p className="text-xs text-muted-foreground">Atribua papéis e setores aos usuários da plataforma</p>
        </div>
      </div>

      <div className="glass rounded-2xl overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3" rowSpan={2}>Usuário</th>
              <th className="px-2 py-2 text-center border-l border-border" colSpan={ROLES.length}>Papéis</th>
              <th className="px-2 py-2 text-center border-l border-border" colSpan={APP_SECTORS.length}>Setores (telas)</th>
            </tr>
            <tr>
              {ROLES.map((r, i) => (
                <th key={r} className={`px-2 py-2 text-center ${i === 0 ? "border-l border-border" : ""}`}>{ROLE_LABEL[r]}</th>
              ))}
              {APP_SECTORS.map((s, i) => (
                <th key={s} className={`px-2 py-2 text-center ${i === 0 ? "border-l border-border" : ""}`}>{SECTOR_LABEL[s]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={ROLES.length + APP_SECTORS.length + 1} className="text-center py-8 text-muted-foreground">Carregando…</td></tr>
            )}
            {data?.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-muted grid place-items-center text-xs font-semibold">
                      {(u.fullName ?? "U").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium">{u.fullName ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.id.slice(0, 8)}…</div>
                    </div>
                  </div>
                </td>
                {ROLES.map((r, i) => {
                  const checked = u.roles.includes(r);
                  return (
                    <td key={r} className={`px-2 py-3 text-center ${i === 0 ? "border-l border-border" : ""}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={busy}
                        onChange={(e) => mRole.mutate({ userId: u.id, role: r, enabled: e.target.checked })}
                        className="size-4 accent-primary cursor-pointer"
                      />
                    </td>
                  );
                })}
                {APP_SECTORS.map((s, i) => {
                  const checked = u.sectors.includes(s);
                  return (
                    <td key={s} className={`px-2 py-3 text-center ${i === 0 ? "border-l border-border" : ""}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={busy}
                        onChange={(e) => mSector.mutate({ userId: u.id, sector: s, enabled: e.target.checked })}
                        className="size-4 accent-primary cursor-pointer"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Shield className="size-4 shrink-0 mt-0.5" />
        <p>
          Setores controlam quais <strong>telas</strong> cada usuário enxerga no menu (Marketing, PCP, Desenvolvimento).
          Administradores veem tudo. Demais áreas (Operação, Coleções, Cadeia, Inteligência, ERP, Plataforma) são liberadas
          a todos os usuários autenticados.
        </p>
      </div>
    </div>
  );
}
