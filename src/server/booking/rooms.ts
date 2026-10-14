import { query, queryOne, withTransaction, PG, pgErrorCode, type Queryable, pool } from "../db";
import { audit } from "../audit";
import { env } from "../env";
import { nextReference } from "../references";
import { findOrCreateCustomer } from "../repositories/customers";
import { randomToken, sha256 } from "../security/crypto";
import type { SiteConfig } from "../settings";
import { activePaymentProvider } from "../payments/registry";
import type { RoomReservationStatus } from "@/lib/labels";
import { nightsBetween } from "@/lib/format";

/**
 * Moteur de réservation des chambres.
 *
 * Garanties :
 *  - la disponibilité et le prix sont TOUJOURS recalculés côté serveur ;
 *  - la catégorie est verrouillée (FOR UPDATE) pendant l'attribution des
 *    chambres, et la contrainte d'exclusion room_units_no_overlap rend
 *    toute double occupation impossible ;
 *  - une réservation n'est possible que si le module est explicitement
 *    activé ET que tous les prérequis sont remplis (bookingReadiness).
 */

// ---------------------------------------------------------------------
// Prérequis d'activation
// ---------------------------------------------------------------------
export type Readiness = { ready: boolean; reasons: string[] };

export async function bookingReadiness(config: SiteConfig, db: Queryable = pool()): Promise<Readiness> {
  const reasons: string[] = [];
  const production = env().APP_MODE === "production";
  if (!config.rooms.bookingEnabled) reasons.push("La réservation en ligne n'est pas activée dans les paramètres.");
  if (config.rooms.publicStatus !== "open") reasons.push("Le statut public de l'hébergement n'est pas « ouvert ».");
  if (!config.currency) reasons.push("La devise n'est pas configurée.");

  const sellable = await queryOne<{ n: string }>(
    `SELECT count(DISTINCT rt.id)::text AS n
       FROM room_types rt
       JOIN rooms r ON r.room_type_id = rt.id AND r.operational_status = 'in_service'
       JOIN room_rates rr ON rr.room_type_id = rt.id AND rr.ends_on > current_date
      WHERE rt.is_published AND ($1::boolean OR NOT rt.is_demo) AND ($1::boolean OR NOT r.is_demo)`,
    [!production],
    db,
  );
  if (Number(sellable?.n ?? 0) === 0) {
    reasons.push("Aucune catégorie publiée avec au moins une chambre « en service » et un tarif à venir.");
  }

  const legal = await query<{ key: string; body: string }>(
    "SELECT key, body FROM content_blocks WHERE key IN ('legal.booking_terms','legal.cancellation') AND locale = 'fr'",
    [],
    db,
  );
  const unfinished = legal.filter((l) => !l.body.trim() || /À RENSEIGNER|MODÈLE À/i.test(l.body));
  if (production && (legal.length < 2 || unfinished.length > 0)) {
    reasons.push("Les conditions de réservation et d'annulation ne sont pas finalisées.");
  }
  if (production && !config.legal.validated) reasons.push("Les pages juridiques ne sont pas marquées comme validées.");

  if (config.rooms.paymentMode === "online") {
    const provider = activePaymentProvider();
    if (!provider) reasons.push("Paiement en ligne demandé mais aucun prestataire n'est configuré.");
    else if (provider.isDemo && production) reasons.push("Le prestataire de démonstration est interdit en production.");
  }
  return { ready: reasons.length === 0, reasons };
}

// ---------------------------------------------------------------------
// Catalogue public
// ---------------------------------------------------------------------
export type RoomType = {
  id: string;
  slug: string;
  name: string;
  description: string;
  max_adults: number;
  max_children: number;
  max_occupancy: number;
  bed_count: number;
  bed_description: string;
  amenities: string[];
  stay_rules: string;
  cancellation_policy: string;
  is_published: boolean;
  sort_order: number;
  is_demo: boolean;
  cover: { file_path: string; alt: string; is_placeholder: boolean } | null;
  units_in_service: number;
  units_total: number;
};

