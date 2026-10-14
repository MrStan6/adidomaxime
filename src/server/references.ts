import { queryOne, type Queryable, pool } from "./db";

/**
 * Références lisibles et uniques, communiquées aux clients :
 *   DV = demande de devis, RS = réservation de salle, BL = blocage,
 *   RC = réservation de chambre, PY = paiement.
 * Format : PREFIXE-AAAA-NNNNNN (séquence globale, jamais réutilisée).
 */
export type ReferencePrefix = "DV" | "RS" | "BL" | "RC" | "PY";

export async function nextReference(prefix: ReferencePrefix, db: Queryable = pool()): Promise<string> {
  const row = await queryOne<{ n: string }>("SELECT nextval('reference_seq')::text AS n", [], db);
  const year = new Date().getUTCFullYear();
  return `${prefix}-${year}-${String(row!.n).padStart(6, "0")}`;
}
