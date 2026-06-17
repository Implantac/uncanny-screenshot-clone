// Lógica pura de filtro da Central de Alertas — extraída para teste.
export type Cat = "all" | "estoque" | "atraso" | "parado" | "proto" | "comentario" | "marketing";

export const CAT_LABEL: Record<Cat, string> = {
  all: "Tudo",
  estoque: "Estoque",
  atraso: "Atraso",
  parado: "Parado",
  proto: "Protótipo",
  comentario: "Comentários",
  marketing: "Marketing",
};

export const CATEGORIES: Cat[] = ["all", "estoque", "atraso", "parado", "proto", "comentario", "marketing"];

/** True se a seção `k` deve renderizar quando o chip selecionado é `cat`. */
export function show(cat: Cat, k: Exclude<Cat, "all">): boolean {
  return cat === "all" || cat === k;
}

export type Counts = Record<Exclude<Cat, "all">, number>;

export function computeCounts(c: Counts): Record<Cat, number> {
  const total = c.estoque + c.atraso + c.parado + c.proto + c.comentario + c.marketing;
  return { all: total, ...c };
}
