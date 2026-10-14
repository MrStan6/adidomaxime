import { query, queryOne, withTransaction, type Queryable, pool } from "../db";
import { audit } from "../audit";
import { nextReference } from "../references";
import { findOrCreateCustomer } from "./customers";
import type { QuoteStatus } from "@/lib/labels";

/**
 * Demandes commerciales (devis et demandes de disponibilité).
 * Une demande n'est jamais une réservation : la conversion en option ou en
 * réservation confirmée est une action distincte (venue-bookings.ts).
 */

/** Transitions de statut autorisées (cohérence du suivi commercial). */
export const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  new: ["to_process", "preparing", "refused", "cancelled"],
  to_process: ["preparing", "refused", "cancelled"],
  preparing: ["sent", "refused", "cancelled"],
  sent: ["negotiation", "accepted", "refused", "cancelled"],
  negotiation: ["sent", "accepted", "refused", "cancelled"],
  accepted: ["cancelled"],
  refused: ["negotiation"],
  cancelled: ["to_process"],
};

export function canTransitionQuote(from: QuoteStatus, to: QuoteStatus): boolean {
  return from === to || QUOTE_TRANSITIONS[from].includes(to);
}

export type NewQuoteInput = {
  request_type: "quote" | "availability";
  full_name: string;
  organization?: string;
  phone: string;
  email?: string;
  event_type: string;
  venue_id: string | null;
  event_date: string;
  start_time?: string | null;
  end_time?: string | null;
  participants: number;
  layout?: string;
  equipment: string[];
  catering?: string;
  budget?: string;
  message?: string;
  source: "website" | "whatsapp" | "phone" | "email" | "walk_in" | "other";
  privacy_accepted: boolean;
  created_by?: string | null;
};

export async function createQuoteRequest(input: NewQuoteInput): Promise<{ id: string; reference: string }> {
  return withTransaction(async (db) => {
    if (input.venue_id) {
      const venue = await queryOne("SELECT id FROM venues WHERE id = $1", [input.venue_id], db);
      if (!venue) throw new Error("Salle inconnue.");
    }
    const customerId = await findOrCreateCustomer(
      { full_name: input.full_name, organization: input.organization, email: input.email, phone: input.phone },
      db,
    );
    const reference = await nextReference("DV", db);
    const row = await queryOne<{ id: string }>(
      `INSERT INTO quote_requests (reference, request_type, customer_id, venue_id, event_type, event_date, start_time,
          end_time, participants, layout, equipment_needs, catering_needs, budget, message, source,
          privacy_accepted_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, CASE WHEN $16 THEN now() END, $17)
       RETURNING id`,
      [
        reference,
        input.request_type,
        customerId,
        input.venue_id,
        input.event_type,
        input.event_date,
        input.start_time || null,
        input.end_time || null,
        input.participants,
        input.layout ?? null,
        input.equipment,
        input.catering ?? null,
        input.budget ?? null,
        input.message ?? null,
        input.source,
        input.privacy_accepted,
        input.created_by ?? null,
      ],
      db,
    );
    await audit(
      { actorId: input.created_by ?? null, action: "quote.created", entityType: "quote_request", entityId: row!.id, details: { reference, source: input.source } },
      db,
    );
    return { id: row!.id, reference };
  });
}

export type QuoteListItem = {
  id: string;
  reference: string;
  request_type: string;
  status: QuoteStatus;
  event_type: string;
  event_date: string;
  participants: number;
  source: string;
  created_at: Date;
  follow_up_on: string | null;
  quoted_amount: string | null;
  quoted_currency: string | null;
  customer_name: string;
  organization: string | null;
  venue_name: string | null;
  assigned_name: string | null;
};

export async function listQuotes(
  filters: { status?: string; q?: string; followUpDue?: boolean; limit?: number },
  db: Queryable = pool(),
): Promise<QuoteListItem[]> {
  const q = filters.q?.trim() ? `%${filters.q.trim().toLowerCase()}%` : null;
  return query<QuoteListItem>(
    `SELECT qr.id, qr.reference, qr.request_type, qr.status, qr.event_type, to_char(qr.event_date, 'YYYY-MM-DD') AS event_date,
            qr.participants, qr.source, qr.created_at, to_char(qr.follow_up_on, 'YYYY-MM-DD') AS follow_up_on,
            qr.quoted_amount, qr.quoted_currency,
            c.full_name AS customer_name, c.organization, v.name AS venue_name, u.full_name AS assigned_name
       FROM quote_requests qr
       JOIN customers c ON c.id = qr.customer_id
       LEFT JOIN venues v ON v.id = qr.venue_id
       LEFT JOIN users u ON u.id = qr.assigned_to
      WHERE ($1::text IS NULL OR qr.status = $1)
        AND ($2::text IS NULL OR lower(c.full_name) LIKE $2 OR lower(coalesce(c.organization,'')) LIKE $2
             OR lower(qr.reference) LIKE $2 OR lower(coalesce(c.email,'')) LIKE $2 OR coalesce(c.phone,'') LIKE $2)
        AND ($3::boolean = false OR (qr.follow_up_on IS NOT NULL AND qr.follow_up_on <= current_date
             AND qr.status IN ('new','to_process','preparing','sent','negotiation')))
      ORDER BY qr.created_at DESC
      LIMIT $4`,
    [filters.status || null, q, filters.followUpDue ?? false, Math.min(filters.limit ?? 200, 500)],
    db,
  );
}

