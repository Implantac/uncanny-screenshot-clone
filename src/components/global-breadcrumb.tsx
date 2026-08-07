import { useRouterState } from "@tanstack/react-router";
import { Home } from "lucide-react";
import { MODULES, type ModuleDef } from "@/lib/modules";
import { PlmBreadcrumb, type PlmBreadcrumbItem } from "@/components/ui/plm-breadcrumb";

/**
 * Encontra o módulo pai de uma rota, mesmo em rotas dinâmicas filhas.
 * Handles:
 *   - Exact match: "/produtos" → Produtos
 *   - Direct child: "/produtos/novo" → Produtos
 *   - Singular/plural mismatch: "/produto/123" → Produtos (remove 's')
 */
function findParentModule(path: string): ModuleDef | undefined {
  // 1. Exact match
  const exact = MODULES.find((m) => m.path === path);
  if (exact) return exact;

  // 2. Direct startsWith (path + "/" ensures we match child routes, not prefixes)
  const sorted = [...MODULES].sort((a, b) => b.path.length - a.path.length);
  const directChild = sorted.find((m) => m.path !== "/" && path.startsWith(m.path + "/"));
  if (directChild) return directChild;

  // 3. Singular/plural mapping: "/produto/123" → "/produtos" (remove trailing 's')
  const singularMap = sorted.find((m) => {
    if (m.path === "/" || !m.path.endsWith("s")) return false;
    const singular = m.path.slice(0, -1);
    return path.startsWith(singular + "/");
  });
  if (singularMap) return singularMap;

  return undefined;
}

/**
 * Global PLM Breadcrumbs.
 * Shows "Home › Group › Module" on every registered top-level module.
 * Also shows breadcrumb on dynamic/detail routes by matching the parent module.
 * Uses PlmBreadcrumb for consistent icon resolution and styling.
 */
export function GlobalBreadcrumb() {
  const { location } = useRouterState();
  const path = location.pathname;

  if (path === "/" || path === "/auth" || path === "/trust") return null;

  const mod = findParentModule(path);

  if (!mod) return null;

  const items: PlmBreadcrumbItem[] = [
    { label: "Início", link: { to: "/" }, icon: Home },
  ];

  if (mod.group) {
    items.push({ label: mod.group });
  }

  // If it's a detail page, add parent module link + current page label
  if (path !== mod.path) {
    items.push({ label: mod.title, icon: mod.icon, link: { to: mod.path as never } });
    // Extract the last segment as the detail label
    const segments = path.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    if (lastSegment && lastSegment.length > 8) {
      items.push({ label: `${mod.title} — ${lastSegment.slice(0, 8)}…` });
    } else if (lastSegment) {
      items.push({ label: `${mod.title} — ${lastSegment}` });
    }
  } else {
    items.push({ label: mod.title, icon: mod.icon });
  }

  return (
    <div className="px-4 md:px-6 pt-3 pb-1">
      <PlmBreadcrumb items={items} />
    </div>
  );
}
