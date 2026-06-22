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

// ---- CLIENTES -------------------------------------------------------------

export const usesoftListCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Pagination.parse(i ?? {}))
  .handler(async ({ data }): Promise<UsesoftCustomer[]> => {
    const { usesoftQuery } = await import("@/integrations/usesoft/client.server");
    const where: string[] = [`c.cstatusclien = 'A'`];
    const params: unknown[] = [data.limit, data.offset];
    let p = 3;
    if (data.search) {
      where.push(
        `(LOWER(c.cnomeclien) LIKE LOWER($${p}) OR LOWER(COALESCE(c.cnfantaclien,'')) LIKE LOWER($${p}) OR COALESCE(c.ccnpjclien,'') LIKE $${p} OR COALESCE(c.ccpfclien,'') LIKE $${p})`,
      );
      params.push(`%${data.search}%`);
      p++;
    }
    const r = await usesoftQuery(
      `SELECT c.nnumeroclien, c.ccodigoclien, c.cnomeclien, c.cnfantaclien,
              c.ctipopeclien, c.ccnpjclien, c.ccpfclien,
              c.cemailnfecli, c.cendwebclien, c.cfoneclien, c.cstatusclien
         FROM solclien c
         WHERE ${where.join(" AND ")}
         ORDER BY c.cnomeclien
         LIMIT $1 OFFSET $2`,
      params,
    );
    return r.rows.map((row) => ({
      id: Number(row.nnumeroclien),
      codigo: s(row.ccodigoclien),
      nome: String(row.cnomeclien),
      nomeFantasia: s(row.cnfantaclien),
      documento:
        row.ctipopeclien === "J" ? s(row.ccnpjclien) : s(row.ccpfclien),
      email: s(row.cemailnfecli) ?? s(row.cendwebclien),
      telefone: s(row.cfoneclien),
      cidade: null,
      uf: null,
      status: row.cstatusclien === "A" ? "ativo" : "inativo",
    }));
  });

// ---- FORNECEDORES ---------------------------------------------------------

export const usesoftListSuppliers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Pagination.parse(i ?? {}))
  .handler(async ({ data }): Promise<UsesoftSupplier[]> => {
    const { usesoftQuery } = await import("@/integrations/usesoft/client.server");
    const where: string[] = [`f.cstatusforne = 'A'`];
    const params: unknown[] = [data.limit, data.offset];
    let p = 3;
    if (data.search) {
      where.push(
        `(LOWER(f.cnomeforne) LIKE LOWER($${p}) OR LOWER(COALESCE(f.cnfantaforne,'')) LIKE LOWER($${p}) OR COALESCE(f.ccnpjforne,'') LIKE $${p})`,
      );
      params.push(`%${data.search}%`);
      p++;
    }
    const r = await usesoftQuery(
      `SELECT f.nnumeroforne, f.ccodigoforne, f.cnomeforne, f.cnfantaforne,
              f.ctipopeforne, f.ccnpjforne, f.ccpfforne,
              f.cemailforne, f.cendwebforne, f.cfoneforne, f.cstatusforne
         FROM solforne f
         WHERE ${where.join(" AND ")}
         ORDER BY f.cnomeforne
         LIMIT $1 OFFSET $2`,
      params,
    );
    return r.rows.map((row) => ({
      id: Number(row.nnumeroforne),
      codigo: s(row.ccodigoforne),
      nome: String(row.cnomeforne),
      nomeFantasia: s(row.cnfantaforne),
      documento:
        row.ctipopeforne === "J" ? s(row.ccnpjforne) : s(row.ccpfforne),
      email: s(row.cemailforne),
      telefone: s(row.cfoneforne),
      cidade: null,
      uf: null,
      status: row.cstatusforne === "A" ? "ativo" : "inativo",
    }));
  });

// ---- VENDAS (Pedidos) -----------------------------------------------------

const SalesInput = Pagination.extend({
  daysBack: z.number().int().min(1).max(3650).optional().default(90),
});

