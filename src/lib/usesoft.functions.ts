/**
 * Server functions de LEITURA do ERP Usesoft.
 *
 * Todas usam `usesoftQuery()` — read-only por construção.
 * Mapeamento de campos Hungarian-notation do Usesoft → DTO em camelCase pt-BR
 * usado pelo Use Moda PLM.
 *
 * Convenção Usesoft:
 *   sol*     = tabelas principais (sol = Solidor)
 *   nnumero* = PK numérica
 *   c*       = string/character
 *   d*       = data/timestamp
 *   n*       = numeric
 *
 * Mapas conhecidos:
 *   solgrife (Grife) ........ COLEÇÃO no Use Moda
 *   solprodu ................ Produto
 *   solclien ................ Cliente
 *   solforne ................ Fornecedor
 *   solpedid + solitped ..... Pedido + itens (venda)
 *   solpedcom ............... Pedido de compra
 *   solcores ................ Cores
 *   solunida ................ Unidades
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---- Tipos DTO (camelCase, pt-BR) ----------------------------------------

export type UsesoftCollection = {
  id: number;
  nome: string;
  status: "ativa" | "inativa";
  visivelEcommerce: boolean;
  ecommerceId: string | null;
};

export type UsesoftProduct = {
  id: number;
  codigo: string | null;
  ean: string | null;
  nome: string;
  nomeReduzido: string | null;
  nomeComercial: string | null;
  referencia: string | null;
  status: string;
  custo: number;
  precoVenda: number;
  pesoLiquido: number | null;
  pesoBruto: number | null;
  origem: string;
  grifeId: number | null;
  grifeNome: string | null;
  marcaId: number | null;
  marcaNome: string | null;
  unidadeId: number | null;
  unidadeNome: string | null;
  categoriaId: number | null;
  subcategoriaId: number | null;
  classeId: number | null;
  coresId: number | null;
  ncm: string | null;
  criadoEm: string | null;
  alteradoEm: string | null;
  descricaoComercial: string | null;
};

export type UsesoftCustomer = {
  id: number;
  codigo: string | null;
  nome: string;
  nomeFantasia: string | null;
  documento: string | null; // CNPJ/CPF
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  uf: string | null;
  status: string;
};

export type UsesoftSupplier = {
  id: number;
  codigo: string | null;
  nome: string;
  nomeFantasia: string | null;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  uf: string | null;
  status: string;
};

export type UsesoftSale = {
  pedidoId: number;
  numero: string | null;
  data: string | null;
  clienteId: number | null;
  clienteNome: string | null;
  vendedorId: number | null;
  valorTotal: number;
  quantidadeItens: number;
  status: string | null;
};

export type UsesoftInventory = {
  produtoId: number;
  codigo: string | null;
  nome: string;
  saldo: number;
  custoMedio: number | null;
  precoVenda: number | null;
  grifeId: number | null;
};

export type UsesoftPurchase = {
  pedidoId: number;
  numero: string | null;
  data: string | null;
  fornecedorId: number | null;
  fornecedorNome: string | null;
  valorTotal: number;
  status: string | null;
};

// ---- Helpers --------------------------------------------------------------

const Pagination = z.object({
  limit: z.number().int().min(1).max(500).optional().default(100),
  offset: z.number().int().min(0).optional().default(0),
  search: z.string().max(200).optional().default(""),
});

function n(v: unknown): number {
  if (v == null) return 0;
  const x = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(x) ? x : 0;
}
function s(v: unknown): string | null {
  if (v == null) return null;
  const x = String(v).trim();
  return x.length ? x : null;
}

// ---- Healthcheck ----------------------------------------------------------

export const usesoftHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { usesoftPing } = await import("@/integrations/usesoft/client.server");
    return usesoftPing();
  });

// ---- COLEÇÕES (Grifes) ----------------------------------------------------

export const usesoftListCollections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Pagination.parse(i ?? {}))
  .handler(async ({ data }): Promise<UsesoftCollection[]> => {
    const { usesoftQuery } = await import("@/integrations/usesoft/client.server");
    const where = data.search
      ? "WHERE LOWER(g.cdescrigrife) LIKE LOWER($3)"
      : "";
    const params: unknown[] = [data.limit, data.offset];
    if (data.search) params.push(`%${data.search}%`);

    const r = await usesoftQuery(
      `SELECT g.nnumerogrife, g.cdescrigrife, g.cstatusgrife,
              g.cviscommercegr, g.ecomm_id
         FROM solgrife g
         ${where}
         ORDER BY g.cdescrigrife
         LIMIT $1 OFFSET $2`,
      params,
    );
    return r.rows.map((row) => ({
      id: Number(row.nnumerogrife),
      nome: String(row.cdescrigrife),
      status: row.cstatusgrife === "A" ? "ativa" : "inativa",
      visivelEcommerce: row.cviscommercegr === "S",
      ecommerceId: s(row.ecomm_id),
    }));
  });

export const usesoftCountCollections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { usesoftQuery } = await import("@/integrations/usesoft/client.server");
    const r = await usesoftQuery<{ total: string }>(
      "SELECT COUNT(*)::text AS total FROM solgrife",
    );
    return { total: Number(r.rows[0]?.total ?? 0) };
  });

// ---- PRODUTOS -------------------------------------------------------------

export const usesoftListProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    Pagination.extend({
      grifeId: z.number().int().optional(),
      onlyActive: z.boolean().optional().default(true),
    }).parse(i ?? {}),
  )
  .handler(async ({ data }): Promise<UsesoftProduct[]> => {
    const { usesoftQuery } = await import("@/integrations/usesoft/client.server");
    const where: string[] = [];
    const params: unknown[] = [data.limit, data.offset];
    let p = 3;
    if (data.onlyActive) where.push(`p.cstatusprodu = 'A'`);
    if (data.grifeId) {
      where.push(`p.nnumerogrife = $${p++}`);
      params.push(data.grifeId);
    }
    if (data.search) {
      where.push(
        `(LOWER(p.cnomeprodu) LIKE LOWER($${p}) OR LOWER(COALESCE(p.ccodigoprodu,'')) LIKE LOWER($${p}) OR LOWER(COALESCE(p.ceanprodu,'')) LIKE LOWER($${p}))`,
      );
      params.push(`%${data.search}%`);
      p++;
    }
    const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

    const r = await usesoftQuery(
      `SELECT p.nnumeroprodu, p.ccodigoprodu, p.ceanprodu, p.cnomeprodu,
              p.cnomevrprodu, p.cnomcomprodu, p.crefcorprodu,
              p.cstatusprodu, p.ncustoprodu, p.nprcvenprodu,
              p.npesolqprodu, p.npesoprprodu, p.corigemprodu,
              p.nnumerogrife, g.cdescrigrife AS grife_nome,
              p.nnumeromarca, p.nnumerounida, p.nnumerocateg, p.nnumerosubct, p.nnumeroclass,
              p.nnumerocores, p.ncodncmtbncm,
              p.dcadastprodu, p.dalteraprodu, p.cdsccplprodu
         FROM solprodu p
         LEFT JOIN solgrife g ON g.nnumerogrife = p.nnumerogrife
         ${whereSql}
         ORDER BY p.cnomeprodu
         LIMIT $1 OFFSET $2`,
      params,
    );
    return r.rows.map((row) => ({
      id: Number(row.nnumeroprodu),
      codigo: s(row.ccodigoprodu),
      ean: s(row.ceanprodu),
      nome: String(row.cnomeprodu),
      nomeReduzido: s(row.cnomevrprodu),
      nomeComercial: s(row.cnomcomprodu),
      referencia: s(row.crefcorprodu),
      status: String(row.cstatusprodu ?? "A"),
      custo: n(row.ncustoprodu),
      precoVenda: n(row.nprcvenprodu),
      pesoLiquido: row.npesolqprodu == null ? null : n(row.npesolqprodu),
      pesoBruto: row.npesoprprodu == null ? null : n(row.npesoprprodu),
      origem: String(row.corigemprodu ?? "0"),
      grifeId: row.nnumerogrife == null ? null : Number(row.nnumerogrife),
      grifeNome: s(row.grife_nome),
      marcaId: row.nnumeromarca == null ? null : Number(row.nnumeromarca),
      marcaNome: null,
      unidadeId: row.nnumerounida == null ? null : Number(row.nnumerounida),
      unidadeNome: null,
      categoriaId: row.nnumerocateg == null ? null : Number(row.nnumerocateg),
      subcategoriaId: row.nnumerosubct == null ? null : Number(row.nnumerosubct),
      classeId: row.nnumeroclass == null ? null : Number(row.nnumeroclass),
      coresId: row.nnumerocores == null ? null : Number(row.nnumerocores),
      ncm: row.ncodncmtbncm == null ? null : String(row.ncodncmtbncm),
      criadoEm: row.dcadastprodu ? new Date(row.dcadastprodu).toISOString() : null,
      alteradoEm: row.dalteraprodu ? new Date(row.dalteraprodu).toISOString() : null,
      descricaoComercial: s(row.cdsccplprodu),
    }));
  });

export const usesoftCountProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ grifeId: z.number().int().optional(), onlyActive: z.boolean().optional().default(true) })
      .parse(i ?? {}),
  )
  .handler(async ({ data }) => {
    const { usesoftQuery } = await import("@/integrations/usesoft/client.server");
    const where: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    if (data.onlyActive) where.push(`cstatusprodu = 'A'`);
    if (data.grifeId) {
      where.push(`nnumerogrife = $${p++}`);
      params.push(data.grifeId);
    }
    const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
    const r = await usesoftQuery<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM solprodu ${whereSql}`,
      params,
    );
    return { total: Number(r.rows[0]?.total ?? 0) };
  });
