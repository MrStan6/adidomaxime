import { query, queryOne, type Queryable, pool } from "../db";

/**
 * Indicateurs du tableau de bord, TOUS calculés à partir de la base.
 * Base vide ⇒ zéros (jamais de chiffres inventés).
 */
export type DashboardStats = {
  quotesTotal: number;
  quotesOpen: number;
  quotesNew: number;
  quotesFollowUpDue: number;
  quotesLast30: number;
  venueConfirmedUpcoming: number;
  venueOptionsUpcoming: number;
  roomConfirmed: number;
  roomPending: number;
  contactsNew: number;
  paymentsSucceededCount: number;
  paymentsPending: number;
  reviewNeeded: number;
  revenue: { activity: string; currency: string; amount: string }[];
};

export async function getDashboardStats(db: Queryable = pool()): Promise<DashboardStats> {
  const q = await queryOne<Record<string, string>>(
    `SELECT
       (SELECT count(*) FROM quote_requests)::text AS quotes_total,
       (SELECT count(*) FROM quote_requests WHERE status IN ('new','to_process','preparing','sent','negotiation'))::text AS quotes_open,
       (SELECT count(*) FROM quote_requests WHERE status = 'new')::text AS quotes_new,
       (SELECT count(*) FROM quote_requests WHERE follow_up_on <= current_date
           AND status IN ('new','to_process','preparing','sent','negotiation'))::text AS quotes_follow_up,
       (SELECT count(*) FROM quote_requests WHERE created_at > now() - interval '30 days')::text AS quotes_30,
       (SELECT count(*) FROM venue_bookings WHERE kind = 'booking' AND status = 'confirmed' AND ends_at >= now())::text AS venue_confirmed,
       (SELECT count(*) FROM venue_bookings WHERE kind = 'booking' AND status = 'option' AND ends_at >= now())::text AS venue_options,
       (SELECT count(*) FROM room_reservations WHERE status IN ('confirmed','checked_in') AND NOT is_demo)::text AS room_confirmed,
       (SELECT count(*) FROM room_reservations WHERE status IN ('pending_payment','pending_confirmation') AND NOT is_demo)::text AS room_pending,
       (SELECT count(*) FROM contact_messages WHERE status = 'new')::text AS contacts_new,
       (SELECT count(*) FROM payments WHERE status = 'succeeded' AND NOT is_demo)::text AS pay_ok,
       (SELECT count(*) FROM payments WHERE status = 'pending' AND NOT is_demo)::text AS pay_pending,
       (SELECT count(*) FROM room_reservations WHERE needs_review)::text AS review`,
    [],
    db,
  );
  // Chiffre d'affaires ENCAISSÉ (paiements confirmés, hors démonstration), par activité et devise.
  const revenue = await query<{ activity: string; currency: string; amount: string }>(
    `SELECT CASE WHEN room_reservation_id IS NOT NULL THEN 'Hébergement'
                 WHEN venue_booking_id IS NOT NULL THEN 'Salles' ELSE 'Autre' END AS activity,
            currency,
            sum(CASE WHEN payment_type = 'refund' THEN -amount ELSE amount END)::text AS amount
       FROM payments WHERE status = 'succeeded' AND NOT is_demo
      GROUP BY 1, 2 ORDER BY 1`,
    [],
    db,
  );
  const n = (k: string) => Number(q?.[k] ?? 0);
  return {
    quotesTotal: n("quotes_total"),
    quotesOpen: n("quotes_open"),
    quotesNew: n("quotes_new"),
    quotesFollowUpDue: n("quotes_follow_up"),
    quotesLast30: n("quotes_30"),
    venueConfirmedUpcoming: n("venue_confirmed"),
    venueOptionsUpcoming: n("venue_options"),
    roomConfirmed: n("room_confirmed"),
    roomPending: n("room_pending"),
    contactsNew: n("contacts_new"),
    paymentsSucceededCount: n("pay_ok"),
    paymentsPending: n("pay_pending"),
    reviewNeeded: n("review"),
    revenue,
  };
}

/** État des salles aujourd'hui (occupée / libre) dans le fuseau de l'établissement. */
export async function venuesTodayStatus(timezone: string, db: Queryable = pool()) {
  return query<{ id: string; name: string; busy_now: boolean; next_title: string | null; next_start: string | null }>(
    `SELECT v.id, v.name,
       EXISTS (SELECT 1 FROM venue_bookings b WHERE b.venue_id = v.id AND b.status IN ('option','confirmed')
                 AND now() >= b.starts_at AND now() < b.ends_at) AS busy_now,
       nb.title AS next_title, to_char(nb.starts_at AT TIME ZONE $1, 'DD/MM/YYYY HH24:MI') AS next_start
     FROM venues v
     LEFT JOIN LATERAL (SELECT title, starts_at FROM venue_bookings b WHERE b.venue_id = v.id
                          AND b.status IN ('option','confirmed') AND b.starts_at >= now() ORDER BY b.starts_at LIMIT 1) nb ON true
     ORDER BY v.sort_order, v.name`,
    [timezone],
    db,
  );
}
