import { query, type Queryable, pool } from "./db";

/**
 * Journal des opérations importantes (table en ajout seul).
 * Ne jamais y écrire de mot de passe ni de donnée de paiement sensible.
 */
export async function audit(
  entry: {
    actorId: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    details?: Record<string, unknown>;
  },
  db: Queryable = pool(),
) {
  await query(
    `INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, details)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [entry.actorId, entry.action, entry.entityType, entry.entityId ?? null, JSON.stringify(entry.details ?? {})],
    db,
  );
}
