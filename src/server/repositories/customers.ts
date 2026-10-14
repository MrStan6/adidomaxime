import { query, queryOne, type Queryable } from "../db";

export type Customer = {
  id: string;
  full_name: string;
  organization: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  anonymized_at: Date | null;
  created_at: Date;
};

/**
 * Retrouve un client existant (même courriel ou même téléphone) pour
 * éviter les doublons de fiches, sinon le crée. Les coordonnées existantes
 * sont complétées sans écraser des valeurs déjà renseignées.
 */
export async function findOrCreateCustomer(
  c: { full_name: string; organization?: string | null; email?: string | null; phone?: string | null },
  db: Queryable,
): Promise<string> {
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM customers
      WHERE anonymized_at IS NULL
        AND (($1::text IS NOT NULL AND lower(email) = lower($1)) OR ($2::text IS NOT NULL AND phone = $2))
      ORDER BY (lower(email) = lower($1)) DESC NULLS LAST, created_at
      LIMIT 1`,
    [c.email ?? null, c.phone ?? null],
    db,
  );
  if (existing) {
    await query(
      `UPDATE customers SET
         email = COALESCE(email, $2), phone = COALESCE(phone, $3),
         organization = COALESCE($4, organization)
       WHERE id = $1`,
      [existing.id, c.email ?? null, c.phone ?? null, c.organization ?? null],
      db,
    );
    return existing.id;
  }
  const row = await queryOne<{ id: string }>(
    `INSERT INTO customers (full_name, organization, email, phone) VALUES ($1,$2,$3,$4) RETURNING id`,
    [c.full_name, c.organization ?? null, c.email ?? null, c.phone ?? null],
    db,
  );
  return row!.id;
}

/**
 * Droit à l'effacement : anonymisation (les données comptables et les
 * réservations restent cohérentes pour la traçabilité).
 */
export async function anonymizeCustomer(id: string, db: Queryable) {
  await query(
    `UPDATE customers SET full_name = 'Client anonymisé', organization = NULL, email = NULL, phone = NULL,
        notes = NULL, anonymized_at = now() WHERE id = $1`,
    [id],
    db,
  );
}
