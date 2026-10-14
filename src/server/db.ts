import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { env } from "./env";

/**
 * Accès à PostgreSQL. Toutes les requêtes passent par des paramètres
 * ($1, $2…) : aucune concaténation de valeurs dans le SQL.
 */
declare global {
  // eslint-disable-next-line no-var
  var __hotelPool: Pool | undefined;
}

export function pool(): Pool {
  if (!globalThis.__hotelPool) {
    const e = env();
    globalThis.__hotelPool = new Pool({
      connectionString: e.DATABASE_URL,
      ssl:
        e.DATABASE_SSL === "true"
          ? { rejectUnauthorized: true, ...(e.DATABASE_SSL_CA ? { ca: e.DATABASE_SSL_CA.replace(/\\n/g, "\n") } : {}) }
          : e.DATABASE_SSL === "no-verify"
            ? { rejectUnauthorized: false }
            : undefined,
      max: e.DATABASE_POOL_MAX,
      idleTimeoutMillis: 30_000,
    });
  }
  return globalThis.__hotelPool;
}

export type Queryable = Pick<PoolClient, "query">;

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
  client: Queryable = pool(),
): Promise<T[]> {
  const res = await client.query<T>(sql, params);
  return res.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
  client: Queryable = pool(),
): Promise<T | null> {
  const rows = await query<T>(sql, params, client);
  return rows[0] ?? null;
}

/**
 * Exécute `fn` dans une transaction. Annulation automatique en cas d'erreur.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
  isolation: "READ COMMITTED" | "SERIALIZABLE" = "READ COMMITTED",
): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query(`BEGIN ISOLATION LEVEL ${isolation}`);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** Codes d'erreur PostgreSQL utiles. */
export const PG = {
  UNIQUE_VIOLATION: "23505",
  EXCLUSION_VIOLATION: "23P01",
  CHECK_VIOLATION: "23514",
  FOREIGN_KEY_VIOLATION: "23503",
  RAISE_EXCEPTION: "P0001",
} as const;

export function pgErrorCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : undefined;
}

export function pgConstraint(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "constraint" in err
    ? String((err as { constraint: unknown }).constraint)
    : undefined;
}
