/**
 * Données de DÉMONSTRATION de l'hébergement (pour tester le parcours de
 * réservation avant la confirmation des vraies chambres).
 *
 *   npm run db:seed-demo -- --currency=XXX
 *
 * - refusé si APP_MODE=production ;
 * - tout est marqué is_demo = true : masqué automatiquement en production
 *   et signalé « Exemple de démonstration » sur le site ;
 * - ne modifie AUCUN paramètre de l'établissement (devise, coordonnées…).
 * Suppression : npm run db:seed-demo -- --remove
 */
import { loadEnv } from "./_env";
loadEnv();

import { pool, query, withTransaction } from "../src/server/db";
import { env } from "../src/server/env";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}`))?.split("=")[1];

async function remove() {
  await withTransaction(async (db) => {
    const used = await query("SELECT 1 FROM room_reservations WHERE is_demo LIMIT 1", [], db);
    if (used.length) {
      // Les réservations sont conservées (traçabilité) : on masque seulement les catégories.
      await query("UPDATE room_types SET is_published = false WHERE is_demo", [], db);
      console.log("Des réservations de démonstration existent : catégories de démo dépubliées (non supprimées).");
      return;
    }
    await query("DELETE FROM room_rates WHERE room_type_id IN (SELECT id FROM room_types WHERE is_demo)", [], db);
    await query("DELETE FROM rooms WHERE is_demo", [], db);
    await query("DELETE FROM room_types WHERE is_demo", [], db);
    console.log("✓ Données de démonstration supprimées.");
  });
}

async function main() {
  if (env().APP_MODE === "production") throw new Error("Refusé : APP_MODE=production. Les données de démonstration sont interdites en production.");
  if (process.argv.includes("--remove")) return remove();
  const currency = (arg("currency") ?? "").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Précisez la devise de test : --currency=XXX (code ISO à 3 lettres).");
  await withTransaction(async (db) => {
    const exists = await query("SELECT 1 FROM room_types WHERE is_demo LIMIT 1", [], db);
    if (exists.length) throw new Error("Des données de démonstration existent déjà (--remove pour les retirer).");
    const types = [
      { slug: "exemple-chambre-double", name: "Chambre double (exemple)", adults: 2, children: 1, occ: 3, beds: 1, bed: "1 lit double (exemple)", amount: 1000, units: ["D01", "D02", "D03"] },
      { slug: "exemple-chambre-twin", name: "Chambre à deux lits (exemple)", adults: 2, children: 0, occ: 2, beds: 2, bed: "2 lits simples (exemple)", amount: 900, units: ["T01", "T02"] },
    ];
    for (const [i, t] of types.entries()) {
      const rows = await query<{ id: string }>(
        `INSERT INTO room_types (slug, name, description, max_adults, max_children, max_occupancy, bed_count, bed_description,
            amenities, stay_rules, cancellation_policy, is_published, sort_order, is_demo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12,true) RETURNING id`,
        [t.slug, t.name, "Catégorie FICTIVE de démonstration, à remplacer par les chambres réelles.", t.adults, t.children, t.occ, t.beds, t.bed,
          ["Exemple d'équipement"], "Règles de séjour à définir (démonstration).", "Conditions d'annulation à définir (démonstration).", i],
        db,
      );
      const id = rows[0]!.id;
      for (const code of t.units) {
        await query("INSERT INTO rooms (code, room_type_id, operational_status, is_demo) VALUES ($1,$2,'in_service',true)", [`DEMO-${code}`, id], db);
      }
      await query(
        "INSERT INTO room_rates (room_type_id, starts_on, ends_on, nightly_amount, currency, label) VALUES ($1, current_date, current_date + 365, $2, $3, 'Tarif fictif de démonstration')",
        [id, t.amount, currency],
        db,
      );
    }
  });
  console.log("✓ Hébergement de démonstration créé (2 catégories fictives, 5 chambres, tarifs fictifs sur 12 mois).");
  console.log("  Pour tester la réservation : Paramètres → devise identique, puis Hébergement → statut « Ouvert » + activation.");
}

main()
  .catch((e) => {
    console.error("✗", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => pool().end());