const ROOM_TYPE_SQL = `
  SELECT rt.*,
    (SELECT json_build_object('file_path', m.file_path, 'alt', m.alt, 'is_placeholder', m.is_placeholder)
       FROM media m WHERE m.room_type_id = rt.id AND m.is_published ORDER BY m.is_placeholder, m.sort_order LIMIT 1) AS cover,
    (SELECT count(*)::int FROM rooms r WHERE r.room_type_id = rt.id AND r.operational_status = 'in_service') AS units_in_service,
    (SELECT count(*)::int FROM rooms r WHERE r.room_type_id = rt.id) AS units_total
  FROM room_types rt`;

export async function listPublicRoomTypes(db: Queryable = pool()): Promise<RoomType[]> {
  return query<RoomType>(
    `${ROOM_TYPE_SQL} WHERE rt.is_published AND ($1::boolean OR NOT rt.is_demo) ORDER BY rt.sort_order, rt.name`,
    [env().APP_MODE === "demo"],
    db,
  );
}

export async function listAllRoomTypes(db: Queryable = pool()): Promise<RoomType[]> {
  return query<RoomType>(`${ROOM_TYPE_SQL} ORDER BY rt.sort_order, rt.name`, [], db);
}

export async function getRoomType(id: string, db: Queryable = pool()): Promise<RoomType | null> {
  return queryOne<RoomType>(`${ROOM_TYPE_SQL} WHERE rt.id = $1`, [id], db);
}

// ---------------------------------------------------------------------
// Tarification
// ---------------------------------------------------------------------
export type Quote = { nights: number; perRoomTotal: string; total: string; currency: string; nightly: { date: string; amount: string }[] };

/**
 * Calcule le prix d'un séjour. Retourne null si une nuit n'a pas de tarif
 * (nuit non commercialisée) ou si les devises diffèrent.
 */
export async function priceStay(roomTypeId: string, checkIn: string, checkOut: string, rooms: number, db: Queryable = pool()): Promise<Quote | null> {
  const rows = await query<{ night: string; amount: string | null; currency: string | null }>(
    `SELECT to_char(n.night, 'YYYY-MM-DD') AS night, rr.nightly_amount::text AS amount, rr.currency
       FROM generate_series($2::date, $3::date - 1, interval '1 day') AS n(night)
       LEFT JOIN room_rates rr ON rr.room_type_id = $1 AND n.night >= rr.starts_on AND n.night < rr.ends_on
      ORDER BY n.night`,
    [roomTypeId, checkIn, checkOut],
    db,
  );
  if (rows.length === 0 || rows.some((r) => r.amount === null)) return null;
  const currencies = new Set(rows.map((r) => r.currency));
  if (currencies.size !== 1) return null;
  // Calcul en centimes entiers pour éviter les erreurs d'arrondi.
  const perRoomCents = rows.reduce((sum, r) => sum + Math.round(Number(r.amount) * 100), 0);
  return {
    nights: rows.length,
    perRoomTotal: (perRoomCents / 100).toFixed(2),
    total: ((perRoomCents * rooms) / 100).toFixed(2),
    currency: rows[0]!.currency!.trim(),
    nightly: rows.map((r) => ({ date: r.night, amount: r.amount! })),
  };
}

/** Répartition des voyageurs : la chambre la plus chargée doit respecter la capacité. */
export function fitsCapacity(rt: Pick<RoomType, "max_adults" | "max_children" | "max_occupancy">, adults: number, children: number, rooms: number): boolean {
  if (rooms < 1 || adults < rooms) return false;
  const maxAdultsPerRoom = Math.ceil(adults / rooms);
  const maxChildrenPerRoom = Math.ceil(children / rooms);
  const maxGuestsPerRoom = Math.ceil((adults + children) / rooms);
  return maxAdultsPerRoom <= rt.max_adults && maxChildrenPerRoom <= rt.max_children && maxGuestsPerRoom <= rt.max_occupancy;
}

// ---------------------------------------------------------------------
// Disponibilités
// ---------------------------------------------------------------------
/** Libère les réservations en attente de paiement dont le délai est dépassé. */
export async function expireStaleHolds(db: Queryable) {
  const expired = await query<{ id: string }>(
    `UPDATE room_reservations SET status = 'expired'
      WHERE status = 'pending_payment' AND hold_expires_at < now() RETURNING id`,
    [],
    db,
  );
  if (expired.length) {
    await query("UPDATE room_reservation_units SET is_active = false WHERE reservation_id = ANY($1::uuid[])", [expired.map((e) => e.id)], db);
    await query(
      `UPDATE payments SET status = 'cancelled', failure_reason = 'Délai de paiement dépassé'
        WHERE status = 'pending' AND room_reservation_id = ANY($1::uuid[])`,
      [expired.map((e) => e.id)],
      db,
    );
  }
  return expired.length;
}

