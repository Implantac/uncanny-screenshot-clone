import { describe, it, expect } from "vitest";
import { fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { intelFilter } from "./intel-filter";

const INTEL_TABS = [
  "production", "kanban", "dev", "score", "restock",
  "sales", "geo", "influencers", "lake",
] as const;
const schema = z.object({
  tab: fallback(z.enum(INTEL_TABS), "production").default("production"),
  q: fallback(z.string().trim().max(80), "").default(""),
});

function parseUrl(url: string) {
  const u = new URL(url, "http://localhost");
  const raw: Record<string, unknown> = {};
  u.searchParams.forEach((v, k) => (raw[k] = v));
  return schema.parse(raw);
}

// Synthetic data covering each filterable tab
const products = [
  { id: "p1", name: "Vestido Solaris", sku: "VST-001", category: "vestido" },
  { id: "p2", name: "Calça Alfaiataria", sku: "CAL-002", category: "calça" },
];
const orders = [
  { id: "o1", code: "OP-0001", notes: "vestido urgente", product_id: "p1" },
  { id: "o2", code: "OP-0002", notes: "calça", product_id: "p2" },
];
const prototypes = [
  { id: "pt1", code: "PT-VST-1", notes: "vestido leve" },
  { id: "pt2", code: "PT-CAL-1", notes: "alfaiataria" },
];
const campaigns = [
  { id: "c1", name: "Vestido Verão", channel: "instagram" },
  { id: "c2", name: "Outono Onyx", channel: "tiktok" },
];

describe("intelligence URL search restore", () => {
  it("restaura tab=score & q=vestido a partir da URL", () => {
    const s = parseUrl("/intelligence?tab=score&q=vestido");
    expect(s.tab).toBe("score");
    expect(s.q).toBe("vestido");
  });

  it("faz fallback para production quando tab é inválida", () => {
    const s = parseUrl("/intelligence?tab=banana&q=vestido");
    expect(s.tab).toBe("production");
    expect(s.q).toBe("vestido");
  });

  it("faz fallback para q vazio quando q excede 80 chars", () => {
    const s = parseUrl(`/intelligence?q=${"x".repeat(200)}`);
    expect(s.q).toBe("");
  });

  it("filtra produtos por nome/sku/category em score/restock/sales", () => {
    const r = intelFilter(products, "vestido", ["name", "sku", "category"]);
    expect(r.map((p) => p.id)).toEqual(["p1"]);
  });

  it("filtra ordens por código/notes + nome do produto via lookup (kanban)", () => {
    expect(intelFilter(orders, "OP-0002", ["code", "notes"], products).map((o) => o.id))
      .toEqual(["o2"]);
    expect(intelFilter(orders, "Solaris", ["code", "notes"], products).map((o) => o.id))
      .toEqual(["o1"]);
  });

  it("filtra protótipos por code/notes (dev)", () => {
    expect(intelFilter(prototypes, "vestido", ["code", "notes"]).map((p) => p.id))
      .toEqual(["pt1"]);
  });

  it("filtra campanhas por name/channel (atribuição)", () => {
    expect(intelFilter(campaigns, "tiktok", ["name", "channel"]).map((c) => c.id))
      .toEqual(["c2"]);
  });

  it("q vazio devolve a lista intacta", () => {
    expect(intelFilter(products, "", ["name"]).length).toBe(products.length);
    expect(intelFilter(products, "   ", ["name"]).length).toBe(products.length);
  });
});
