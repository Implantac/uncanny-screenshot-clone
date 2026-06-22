/**
 * Cliente READ-ONLY do ERP Usesoft (PostgreSQL).
 *
 * REGRA DE OURO: este arquivo NUNCA escreve no Usesoft.
 * Três camadas de proteção:
 *  1. Pool com `default_transaction_read_only=on` — Postgres rejeita qualquer
 *     INSERT/UPDATE/DELETE/DDL antes de executar.
 *  2. Helper `query()` valida que o SQL começa com SELECT / WITH.
 *  3. Sem service-role nem migrations apontando pro Usesoft em lugar algum.
 *
 * Server-only: nunca importar de componentes/route loaders públicos.
 */
import { Pool, type QueryResult, type QueryResultRow } from "pg";

let _pool: Pool | undefined;

function getPool(): Pool {
  if (_pool) return _pool;

  const host = process.env.USESOFT_PG_HOST;
  const portRaw = process.env.USESOFT_PG_PORT;
  const database = process.env.USESOFT_PG_DATABASE;
  const user = process.env.USESOFT_PG_USER;
  const password = process.env.USESOFT_PG_PASSWORD;

  if (!host || !portRaw || !database || !user || !password) {
    throw new Error(
      "Usesoft ERP não configurado. Secrets USESOFT_PG_* ausentes no servidor.",
    );
  }

  _pool = new Pool({
    host,
    port: Number(portRaw),
    database,
    user,
    password,
    ssl: false, // servidor não suporta SSL
    max: 4, // pool pequeno; é um ERP terceiro
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 15_000, // mata query > 15s
    query_timeout: 15_000,
    // Sessão inteira em read-only — qualquer escrita estoura no Postgres.
    options: "-c default_transaction_read_only=on",
  });

  return _pool;
}

const READ_ONLY_RE = /^\s*(--[^\n]*\n|\/\*[\s\S]*?\*\/|\s)*\s*(select|with)\b/i;

/**
 * Executa SELECT no Usesoft. Lança se a query não for read-only.
 */
export async function usesoftQuery<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  if (!READ_ONLY_RE.test(sql)) {
    throw new Error("usesoftQuery aceita apenas SELECT/WITH (read-only).");
  }
  const pool = getPool();
  return pool.query<T>(sql, params as unknown[]);
}

/**
 * Healthcheck simples.
 */
export async function usesoftPing(): Promise<{
  ok: boolean;
  version?: string;
  latency_ms?: number;
  error?: string;
}> {
  const t0 = Date.now();
  try {
    const r = await usesoftQuery<{ version: string }>("SELECT version()");
    return { ok: true, version: r.rows[0]?.version, latency_ms: Date.now() - t0 };
  } catch (e) {
    const error = (e as Error).message;
    return {
      ok: false,
      error: error.includes("ENOTFOUND")
        ? "Host do ERP não resolvido. Verifique as credenciais USESOFT_PG_* no backend."
        : error,
      latency_ms: Date.now() - t0,
    };
  }
}