const statusPedidoLabel: Record<string, string> = {
  A: "Aberto",
  L: "Liberado",
  F: "Faturado",
  C: "Cancelado",
  P: "Pendente",
  R: "Reservado",
  G: "Gerado",
  N: "Novo",
};

export const usesoftListSales = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SalesInput.parse(i ?? {}))
  .handler(async ({ data }): Promise<UsesoftSale[]> => {
    const { usesoftQuery } = await import("@/integrations/usesoft/client.server");
    const where: string[] = [
      `p.ddatapedid >= (CURRENT_DATE - ($3::int || ' days')::interval)`,
    ];
    const params: unknown[] = [data.limit, data.offset, data.daysBack];
    let pi = 4;
    if (data.search) {
      where.push(
        `(LOWER(COALESCE(p.cnomecliente,'')) LIKE LOWER($${pi}) OR LOWER(COALESCE(c.cnomeclien,'')) LIKE LOWER($${pi}))`,
      );
      params.push(`%${data.search}%`);
      pi++;
    }
    const r = await usesoftQuery(
      `SELECT p.nnumeropedid, p.ddatapedid, p.cstatuspedid, p.nvalorpedid,
              p.nnumeroclien, p.nnumerorepre,
              COALESCE(NULLIF(TRIM(p.cnomecliente),''), c.cnomeclien) AS cliente_nome,
              (SELECT COUNT(*) FROM solitped i WHERE i.nnumeropedid = p.nnumeropedid) AS qtd_itens
         FROM solpedid p
         LEFT JOIN solclien c ON c.nnumeroclien = p.nnumeroclien
         WHERE ${where.join(" AND ")}
         ORDER BY p.ddatapedid DESC NULLS LAST
         LIMIT $1 OFFSET $2`,
      params,
    );
    return r.rows.map((row) => {
      const st = String(row.cstatuspedid ?? "").trim();
      return {
        pedidoId: Number(row.nnumeropedid),
        numero: String(row.nnumeropedid),
        data: row.ddatapedid ? new Date(row.ddatapedid).toISOString() : null,
        clienteId: row.nnumeroclien == null ? null : Number(row.nnumeroclien),
        clienteNome: s(row.cliente_nome),
        vendedorId: row.nnumerorepre == null ? null : Number(row.nnumerorepre),
        valorTotal: n(row.nvalorpedid),
        quantidadeItens: Number(row.qtd_itens ?? 0),
        status: statusPedidoLabel[st] ?? st ?? null,
      };
    });
  });

// ---- COMPRAS (Pedido de Compra) -------------------------------------------

const statusCompraLabel: Record<string, string> = {
  A: "Aberto",
  F: "Faturado",
  G: "Gerado",
  N: "Novo",
  C: "Cancelado",
  P: "Pendente",
  R: "Recebido",
};

export const usesoftListPurchases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    Pagination.extend({
      daysBack: z.number().int().min(1).max(3650).optional().default(180),
    }).parse(i ?? {}),
  )
  .handler(async ({ data }): Promise<UsesoftPurchase[]> => {
    const { usesoftQuery } = await import("@/integrations/usesoft/client.server");
    const where: string[] = [
      `p.ddatapedcom >= (CURRENT_DATE - ($3::int || ' days')::interval)`,
    ];
    const params: unknown[] = [data.limit, data.offset, data.daysBack];
    let pi = 4;
    if (data.search) {
      where.push(`LOWER(COALESCE(f.cnomeforne,'')) LIKE LOWER($${pi})`);
      params.push(`%${data.search}%`);
      pi++;
    }
    const r = await usesoftQuery(
      `SELECT p.nnumeropedcom, p.ddatapedcom, p.cstatuspedcom, p.nvltotpedcom,
              p.nnumeroforne, f.cnomeforne
         FROM solpedcom p
         LEFT JOIN solforne f ON f.nnumeroforne = p.nnumeroforne
         WHERE ${where.join(" AND ")}
         ORDER BY p.ddatapedcom DESC NULLS LAST
         LIMIT $1 OFFSET $2`,
      params,
    );
    return r.rows.map((row) => {
      const st = String(row.cstatuspedcom ?? "").trim();
      return {
        pedidoId: Number(row.nnumeropedcom),
        numero: String(row.nnumeropedcom),
        data: row.ddatapedcom ? new Date(row.ddatapedcom).toISOString() : null,
        fornecedorId:
          row.nnumeroforne == null ? null : Number(row.nnumeroforne),
        fornecedorNome: s(row.cnomeforne),
        valorTotal: n(row.nvltotpedcom),
        status: statusCompraLabel[st] ?? st ?? null,
      };
    });
  });

