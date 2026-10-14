import { query, queryOne, withTransaction, type Queryable, pool } from "../db";
import { audit } from "../audit";

/**
 * Facturation (socle). La numérotation est continue par année et attribuée
 * uniquement à l'émission, sous verrou (pas de trou, pas de doublon).
 * Le format (préfixe, mentions obligatoires, PDF) devra être validé selon
 * les règles fiscales du pays avant usage réel.
 */
export const INVOICE_PREFIX = "F";

export function formatInvoiceNumber(year: number, seq: number) {
  return `${INVOICE_PREFIX}-${year}-${String(seq).padStart(5, "0")}`;
}

export async function createDraftInvoice(
  input: {
    customer_id: string;
    venue_booking_id?: string | null;
    room_reservation_id?: string | null;
    currency: string;
    lines: { label: string; quantity: number; unit_amount: number }[];
  },
  userId: string,
) {
  if (input.lines.length === 0) throw new Error("Une facture doit comporter au moins une ligne.");
  return withTransaction(async (db) => {
    const totalCents = input.lines.reduce((s, l) => s + Math.round(l.quantity * l.unit_amount * 100), 0);
    const inv = await queryOne<{ id: string }>(
      `INSERT INTO invoices (customer_id, venue_booking_id, room_reservation_id, currency, total_amount, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [input.customer_id, input.venue_booking_id ?? null, input.room_reservation_id ?? null, input.currency, (totalCents / 100).toFixed(2), userId],
      db,
    );
    for (const [i, l] of input.lines.entries()) {
      await query("INSERT INTO invoice_lines (invoice_id, label, quantity, unit_amount, position) VALUES ($1,$2,$3,$4,$5)", [inv!.id, l.label, l.quantity, l.unit_amount, i], db);
    }
    await audit({ actorId: userId, action: "invoice.draft_created", entityType: "invoice", entityId: inv!.id }, db);
    return inv!;
  });
}

/** Émet une facture brouillon : attribue le prochain numéro de l'année. */
export async function issueInvoice(invoiceId: string, userId: string, now = new Date()) {
  return withTransaction(async (db) => {
    const inv = await queryOne<{ status: string }>("SELECT status FROM invoices WHERE id = $1 FOR UPDATE", [invoiceId], db);
    if (!inv) throw new Error("Facture introuvable.");
    if (inv.status !== "draft") throw new Error("Seule une facture brouillon peut être émise.");
    const year = now.getUTCFullYear();
    await query("INSERT INTO invoice_counters (year, last_number) VALUES ($1, 0) ON CONFLICT (year) DO NOTHING", [year], db);
    const counter = await queryOne<{ last_number: number }>(
      "UPDATE invoice_counters SET last_number = last_number + 1 WHERE year = $1 RETURNING last_number",
      [year],
      db,
    );
    const number = formatInvoiceNumber(year, counter!.last_number);
    await query(
      `UPDATE invoices SET status = 'issued', number = $2, fiscal_year = $3, sequence_number = $4, issued_at = $5 WHERE id = $1`,
      [invoiceId, number, year, counter!.last_number, now],
      db,
    );
    await audit({ actorId: userId, action: "invoice.issued", entityType: "invoice", entityId: invoiceId, details: { number } }, db);
    return number;
  });
}

export async function listInvoices(db: Queryable = pool()) {
  return query<{ id: string; number: string | null; status: string; total_amount: string; currency: string; issued_at: Date | null; customer_name: string; created_at: Date }>(
    `SELECT i.id, i.number, i.status, i.total_amount, i.currency, i.issued_at, c.full_name AS customer_name, i.created_at
       FROM invoices i JOIN customers c ON c.id = i.customer_id ORDER BY i.created_at DESC LIMIT 300`,
    [],
    db,
  );
}
