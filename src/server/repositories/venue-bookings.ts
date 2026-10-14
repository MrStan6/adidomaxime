import { query, queryOne, withTransaction, PG, pgConstraint, pgErrorCode, type Queryable, pool } from "../db";
import { audit } from "../audit";
import { nextReference } from "../references";
import { findOrCreateCustomer } from "./customers";
import type { VenueBookingStatus } from "@/lib/labels";

/**
 * Occupation des salles : options, réservations confirmées et blocages.
 * La contrainte d'exclusion PostgreSQL (venue_bookings_no_overlap) rend un
 * chevauchement IMPOSSIBLE, même en cas de requêtes simultanées. Le code
 * traduit simplement l'erreur en message compréhensible.
 *
 * Les heures sont saisies et affichées dans le fuseau de l'établissement ;
 * la conversion est faite par PostgreSQL (AT TIME ZONE).
 */

export class VenueConflictError extends Error {
  constructor(public conflicts: { reference: string; title: string; starts: string; ends: string; status: string }[]) {
    super("Cette salle est déjà occupée (option, réservation confirmée ou blocage) sur tout ou partie de ce créneau.");
  }
}
export class VenueBookingError extends Error {}

export const VENUE_BOOKING_TRANSITIONS: Record<VenueBookingStatus, VenueBookingStatus[]> = {
  option: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export type VenueBookingInput = {
  kind: "booking" | "block";
  venue_id: string;
  title: string;
  start_date: string; // YYYY-MM-DD (heure locale de l'établissement)
  start_time: string; // HH:MM
  end_date: string;
  end_time: string;
  status: "option" | "confirmed";
  timezone: string;
  customer_id?: string | null;
  customer?: { full_name: string; organization?: string | null; email?: string | null; phone?: string | null } | null;
  quote_id?: string | null;
  amount?: number | null;
  currency?: string | null;
  option_expires_on?: string | null;
  block_reason?: "maintenance" | "internal" | "works" | "other" | null;
  notes?: string | null;
  /** Attestation que les conditions de confirmation sont remplies. */
  conditions_met?: boolean;
};

const LOCAL_FMT = "YYYY-MM-DD HH24:MI";

export async function findVenueConflicts(
  venueId: string,
  startsLocal: string,
  endsLocal: string,
  timezone: string,
  excludeId: string | null = null,
  db: Queryable = pool(),
) {
  return query<{ reference: string; title: string; starts: string; ends: string; status: string }>(
    `SELECT reference, title, status,
            to_char(starts_at AT TIME ZONE $4, '${LOCAL_FMT}') AS starts,
            to_char(ends_at AT TIME ZONE $4, '${LOCAL_FMT}') AS ends
       FROM venue_bookings
      WHERE venue_id = $1 AND status IN ('option','confirmed')
        AND tstzrange(starts_at, ends_at, '[)') && tstzrange($2::timestamp AT TIME ZONE $4, $3::timestamp AT TIME ZONE $4, '[)')
        AND ($5::uuid IS NULL OR id <> $5)
      ORDER BY starts_at`,
    [venueId, startsLocal, endsLocal, timezone, excludeId],
    db,
  );
}

export async function createVenueBooking(input: VenueBookingInput, userId: string): Promise<{ id: string; reference: string }> {
  const startsLocal = `${input.start_date} ${input.start_time}`;
  const endsLocal = `${input.end_date} ${input.end_time}`;
  if (endsLocal <= startsLocal) throw new VenueBookingError("La fin doit être postérieure au début.");
  if (input.kind === "booking" && input.status === "confirmed" && !input.conditions_met) {
    throw new VenueBookingError("Confirmez que les conditions de confirmation définies par la direction sont remplies.");
  }
  if (input.amount != null && !input.currency) throw new VenueBookingError("Devise non configurée : impossible d'enregistrer un montant.");

  try {
    return await withTransaction(async (db) => {
      let customerId = input.customer_id ?? null;
      if (input.kind === "booking" && !customerId) {
        if (!input.customer) throw new VenueBookingError("Client obligatoire pour une réservation.");
        customerId = await findOrCreateCustomer(input.customer, db);
      }
      const reference = await nextReference(input.kind === "block" ? "BL" : "RS", db);
      const status = input.kind === "block" ? "confirmed" : input.status;
      const confirmed = status === "confirmed";
      const row = await queryOne<{ id: string }>(
        `INSERT INTO venue_bookings (reference, kind, venue_id, customer_id, quote_id, title, starts_at, ends_at, status,
            block_reason, amount, currency, option_expires_on, notes, confirmed_at, confirmed_by, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6, $7::timestamp AT TIME ZONE $17, $8::timestamp AT TIME ZONE $17, $9,
                 $10,$11,$12,$13,$14, CASE WHEN $15 THEN now() END, CASE WHEN $15 THEN $16::uuid END, $16, $16)
         RETURNING id`,
        [
          reference,
          input.kind,
          input.venue_id,
          input.kind === "booking" ? customerId : null,
          input.quote_id ?? null,
          input.title,
          startsLocal,
          endsLocal,
          status,
          input.kind === "block" ? (input.block_reason ?? "other") : null,
          input.amount ?? null,
          input.amount != null ? input.currency : null,
          status === "option" ? (input.option_expires_on ?? null) : null,
          input.notes ?? null,
          confirmed,
          userId,
          input.timezone,
        ],
        db,
      );
      await audit(
        {
          actorId: userId,
          action: input.kind === "block" ? "venue_block.created" : "venue_booking.created",
          entityType: "venue_booking",
          entityId: row!.id,
          details: { reference, status, venue_id: input.venue_id, starts: startsLocal, ends: endsLocal, quote_id: input.quote_id ?? null },
        },
        db,
      );
      return { id: row!.id, reference };
    });
  } catch (err) {
    if (pgErrorCode(err) === PG.EXCLUSION_VIOLATION && pgConstraint(err) === "venue_bookings_no_overlap") {
      throw new VenueConflictError(await findVenueConflicts(input.venue_id, startsLocal, endsLocal, input.timezone));
    }
    throw err;
  }
}

export async function changeVenueBookingStatus(
  id: string,
  to: VenueBookingStatus,
  userId: string,
  opts: { reason?: string | null; conditionsMet?: boolean } = {},
) {
  return withTransaction(async (db) => {
    const current = await queryOne<{ status: VenueBookingStatus; kind: string; reference: string }>(
      "SELECT status, kind, reference FROM venue_bookings WHERE id = $1 FOR UPDATE",
      [id],
      db,
    );
    if (!current) throw new VenueBookingError("Réservation introuvable.");
    if (!VENUE_BOOKING_TRANSITIONS[current.status].includes(to)) {
      throw new VenueBookingError("Changement de statut non autorisé.");
    }
    if (to === "confirmed" && !opts.conditionsMet) {
      throw new VenueBookingError("Confirmez que les conditions de confirmation définies par la direction sont remplies.");
    }
    if (to === "cancelled" && !opts.reason?.trim()) throw new VenueBookingError("Indiquez le motif d'annulation.");
    await query(
      `UPDATE venue_bookings SET status = $2, updated_by = $3,
          confirmed_at = CASE WHEN $2 = 'confirmed' THEN now() ELSE confirmed_at END,
          confirmed_by = CASE WHEN $2 = 'confirmed' THEN $3::uuid ELSE confirmed_by END,
          option_expires_on = CASE WHEN $2 = 'confirmed' THEN NULL ELSE option_expires_on END,
          cancelled_at = CASE WHEN $2 = 'cancelled' THEN now() ELSE cancelled_at END,
          cancel_reason = CASE WHEN $2 = 'cancelled' THEN $4 ELSE cancel_reason END
        WHERE id = $1`,
      [id, to, userId, opts.reason ?? null],
      db,
    );
    await audit(
      { actorId: userId, action: "venue_booking.status", entityType: "venue_booking", entityId: id, details: { reference: current.reference, from: current.status, to, reason: opts.reason ?? null } },
      db,
    );
  });
}

export type VenueBookingRow = {
  id: string;
  reference: string;
  kind: "booking" | "block";
  venue_id: string;
  venue_name: string;
  title: string;
  status: VenueBookingStatus;
  starts_local: string;
  ends_local: string;
  start_day: string;
  end_day: string;
  block_reason: string | null;
  amount: string | null;
  currency: string | null;
  option_expires_on: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  quote_id: string | null;
  quote_reference: string | null;
  notes: string | null;
  cancel_reason: string | null;
  confirmed_at: Date | null;
  confirmed_by_name: string | null;
  created_by_name: string | null;
  created_at: Date;
};

const ROW_SQL = `
  SELECT b.id, b.reference, b.kind, b.venue_id, v.name AS venue_name, b.title, b.status,
         to_char(b.starts_at AT TIME ZONE $1, '${LOCAL_FMT}') AS starts_local,
         to_char(b.ends_at AT TIME ZONE $1, '${LOCAL_FMT}') AS ends_local,
         to_char(b.starts_at AT TIME ZONE $1, 'YYYY-MM-DD') AS start_day,
         to_char((b.ends_at - interval '1 second') AT TIME ZONE $1, 'YYYY-MM-DD') AS end_day,
         b.block_reason, b.amount, b.currency, to_char(b.option_expires_on, 'YYYY-MM-DD') AS option_expires_on,
         c.full_name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
         b.quote_id, q.reference AS quote_reference, b.notes, b.cancel_reason, b.confirmed_at,
         uc.full_name AS confirmed_by_name, ucr.full_name AS created_by_name, b.created_at
    FROM venue_bookings b
    JOIN venues v ON v.id = b.venue_id
    LEFT JOIN customers c ON c.id = b.customer_id
    LEFT JOIN quote_requests q ON q.id = b.quote_id
    LEFT JOIN users uc ON uc.id = b.confirmed_by
    LEFT JOIN users ucr ON ucr.id = b.created_by`;

/** Occupations chevauchant une période (dates locales, fin exclusive). */
export async function listVenueBookingsBetween(
  fromDate: string,
  toDate: string,
  timezone: string,
  opts: { venueId?: string | null; includeCancelled?: boolean } = {},
  db: Queryable = pool(),
): Promise<VenueBookingRow[]> {
  return query<VenueBookingRow>(
    `${ROW_SQL}
      WHERE tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange($2::timestamp AT TIME ZONE $1, $3::timestamp AT TIME ZONE $1, '[)')
        AND ($4::uuid IS NULL OR b.venue_id = $4)
        AND ($5::boolean OR b.status <> 'cancelled')
      ORDER BY b.starts_at`,
    [timezone, fromDate, toDate, opts.venueId ?? null, opts.includeCancelled ?? false],
    db,
  );
}

export async function listVenueBookings(
  filters: { status?: string; upcomingOnly?: boolean },
  timezone: string,
  db: Queryable = pool(),
): Promise<VenueBookingRow[]> {
  return query<VenueBookingRow>(
    `${ROW_SQL}
      WHERE ($2::text IS NULL OR b.status = $2) AND ($3::boolean = false OR b.ends_at >= now())
      ORDER BY b.starts_at ${filters.upcomingOnly ? "ASC" : "DESC"} LIMIT 300`,
    [timezone, filters.status || null, filters.upcomingOnly ?? false],
    db,
  );
}

export async function getVenueBooking(id: string, timezone: string, db: Queryable = pool()) {
  return queryOne<VenueBookingRow>(`${ROW_SQL} WHERE b.id = $2`, [timezone, id], db);
}

export async function listBookingsForQuote(quoteId: string, timezone: string, db: Queryable = pool()) {
  return query<VenueBookingRow>(`${ROW_SQL} WHERE b.quote_id = $2 ORDER BY b.created_at DESC`, [timezone, quoteId], db);
}