async function freeRoomIds(roomTypeId: string, checkIn: string, checkOut: string, db: Queryable, includeDemo: boolean) {
  return query<{ id: string }>(
    `SELECT r.id FROM rooms r
      WHERE r.room_type_id = $1 AND r.operational_status = 'in_service' AND ($4::boolean OR NOT r.is_demo)
        AND NOT EXISTS (
          SELECT 1 FROM room_reservation_units u
           WHERE u.room_id = r.id AND u.is_active
             AND daterange(u.check_in, u.check_out, '[)') && daterange($2::date, $3::date, '[)'))
      ORDER BY r.code`,
    [roomTypeId, checkIn, checkOut, includeDemo],
    db,
  );
}

export type SearchParams = { check_in: string; check_out: string; adults: number; children: number; rooms: number };
export type SearchResult = { roomType: RoomType; available: number; quote: Quote };

/** Recherche : catégories publiées disposant de chambres libres et d'un tarif pour chaque nuit. */
export async function searchAvailability(p: SearchParams, db: Queryable = pool()): Promise<SearchResult[]> {
  const includeDemo = env().APP_MODE === "demo";
  const types = await listPublicRoomTypes(db);
  const results: SearchResult[] = [];
  for (const rt of types) {
    if (!fitsCapacity(rt, p.adults, p.children, p.rooms)) continue;
    const free = await freeRoomIds(rt.id, p.check_in, p.check_out, db, includeDemo);
    if (free.length < p.rooms) continue;
    const quote = await priceStay(rt.id, p.check_in, p.check_out, p.rooms, db);
    if (!quote) continue;
    results.push({ roomType: rt, available: free.length, quote });
  }
  return results;
}

// ---------------------------------------------------------------------
// Création d'une réservation
// ---------------------------------------------------------------------
export class RoomBookingError extends Error {
  constructor(
    public code: "disabled" | "unavailable" | "price_changed" | "capacity" | "no_rate" | "invalid",
    message: string,
    public extra: Record<string, string> = {},
  ) {
    super(message);
  }
}

export type CreateRoomReservationInput = SearchParams & {
  room_type_id: string;
  full_name: string;
  phone: string;
  email: string;
  special_requests?: string;
  expected_total: string;
};

export type CreatedReservation = {
  id: string;
  reference: string;
  accessToken: string;
  status: RoomReservationStatus;
  total: string;
  currency: string;
  holdExpiresAt: Date | null;
  isDemo: boolean;
};

