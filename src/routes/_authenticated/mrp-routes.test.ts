import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Garante que /mrp, /mrp/executivo e /mrp/bi são rotas-folha independentes,
 * sem layout pai compartilhado, e que cada uma renderiza um componente distinto.
 *
 * Regressão evitada: quando existia `_app.mrp.tsx` (não-index), o TanStack Router
 * tratava o arquivo como layout pai de `/mrp/executivo` e `/mrp/bi`. Como esse
 * "layout" não renderizava `<Outlet />`, as três URLs mostravam a mesma tela.
 */

const ROUTES_DIR = resolve(__dirname);

describe("MRP routes — independência e layout não-compartilhado", () => {
  it("não existe `_app.mrp.tsx` agindo como layout pai", () => {
    // Se este arquivo voltar a existir (sem `.index`), ele vira layout das rotas
    // filhas e quebra a navegação. Precisa ser sempre `_app.mrp.index.tsx`.
    expect(existsSync(resolve(ROUTES_DIR, "_app.mrp.tsx"))).toBe(false);
  });

  it("as três rotas existem como arquivos-folha irmãos", () => {
    expect(existsSync(resolve(ROUTES_DIR, "_app.mrp.index.tsx"))).toBe(true);
    expect(existsSync(resolve(ROUTES_DIR, "_app.mrp.executivo.tsx"))).toBe(true);
    expect(existsSync(resolve(ROUTES_DIR, "_app.mrp.bi.tsx"))).toBe(true);
  });

  it("cada rota declara seu próprio path em createFileRoute", () => {
    const idx = readFileSync(resolve(ROUTES_DIR, "_app.mrp.index.tsx"), "utf8");
    const exec = readFileSync(resolve(ROUTES_DIR, "_app.mrp.executivo.tsx"), "utf8");
    const bi = readFileSync(resolve(ROUTES_DIR, "_app.mrp.bi.tsx"), "utf8");

    expect(idx).toMatch(/createFileRoute\(["']\/_authenticated\/_app\/mrp\/["']\)/);
    expect(exec).toMatch(/createFileRoute\(["']\/_authenticated\/_app\/mrp\/executivo["']\)/);
    expect(bi).toMatch(/createFileRoute\(["']\/_authenticated\/_app\/mrp\/bi["']\)/);
  });

  it("cada rota expõe um componente próprio com nome distinto", () => {
    const idx = readFileSync(resolve(ROUTES_DIR, "_app.mrp.index.tsx"), "utf8");
    const exec = readFileSync(resolve(ROUTES_DIR, "_app.mrp.executivo.tsx"), "utf8");
    const bi = readFileSync(resolve(ROUTES_DIR, "_app.mrp.bi.tsx"), "utf8");

    const pick = (src: string) => src.match(/component:\s*([A-Z][A-Za-z0-9_]+)/)?.[1];
    const names = [pick(idx), pick(exec), pick(bi)];

    expect(names.every(Boolean)).toBe(true);
    expect(new Set(names).size).toBe(3); // três nomes únicos
  });

  it("nenhuma rota-folha de MRP renderiza <Outlet /> (sinal de layout pai indevido)", () => {
    for (const f of ["_app.mrp.index.tsx", "_app.mrp.executivo.tsx", "_app.mrp.bi.tsx"]) {
      const src = readFileSync(resolve(ROUTES_DIR, f), "utf8");
      expect(src, `${f} não deve conter <Outlet />`).not.toMatch(/<Outlet\s*\/?>/);
    }
  });

  it("routeTree.gen.ts registra as três rotas como entradas distintas", () => {
    const tree = readFileSync(resolve(ROUTES_DIR, "..", "..", "routeTree.gen.ts"), "utf8");
    expect(tree).toContain("AuthenticatedAppMrpIndexRoute");
    expect(tree).toContain("AuthenticatedAppMrpExecutivoRoute");
    expect(tree).toContain("AuthenticatedAppMrpBiRoute");
    // paths irmãos, não aninhados
    expect(tree).toMatch(/path:\s*['"]\/mrp\/['"]/);
    expect(tree).toMatch(/path:\s*['"]\/mrp\/executivo['"]/);
    expect(tree).toMatch(/path:\s*['"]\/mrp\/bi['"]/);
  });
});
