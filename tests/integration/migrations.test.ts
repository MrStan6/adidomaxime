import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { pool, query, queryOne } from "@/server/db";
import { MIGRATIONS_DIR, runMigrations } from "@/server/migrate";
import { closeDatabase, resetDatabase } from "../helpers/db";

beforeAll(resetDatabase);
afterAll(closeDatabase);

describe("migrations", () => {
  it("s'appliquent sur une base vide et sont rejouables sans effet", async () => {
    expect(await runMigrations(pool())).toEqual([]);
    const applied = await query<{ name: string }>("SELECT name FROM schema_migrations ORDER BY name");
    expect(applied.map((a) => a.name)).toEqual(["0001_schema.sql", "0002_reference_data.sql"]);
  });

  it("créent les deux salles avec des informations NON inventées", async () => {
    const venues = await query<{ name: string; area_m2: string | null; pricing_mode: string; price_amount: string | null }>(
      "SELECT name, area_m2, pricing_mode, price_amount FROM venues ORDER BY sort_order",
    );
    expect(venues).toHaveLength(2);
    for (const v of venues) {
      expect(v.name).toMatch(/provisoire/);
      expect(v.area_m2).toBeNull();
      expect(v.pricing_mode).toBe("on_request");
      expect(v.price_amount).toBeNull();
    }
    expect((await queryOne<{ n: string }>("SELECT count(*)::text n FROM venue_capacities"))!.n).toBe("0");
  });

  it("laissent coordonnées et services non confirmés vides ou masqués", async () => {
    const filled = await query("SELECT key FROM settings WHERE key LIKE 'contact.%' AND value <> ''");
    expect(filled).toEqual([]);
    const published = await query("SELECT slug FROM services WHERE is_published OR status <> 'planned'");
    expect(published).toEqual([]);
    expect((await queryOne<{ value: string }>("SELECT value FROM settings WHERE key = 'rooms.booking_enabled'"))!.value).toBe("false");
  });

  it("refusent une migration déjà appliquée puis modifiée", async () => {
    await query("UPDATE schema_migrations SET checksum = 'altered' WHERE name = '0002_reference_data.sql'");
    await expect(runMigrations(pool())).rejects.toThrow(/modifiée après application/);
  });

  it("annulent entièrement une migration en erreur", async () => {
    await resetDatabase();
    const file = path.join(MIGRATIONS_DIR, "9999_test_broken.sql");
    writeFileSync(file, "CREATE TABLE tmp_ok (id int); SELECT * FROM table_inexistante;");
    try {
      await expect(runMigrations(pool())).rejects.toThrow(/9999_test_broken/);
      expect(await queryOne("SELECT to_regclass('tmp_ok') AS t")).toEqual({ t: null });
    } finally {
      unlinkSync(file);
    }
  });
});
