/**
 * RBAC — Matriz de permissões por role para o módulo Ficha Técnica.
 *
 * As roles são armazenadas em `user_roles` (enum `app_role`):
 *   admin, gerente, designer, comprador, vendedor.
 *
 * Cada usuário pode ter múltiplas roles. A permissão é concedida se QUALQUER
 * role do usuário permitir o módulo.
 *
 * Matriz (alinhada ao PLANO-MELHORIAS-POS-REVISAO.md §3.2):
 * | Role       | Rascunho | Medidas | Materiais | Custos | Aprovar |
 * |------------|----------|---------|-----------|--------|---------|
 * | admin      | ✅       | ✅      | ✅        | ✅     | ✅      |
 * | gerente    | ✅       | ✅      | ✅        | ✅     | ✅      |
 * | designer   | ✅       | ✅      | ✅        | ✅     | ❌      |
 * | comprador  | ❌       | ❌      | ✅        | ❌     | ❌      |
 * | vendedor   | ❌       | ❌      | ❌        | ❌     | ❌ (leitura) |
 */

export type UserRole = "admin" | "gerente" | "designer" | "comprador" | "vendedor";

export type ModuleKey =
  | "draft" // editar dados gerais / observações / blocos
  | "measurements" // POM · medidas
  | "materials" // BOM · materiais
  | "costs" // custos / overhead
  | "approve"; // aprovar ficha

export const USER_ROLES: UserRole[] = [
  "admin",
  "gerente",
  "designer",
  "comprador",
  "vendedor",
];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  gerente: "Gerente",
  designer: "Designer",
  comprador: "Comprador",
  vendedor: "Vendedor",
};

/** Matriz de permissões: role → módulos que pode editar. */
const CAN_EDIT: Record<UserRole, ReadonlySet<ModuleKey>> = {
  admin: new Set(["draft", "measurements", "materials", "costs", "approve"]),
  gerente: new Set(["draft", "measurements", "materials", "costs", "approve"]),
  designer: new Set(["draft", "measurements", "materials", "costs"]),
  comprador: new Set(["materials"]),
  vendedor: new Set([]),
};

function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" && (USER_ROLES as readonly string[]).includes(value)
  );
}

/** Normaliza roles vindas do banco (filtra valores inválidos e duplicados). */
export function normalizeRoles(roles: readonly unknown[] | undefined | null): UserRole[] {
  if (!Array.isArray(roles)) return [];
  return Array.from(new Set(roles.filter(isUserRole)));
}

/**
 * Verifica se o usuário pode editar um módulo da ficha técnica,
 * considerando TODAS as suas roles.
 */
export function canEditModule(roles: readonly unknown[], module: ModuleKey): boolean {
  const normalized = normalizeRoles(roles);
  return normalized.some((role) => CAN_EDIT[role].has(module));
}

/** Shorthands para uso direto nos componentes. */
export const canEditDraft = (roles: readonly unknown[]) => canEditModule(roles, "draft");
export const canEditMeasurements = (roles: readonly unknown[]) =>
  canEditModule(roles, "measurements");
export const canEditMaterials = (roles: readonly unknown[]) => canEditModule(roles, "materials");
export const canEditCosts = (roles: readonly unknown[]) => canEditModule(roles, "costs");
/** Aprovação é restrita a admin/gerente (e a quem tem a role). */
export const canApproveSheet = (roles: readonly unknown[]) => canEditModule(roles, "approve");