export type QuoteDetail = QuoteListItem & {
  customer_id: string;
  venue_id: string | null;
  email: string | null;
  phone: string | null;
  start_time: string | null;
  end_time: string | null;
  layout: string | null;
  equipment_needs: string[];
  catering_needs: string | null;
  budget: string | null;
  message: string | null;
  quote_sent_at: Date | null;
  assigned_to: string | null;
  privacy_accepted_at: Date | null;
  updated_at: Date;
};

export async function getQuote(id: string, db: Queryable = pool()): Promise<QuoteDetail | null> {
  return queryOne<QuoteDetail>(
    `SELECT qr.*, to_char(qr.event_date, 'YYYY-MM-DD') AS event_date, to_char(qr.start_time, 'HH24:MI') AS start_time,
            to_char(qr.end_time, 'HH24:MI') AS end_time, to_char(qr.follow_up_on, 'YYYY-MM-DD') AS follow_up_on,
            c.full_name AS customer_name, c.organization, c.email, c.phone,
            v.name AS venue_name, u.full_name AS assigned_name
       FROM quote_requests qr
       JOIN customers c ON c.id = qr.customer_id
       LEFT JOIN venues v ON v.id = qr.venue_id
       LEFT JOIN users u ON u.id = qr.assigned_to
      WHERE qr.id = $1`,
    [id],
    db,
  );
}

export async function listQuoteNotes(quoteId: string, db: Queryable = pool()) {
  return query<{ id: string; kind: string; body: string; created_at: Date; author_name: string | null }>(
    `SELECT n.id, n.kind, n.body, n.created_at, u.full_name AS author_name
       FROM quote_notes n LEFT JOIN users u ON u.id = n.author_id
      WHERE n.quote_id = $1 ORDER BY n.created_at DESC`,
    [quoteId],
    db,
  );
}

export async function addQuoteNote(quoteId: string, authorId: string, body: string, kind: "comment" | "follow_up" | "status_change" = "comment", db: Queryable = pool()) {
  await query("INSERT INTO quote_notes (quote_id, author_id, kind, body) VALUES ($1,$2,$3,$4)", [quoteId, authorId, kind, body], db);
}

export type QuoteCommercialUpdate = {
  status: QuoteStatus;
  quoted_amount: number | null;
  quoted_currency: string | null;
  follow_up_on: string | null;
  assigned_to: string | null;
  venue_id: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  participants: number;
};

export class QuoteTransitionError extends Error {}

/** Met à jour le suivi commercial d'une demande (statut, montant, relance…). */
export async function updateQuoteCommercial(id: string, u: QuoteCommercialUpdate, userId: string) {
  return withTransaction(async (db) => {
    const current = await queryOne<{ status: QuoteStatus; quote_sent_at: Date | null }>(
      "SELECT status, quote_sent_at FROM quote_requests WHERE id = $1 FOR UPDATE",
      [id],
      db,
    );
    if (!current) throw new QuoteTransitionError("Demande introuvable.");
    if (!canTransitionQuote(current.status, u.status)) {
      throw new QuoteTransitionError(`Passage de « ${current.status} » à « ${u.status} » non autorisé.`);
    }
    if (u.quoted_amount !== null && !u.quoted_currency) {
      throw new QuoteTransitionError("Indiquez la devise du montant du devis (configurez-la dans les paramètres).");
    }
    await query(
      `UPDATE quote_requests SET status=$2, quoted_amount=$3, quoted_currency=$4, follow_up_on=$5, assigned_to=$6,
          venue_id=$7, event_date=$8, start_time=$9, end_time=$10, participants=$11, updated_by=$12,
          quote_sent_at = CASE WHEN $2 = 'sent' AND quote_sent_at IS NULL THEN now() ELSE quote_sent_at END
        WHERE id = $1`,
      [id, u.status, u.quoted_amount, u.quoted_amount === null ? null : u.quoted_currency, u.follow_up_on, u.assigned_to,
        u.venue_id, u.event_date, u.start_time, u.end_time, u.participants, userId],
      db,
    );
    if (current.status !== u.status) {
      await addQuoteNote(id, userId, `Statut : ${current.status} → ${u.status}`, "status_change", db);
    }
    await audit(
      { actorId: userId, action: "quote.updated", entityType: "quote_request", entityId: id, details: { from: current.status, to: u.status, quoted_amount: u.quoted_amount } },
      db,
    );
  });
}
