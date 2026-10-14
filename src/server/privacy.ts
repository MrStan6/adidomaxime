import { query, withTransaction } from "./db";
import { anonymizeCustomer } from "./repositories/customers";
import { audit } from "./audit";

/**
 * Protection des données personnelles : droit à l'effacement et durées de
 * conservation. Exécuté par un administrateur via scripts/privacy.ts.
 *
 * Principe : les réservations, devis, paiements et factures sont conservés
 * pour la traçabilité et les obligations comptables, mais les informations
 * permettant d'identifier la personne sont effacées (anonymisation).
 */
export async function eraseCustomerData(email: string, actorId: string | null = null) {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) throw new Error("Adresse électronique invalide.");
  return withTransaction(async (db) => {
    const customers = await query<{ id: string }>(
      "SELECT id FROM customers WHERE lower(email) = $1 AND anonymized_at IS NULL",
      [normalized],
      db,
    );
    for (const c of customers) {
      await anonymizeCustomer(c.id, db);
      // Textes libres pouvant contenir des informations personnelles.
      await query("UPDATE quote_requests SET message = NULL, catering_needs = NULL, budget = NULL WHERE customer_id = $1", [c.id], db);
      await query("UPDATE room_reservations SET special_requests = NULL WHERE customer_id = $1", [c.id], db);
    }
    const messages = await query<{ id: string }>(
      `UPDATE contact_messages SET full_name = 'Contact anonymisé', email = NULL, phone = 'anonymisé',
              message = '[message effacé à la demande de la personne]', status = 'archived'
        WHERE lower(email) = $1 RETURNING id`,
      [normalized],
      db,
    );
    // Le journal ne conserve pas l'adresse effacée, seulement le volume traité.
    await audit(
      { actorId, action: "privacy.erase", entityType: "customer", details: { customers: customers.length, contact_messages: messages.length } },
      db,
    );
    return { customers: customers.length, contactMessages: messages.length };
  });
}

/**
 * Supprime les messages de contact traités ou archivés plus anciens que
 * `months` mois. Les messages « nouveaux » (non traités) ne sont jamais supprimés.
 */
export async function purgeOldContactMessages(months: number, actorId: string | null = null) {
  if (!Number.isInteger(months) || months < 1) throw new Error("Durée invalide (nombre entier de mois ≥ 1).");
  return withTransaction(async (db) => {
    const rows = await query<{ id: string }>(
      `DELETE FROM contact_messages
        WHERE status IN ('handled','archived') AND created_at < now() - make_interval(months => $1)
        RETURNING id`,
      [months],
      db,
    );
    await audit({ actorId, action: "privacy.purge_contact_messages", entityType: "contact_message", details: { months, deleted: rows.length } }, db);
    return rows.length;
  });
}