// ---- ESTOQUE --------------------------------------------------------------

export const usesoftListInventory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    Pagination.extend({
      onlyWithBalance: z.boolean().optional().default(true),
    }).parse(i ?? {}),
  )
  .handler(async ({ data }): Promise<UsesoftInventory[]> => {
    const { usesoftQuery } = await import("@/integrations/usesoft/client.server");
    const where: string[] = [];
    const params: unknown[] = [data.limit, data.offset];
    let pi = 3;
    if (data.onlyWithBalance) where.push(`saldo.total > 0`);
    if (data.search) {
      where.push(
        `(LOWER(p.cnomeprodu) LIKE LOWER($${pi}) OR LOWER(COALESCE(p.ccodigoprodu,'')) LIKE LOWER($${pi}))`,
      );
      params.push(`%${data.search}%`);
      pi++;
    }
    const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
    const r = await usesoftQuery(
      `WITH saldo AS (
         SELECT nnumeroprodu, SUM(nsaldosaldo) AS total
           FROM estsaldo
          GROUP BY nnumeroprodu
       )
       SELECT p.nnumeroprodu, p.ccodigoprodu, p.cnomeprodu,
              COALESCE(saldo.total, 0) AS saldo_total,
              p.ncustoprodu, p.nprcvenprodu, p.nnumerogrife
         FROM solprodu p
         LEFT JOIN saldo ON saldo.nnumeroprodu = p.nnumeroprodu
         ${whereSql}
         ORDER BY saldo.total DESC NULLS LAST, p.cnomeprodu
         LIMIT $1 OFFSET $2`,
      params,
    );
    return r.rows.map((row) => ({
      produtoId: Number(row.nnumeroprodu),
      codigo: s(row.ccodigoprodu),
      nome: String(row.cnomeprodu),
      saldo: n(row.saldo_total),
      custoMedio: row.ncustoprodu == null ? null : n(row.ncustoprodu),
      precoVenda: row.nprcvenprodu == null ? null : n(row.nprcvenprodu),
      grifeId: row.nnumerogrife == null ? null : Number(row.nnumerogrife),
    }));
  });

// ---- KPI GLOBAL -----------------------------------------------------------

export const usesoftKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { usesoftQuery } = await import("@/integrations/usesoft/client.server");
    const r = await usesoftQuery<{
      colecoes: string;
      produtos: string;
      clientes: string;
      fornecedores: string;
      pedidos_30d: string;
      compras_30d: string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM solgrife)::text AS colecoes,
         (SELECT COUNT(*) FROM solprodu WHERE cstatusprodu='A')::text AS produtos,
         (SELECT COUNT(*) FROM solclien WHERE cstatusclien='A')::text AS clientes,
         (SELECT COUNT(*) FROM solforne WHERE cstatusforne='A')::text AS fornecedores,
         (SELECT COUNT(*) FROM solpedid WHERE ddatapedid >= CURRENT_DATE - INTERVAL '30 days')::text AS pedidos_30d,
         (SELECT COUNT(*) FROM solpedcom WHERE ddatapedcom >= CURRENT_DATE - INTERVAL '30 days')::text AS compras_30d`,
    );
    const row = r.rows[0];
    return {
      colecoes: Number(row?.colecoes ?? 0),
      produtos: Number(row?.produtos ?? 0),
      clientes: Number(row?.clientes ?? 0),
      fornecedores: Number(row?.fornecedores ?? 0),
      pedidos30d: Number(row?.pedidos_30d ?? 0),
      compras30d: Number(row?.compras_30d ?? 0),
    };
  });
