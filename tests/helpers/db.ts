import { pool, query } from "@/server/db";
import { runMigrations } from "@/server/migrate";
import { resetEnvCache } from "@/server/env";

if (!/_test\b|test/.test(process.env.DATABASE_URL ?? "")) {
  throw new Error("Sécurité : les tests doivent viser une base dont le nom contient « test ».");
}

/** Recrée entièrement le schéma de la base de test puis applique les migrations. */
export async function resetDatabase() {
  resetEnvCache();
  await query("DROP SCHEMA IF EXISTS public CASCADE");
  await query("CREATE SCHEMA public");
  await runMigrations(pool());
}

export async function closeDatabase() {
  await globalThis.__hotelPool?.end();
  globalThis.__hotelPool = undefined;
}
