import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Users, Lock } from "lucide-react";
import { toast } from "sonner";
import { listTeam, setUserRole } from "@/lib/team.functions";
import { useRoles } from "@/hooks/use-role";

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
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["team"],
    queryFn: () => fetchTeam(),
    enabled: isAdmin,
  });

  const m = useMutation({
    mutationFn: (vars: { userId: string; role: (typeof ROLES)[number]; enabled: boolean }) =>
      mutateRole({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team"] });
      toast.success("Permissões atualizadas");
    },
    onError: (e: any) => toast.error(e.message || "Falha ao atualizar"),
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
          <Users className="size-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Equipe & Permissões</h1>
          <p className="text-xs text-muted-foreground">Atribua papéis aos usuários da plataforma</p>
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Usuário</th>
              {ROLES.map((r) => (
                <th key={r} className="px-2 py-3 text-center">{ROLE_LABEL[r]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={ROLES.length + 1} className="text-center py-8 text-muted-foreground">Carregando…</td></tr>
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
                {ROLES.map((r) => {
                  const checked = u.roles.includes(r);
                  return (
                    <td key={r} className="px-2 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={m.isPending}
                        onChange={(e) => m.mutate({ userId: u.id, role: r, enabled: e.target.checked })}
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
        <p>Papéis são verificados no servidor via <code>has_role()</code>. Mudanças aplicam imediatamente. Novos usuários recebem <strong>designer</strong> por padrão.</p>
      </div>
    </div>
  );
}
