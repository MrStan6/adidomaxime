import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Pool } from "pg";

/**
 * Exécuteur de migrations SQL minimaliste et transparent :
 * - les fichiers db/migrations/NNNN_nom.sql sont appliqués dans l'ordre ;
 * - chaque migration s'exécute dans une transaction ;
 * - une somme de contrôle empêche la modification silencieuse d'une
 *   migration déjà appliquée (créer une nouvelle migration à la place).
 */
export const MIGRATIONS_DIR = path.resolve(process.cwd(), "db/migrations");

export async function runMigrations(pool: Pool, log: (m: string) => void = () => undefined) {
  const client = await pool.connect();
  try {
    // Verrou consultatif : empêche deux déploiements simultanés de migrer en parallèle.
    await client.query("SELECT pg_advisory_lock(727274)");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name        text PRIMARY KEY,
        checksum    text NOT NULL,
        applied_at  timestamptz NOT NULL DEFAULT now()
      )`);
    const applied = new Map(
      (await client.query<{ name: string; checksum: string }>("SELECT name, checksum FROM schema_migrations")).rows.map(
        (r) => [r.name, r.checksum],
      ),
    );
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
    const done: string[] = [];
    for (const file of files) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const previous = applied.get(file);
      if (previous) {
        if (previous !== checksum) {
          throw new Error(`La migration ${file} a été modifiée après application. Créez une nouvelle migration.`);
        }
        continue;
      }
      log(`→ application de ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)", [file, checksum]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Échec de la migration ${file} : ${(err as Error).message}`);
      }
      done.push(file);
    }
    return done;
  } finally {
    await client.query("SELECT pg_advisory_unlock(727274)").catch(() => undefined);
    client.release();
  }
}
