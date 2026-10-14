import { loadEnv } from "./_env";
loadEnv();

import { pool } from "../src/server/db";
import { runMigrations } from "../src/server/migrate";

async function main() {
  const applied = await runMigrations(pool(), (m) => console.log(m));
  console.log(applied.length ? `✓ ${applied.length} migration(s) appliquée(s).` : "✓ Base déjà à jour.");
}

main()
  .catch((err) => {
    console.error("✗", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool().end());
