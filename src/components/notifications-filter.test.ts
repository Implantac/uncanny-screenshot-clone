import { describe, it, expect } from "vitest";
import { show, computeCounts, CATEGORIES, type Cat } from "./notifications-filter";

const SECTIONS: Exclude<Cat, "all">[] = [
  "estoque",
  "atraso",
  "parado",
  "proto",
  "comentario",
  "marketing",
];

describe("notifications-filter · show()", () => {
  it("'all' mostra todas as 6 seções, exatamente uma vez cada", () => {
    const visible = SECTIONS.filter((k) => show("all", k));
    expect(visible).toEqual(SECTIONS);
    expect(new Set(visible).size).toBe(SECTIONS.length);
  });

  it("cada chip específico mostra apenas sua própria seção", () => {
    for (const chip of SECTIONS) {
      const visible = SECTIONS.filter((k) => show(chip, k));
      expect(visible).toEqual([chip]);
    }
  });

  it("nunca duplica: para qualquer chip, cada seção aparece no máximo 1 vez", () => {
    for (const chip of CATEGORIES) {
      const visible = SECTIONS.filter((k) => show(chip, k));
      expect(visible.length).toBe(new Set(visible).size);
    }
  });

  it("nenhuma seção fica órfã: alternando chips, toda seção é visível em pelo menos um estado", () => {
    const seen = new Set<string>();
    for (const chip of CATEGORIES) {
      SECTIONS.filter((k) => show(chip, k)).forEach((k) => seen.add(k));
    }
    expect([...seen].sort()).toEqual([...SECTIONS].sort());
  });
});

describe("notifications-filter · computeCounts()", () => {
  it("'all' é a soma das categorias", () => {
    const c = computeCounts({
      estoque: 1,
      atraso: 2,
      parado: 3,
      proto: 4,
      comentario: 5,
      marketing: 6,
    });
    expect(c.all).toBe(21);
    expect(c.estoque).toBe(1);
    expect(c.marketing).toBe(6);
  });

  it("zero em tudo → all=0", () => {
    const c = computeCounts({
      estoque: 0,
      atraso: 0,
      parado: 0,
      proto: 0,
      comentario: 0,
      marketing: 0,
    });
    expect(c.all).toBe(0);
  });
});
