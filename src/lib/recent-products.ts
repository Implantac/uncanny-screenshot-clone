// Wave 30 — Recentes: registro local de produtos vistos recentemente
// Wave 32 — Pinned: curadoria manual de produtos favoritos
const KEY = "plm.recent.products.v1";
const PIN_KEY = "plm.pinned.products.v1";
const MAX = 8;
const MAX_PIN = 12;

export type RecentProduct = { id: string; sku: string; name: string; at: number };
export type PinnedProduct = { id: string; sku: string; name: string; at: number };

export function pushRecentProduct(p: Omit<RecentProduct, "at">) {
  if (typeof window === "undefined" || !p?.id) return;
  try {
    const raw = window.localStorage.getItem(KEY);
    const list: RecentProduct[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((x) => x.id !== p.id);
    filtered.unshift({ ...p, at: Date.now() });
    window.localStorage.setItem(KEY, JSON.stringify(filtered.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export function getRecentProducts(): RecentProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentProduct[]) : [];
  } catch {
    return [];
  }
}

export function getPinnedProducts(): PinnedProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PIN_KEY);
    return raw ? (JSON.parse(raw) as PinnedProduct[]) : [];
  } catch {
    return [];
  }
}

export function isPinned(id: string): boolean {
  return getPinnedProducts().some((p) => p.id === id);
}

export function togglePinnedProduct(p: Omit<PinnedProduct, "at">): boolean {
  if (typeof window === "undefined" || !p?.id) return false;
  try {
    const list = getPinnedProducts();
    const exists = list.some((x) => x.id === p.id);
    const next = exists
      ? list.filter((x) => x.id !== p.id)
      : [{ ...p, at: Date.now() }, ...list].slice(0, MAX_PIN);
    window.localStorage.setItem(PIN_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("plm:pinned-changed"));
    return !exists;
  } catch {
    return false;
  }
}
