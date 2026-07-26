// Wave 48 — Recentes/Fixados de fornecedores (fecha padrão iniciado em Produtos/Coleções)
const KEY = "plm.recent.suppliers.v1";
const PIN_KEY = "plm.pinned.suppliers.v1";
const MAX = 6;
const MAX_PIN = 12;

export type RecentSupplier = {
  id: string;
  name: string;
  category?: string | null;
  at: number;
};

export type PinnedSupplier = RecentSupplier;

export function pushRecentSupplier(s: Omit<RecentSupplier, "at">) {
  if (typeof window === "undefined" || !s?.id) return;
  try {
    const raw = window.localStorage.getItem(KEY);
    const list: RecentSupplier[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((x) => x.id !== s.id);
    filtered.unshift({ ...s, at: Date.now() });
    window.localStorage.setItem(KEY, JSON.stringify(filtered.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export function getRecentSuppliers(): RecentSupplier[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentSupplier[]) : [];
  } catch {
    return [];
  }
}

export function getPinnedSuppliers(): PinnedSupplier[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PIN_KEY);
    return raw ? (JSON.parse(raw) as PinnedSupplier[]) : [];
  } catch {
    return [];
  }
}

export function isSupplierPinned(id: string): boolean {
  return getPinnedSuppliers().some((s) => s.id === id);
}

export function togglePinnedSupplier(s: Omit<PinnedSupplier, "at">): boolean {
  if (typeof window === "undefined" || !s?.id) return false;
  try {
    const list = getPinnedSuppliers();
    const exists = list.some((x) => x.id === s.id);
    const next = exists
      ? list.filter((x) => x.id !== s.id)
      : [{ ...s, at: Date.now() }, ...list].slice(0, MAX_PIN);
    window.localStorage.setItem(PIN_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("plm:pinned-suppliers-changed"));
    return !exists;
  } catch {
    return false;
  }
}