export async function createRoomReservation(input: CreateRoomReservationInput, config: SiteConfig): Promise<CreatedReservation> {
  const readiness = await bookingReadiness(config);
  if (!readiness.ready) throw new RoomBookingError("disabled", "La réservation en ligne n'est pas ouverte pour le moment.");
  if (input.check_out <= input.check_in || nightsBetween(input.check_in, input.check_out) > 30) {
    throw new RoomBookingError("invalid", "Dates de séjour invalides.");
  }
  if (input.rooms > config.rooms.maxRoomsPerBooking) {
    throw new RoomBookingError("invalid", `Au-delà de ${config.rooms.maxRoomsPerBooking} chambres, contactez-nous directement.`);
  }
  const includeDemo = env().APP_MODE === "demo";

  try {
    return await withTransaction(async (db) => {
      await expireStaleHolds(db);
      // Verrou par catégorie : sérialise les attributions concurrentes.
      const rt = await queryOne<RoomType & { id: string }>(
        `SELECT * FROM room_types WHERE id = $1 AND is_published AND ($2::boolean OR NOT is_demo) FOR UPDATE`,
        [input.room_type_id, includeDemo],
        db,
      );
      if (!rt) throw new RoomBookingError("unavailable", "Cette catégorie de chambre n'est pas disponible.");
      if (!fitsCapacity(rt, input.adults, input.children, input.rooms)) {
        throw new RoomBookingError("capacity", "Le nombre de voyageurs dépasse la capacité des chambres choisies.");
      }
      const quote = await priceStay(rt.id, input.check_in, input.check_out, input.rooms, db);
      if (!quote) throw new RoomBookingError("no_rate", "Ces dates ne sont pas ouvertes à la réservation.");
      if (Math.round(Number(quote.total) * 100) !== Math.round(Number(input.expected_total) * 100)) {
        throw new RoomBookingError("price_changed", "Le tarif a été mis à jour. Vérifiez le nouveau montant avant de confirmer.", { total: quote.total });
      }
      const free = await freeRoomIds(rt.id, input.check_in, input.check_out, db, includeDemo);
      if (free.length < input.rooms) {
        throw new RoomBookingError("unavailable", "Ces chambres viennent d'être réservées. Veuillez relancer une recherche.");
      }

      const online = config.rooms.paymentMode === "online";
      const status: RoomReservationStatus = online ? "pending_payment" : "pending_confirmation";
      const holdExpiresAt = online ? new Date(Date.now() + config.rooms.holdMinutes * 60_000) : null;
      const customerId = await findOrCreateCustomer({ full_name: input.full_name, email: input.email, phone: input.phone }, db);
      const reference = await nextReference("RC", db);
      const accessToken = randomToken(24);
      const row = await queryOne<{ id: string }>(
        `INSERT INTO room_reservations (reference, customer_id, room_type_id, check_in, check_out, adults, children,
            rooms_count, status, total_amount, currency, hold_expires_at, terms_accepted_at, special_requests,
            access_token_hash, is_demo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now(), $13, $14, $15) RETURNING id`,
        [
          reference, customerId, rt.id, input.check_in, input.check_out, input.adults, input.children, input.rooms,
          status, quote.total, quote.currency, holdExpiresAt, input.special_requests ?? null, sha256(accessToken), rt.is_demo,
        ],
        db,
      );
      for (const room of free.slice(0, input.rooms)) {
        await query(
          `INSERT INTO room_reservation_units (reservation_id, room_id, check_in, check_out) VALUES ($1,$2,$3,$4)`,
          [row!.id, room.id, input.check_in, input.check_out],
          db,
        );
      }
      await audit(
        { actorId: null, action: "room_reservation.created", entityType: "room_reservation", entityId: row!.id, details: { reference, status, total: quote.total } },
        db,
      );
      return { id: row!.id, reference, accessToken, status, total: quote.total, currency: quote.currency, holdExpiresAt, isDemo: rt.is_demo };
    });
  } catch (err) {
    if (pgErrorCode(err) === PG.EXCLUSION_VIOLATION) {
      throw new RoomBookingError("unavailable", "Ces chambres viennent d'être réservées. Veuillez relancer une recherche.");
    }
    throw err;
  }
}

// ---------------------------------------------------------------------
// Consultation et gestion
// ---------------------------------------------------------------------
export type RoomReservationRow = {
  id: string;
  reference: string;
  status: RoomReservationStatus;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  rooms_count: number;
  total_amount: string;
  currency: string;
  hold_expires_at: Date | null;
  special_requests: string | null;
  is_demo: boolean;
  needs_review: boolean;
  created_at: Date;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  room_type_name: string;
  room_codes: string[];
  paid_amount: string;
};

const RES_SQL = `
  SELECT rr.id, rr.reference, rr.status, to_char(rr.check_in,'YYYY-MM-DD') AS check_in, to_char(rr.check_out,'YYYY-MM-DD') AS check_out,
         rr.adults, rr.children, rr.rooms_count, rr.total_amount, rr.currency, rr.hold_expires_at, rr.special_requests,
         rr.is_demo, rr.needs_review, rr.created_at,
         c.full_name AS customer_name, c.email AS customer_email, c.phone AS customer_phone, rt.name AS room_type_name,
         COALESCE((SELECT array_agg(r.code ORDER BY r.code) FROM room_reservation_units u JOIN rooms r ON r.id = u.room_id
                    WHERE u.reservation_id = rr.id AND u.is_active), '{}') AS room_codes,
         COALESCE((SELECT sum(CASE WHEN p.payment_type = 'refund' THEN -p.amount ELSE p.amount END)
                     FROM payments p WHERE p.room_reservation_id = rr.id AND p.status = 'succeeded'), 0)::text AS paid_amount
    FROM room_reservations rr
    JOIN customers c ON c.id = rr.customer_id
    JOIN room_types rt ON rt.id = rr.room_type_id`;

