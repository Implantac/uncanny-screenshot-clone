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

// Hostname válido: IPv4, ou DNS (letras/dígitos/.-), 1–253 chars, sem @ / espaço / aspas.
const HOST_RE = /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const IPV4_RE = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
// Nome de banco Postgres: letras, dígitos e _ (sem @ / espaço / aspas / barra).
const DB_RE = /^[a-zA-Z_][a-zA-Z0-9_$]{0,62}$/;

export class UsesoftConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsesoftConfigError";
  }
}

export function validateUsesoftEnv(): {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
} {
  const host = (process.env.USESOFT_PG_HOST ?? "").trim();
  const portRaw = (process.env.USESOFT_PG_PORT ?? "").trim();
  const database = (process.env.USESOFT_PG_DATABASE ?? "").trim();
  const user = (process.env.USESOFT_PG_USER ?? "").trim();
  const password = process.env.USESOFT_PG_PASSWORD ?? "";

  const missing: string[] = [];
  if (!host) missing.push("USESOFT_PG_HOST");
  if (!portRaw) missing.push("USESOFT_PG_PORT");
  if (!database) missing.push("USESOFT_PG_DATABASE");
  if (!user) missing.push("USESOFT_PG_USER");
  if (!password) missing.push("USESOFT_PG_PASSWORD");
  if (missing.length) {
    throw new UsesoftConfigError(
      `ERP Usesoft não configurado. Configure no backend: ${missing.join(", ")}.`,
    );
  }

  if (!IPV4_RE.test(host) && !HOST_RE.test(host)) {
    throw new UsesoftConfigError(
      `USESOFT_PG_HOST inválido ("${host}"). Use apenas o IP ou DNS do servidor (ex.: 177.92.31.138), sem usuário, "@", porta ou "://".`,
    );
  }

  const port = Number(portRaw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new UsesoftConfigError(
      `USESOFT_PG_PORT inválido ("${portRaw}"). Use um número entre 1 e 65535 (ex.: 5435).`,
    );
  }

  if (!DB_RE.test(database)) {
    throw new UsesoftConfigError(
      `USESOFT_PG_DATABASE inválido ("${database}"). Use apenas letras, números e "_" (ex.: usesoft).`,
    );
  }

  return { host, port, database, user, password };
}

function getPool(): Pool {
  if (_pool) return _pool;

  const { host, port, database, user, password } = validateUsesoftEnv();

  _pool = new Pool({
    host,
    port,
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
    const err = e as Error;
    const msg = err.message ?? String(err);
    let friendly = msg;
    if (err.name === "UsesoftConfigError") {
      friendly = msg;
    } else if (msg.includes("ENOTFOUND") || msg.includes("EAI_AGAIN")) {
      friendly = "Host do ERP não resolvido (DNS). Verifique USESOFT_PG_HOST no backend.";
    } else if (msg.includes("ECONNREFUSED")) {
      friendly = "Conexão recusada pelo ERP. Verifique USESOFT_PG_PORT e firewall.";
    } else if (msg.includes("ETIMEDOUT") || msg.includes("timeout")) {
      friendly = "Tempo esgotado ao conectar no ERP. Verifique rede/firewall.";
    } else if (msg.includes("password authentication failed")) {
      friendly = "Usuário ou senha do ERP inválidos.";
    } else if (msg.includes("does not exist") && msg.includes("database")) {
      friendly = "Banco do ERP não existe. Verifique USESOFT_PG_DATABASE.";
    }
    return { ok: false, error: friendly, latency_ms: Date.now() - t0 };
  }

}