export async function getReservationByAccess(reference: string, token: string, db: Queryable = pool()) {
  if (!token || token.length > 100) return null;
  return queryOne<RoomReservationRow>(`${RES_SQL} WHERE rr.reference = $1 AND rr.access_token_hash = $2`, [reference, sha256(token)], db);
}

export async function listRoomReservations(status: string | undefined, db: Queryable = pool()) {
  await expireStaleHolds(db);
  return query<RoomReservationRow>(`${RES_SQL} WHERE ($1::text IS NULL OR rr.status = $1) ORDER BY rr.check_in DESC LIMIT 300`, [status || null], db);
}

export async function getRoomReservation(id: string, db: Queryable = pool()) {
  return queryOne<RoomReservationRow>(`${RES_SQL} WHERE rr.id = $1`, [id], db);
}

export const ROOM_RES_TRANSITIONS: Record<RoomReservationStatus, RoomReservationStatus[]> = {
  pending_payment: ["cancelled"], // la confirmation vient du paiement confirmé
  pending_confirmation: ["confirmed", "cancelled"],
  confirmed: ["checked_in", "cancelled", "no_show"],
  checked_in: ["checked_out"],
  checked_out: [],
  cancelled: [],
  expired: [],
  no_show: [],
};
const RELEASING: RoomReservationStatus[] = ["cancelled", "no_show", "expired"];

export async function changeRoomReservationStatus(id: string, to: RoomReservationStatus, userId: string, reason?: string | null) {
  return withTransaction(async (db) => {
    const cur = await queryOne<{ status: RoomReservationStatus; reference: string }>(
      "SELECT status, reference FROM room_reservations WHERE id = $1 FOR UPDATE",
      [id],
      db,
    );
    if (!cur) throw new RoomBookingError("invalid", "Réservation introuvable.");
    if (!ROOM_RES_TRANSITIONS[cur.status].includes(to)) throw new RoomBookingError("invalid", "Changement de statut non autorisé.");
    if (to === "cancelled" && !reason?.trim()) throw new RoomBookingError("invalid", "Indiquez le motif d'annulation.");
    await query(
      `UPDATE room_reservations SET status = $2, updated_by = $3,
          confirmed_at = CASE WHEN $2 = 'confirmed' THEN now() ELSE confirmed_at END,
          cancelled_at = CASE WHEN $2 = 'cancelled' THEN now() ELSE cancelled_at END,
          cancel_reason = CASE WHEN $2 = 'cancelled' THEN $4 ELSE cancel_reason END
        WHERE id = $1`,
      [id, to, userId, reason ?? null],
      db,
    );
    if (RELEASING.includes(to)) {
      await query("UPDATE room_reservation_units SET is_active = false WHERE reservation_id = $1", [id], db);
    }
    await audit({ actorId: userId, action: "room_reservation.status", entityType: "room_reservation", entityId: id, details: { reference: cur.reference, from: cur.status, to, reason } }, db);
  });
}

/** Blocage d'une chambre (maintenance, travaux…). */
export async function createRoomBlock(roomId: string, from: string, to: string, reason: string, userId: string) {
  if (to <= from) throw new RoomBookingError("invalid", "La date de fin doit être postérieure à la date de début.");
  try {
    return await withTransaction(async (db) => {
      const row = await queryOne<{ id: string }>(
        `INSERT INTO room_reservation_units (room_id, check_in, check_out, kind, block_reason, created_by)
         VALUES ($1,$2,$3,'block',$4,$5) RETURNING id`,
        [roomId, from, to, reason, userId],
        db,
      );
      await audit({ actorId: userId, action: "room_block.created", entityType: "room", entityId: roomId, details: { from, to, reason } }, db);
      return row!;
    });
  } catch (err) {
    if (pgErrorCode(err) === PG.EXCLUSION_VIOLATION) {
      throw new RoomBookingError("unavailable", "Cette chambre est déjà occupée ou bloquée sur cette période.");
    }
    throw err;
  }
}

export async function releaseRoomBlock(unitId: string, userId: string) {
  await withTransaction(async (db) => {
    await query("UPDATE room_reservation_units SET is_active = false WHERE id = $1 AND kind = 'block'", [unitId], db);
    await audit({ actorId: userId, action: "room_block.released", entityType: "room_unit", entityId: unitId }, db);
  });
}

