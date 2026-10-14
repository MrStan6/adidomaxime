import { query, queryOne, withTransaction, PG, pgErrorCode, type Queryable, pool } from "../db";
import { audit } from "../audit";
import { env } from "../env";
import { nextReference } from "../references";
import { providerById } from "./registry";
import { type PaymentProvider, PaymentProviderError, type VerifiedEvent } from "./types";

/**
 * Logique de paiement indépendante du prestataire.
 */

const toCents = (v: string | number) => Math.round(Number(v) * 100);

/** Lance un paiement en ligne pour une réservation de chambre en attente. */
export async function startRoomReservationPayment(
  reservationId: string,
  provider: PaymentProvider,
  returnUrl: string,
): Promise<{ paymentReference: string; redirectUrl: string }> {
  const ctx = await withTransaction(async (db) => {
    const res = await queryOne<{
      id: string; reference: string; status: string; total_amount: string; currency: string;
      hold_expires_at: Date | null; full_name: string; email: string | null; phone: string | null; is_demo: boolean;
    }>(
      `SELECT rr.id, rr.reference, rr.status, rr.total_amount, rr.currency, rr.hold_expires_at, rr.is_demo,
              c.full_name, c.email, c.phone
         FROM room_reservations rr JOIN customers c ON c.id = rr.customer_id
        WHERE rr.id = $1 FOR UPDATE OF rr`,
      [reservationId],
      db,
    );
    if (!res || res.status !== "pending_payment" || !res.hold_expires_at || res.hold_expires_at < new Date()) {
      throw new PaymentProviderError("Cette réservation ne peut plus être payée en ligne (délai dépassé ou statut modifié).");
    }
    // Annule les tentatives précédentes encore en attente (nouvelle tentative).
    await query(
      "UPDATE payments SET status = 'cancelled', failure_reason = 'Nouvelle tentative' WHERE room_reservation_id = $1 AND status = 'pending'",
      [res.id],
      db,
    );
    const paymentReference = await nextReference("PY", db);
    const payment = await queryOne<{ id: string }>(
      `INSERT INTO payments (reference, provider, room_reservation_id, amount, currency, method, payment_type, status, is_demo)
       VALUES ($1, $2, $3, $4, $5, 'other', 'full', 'pending', $6) RETURNING id`,
      [paymentReference, provider.id, res.id, res.total_amount, res.currency, provider.isDemo || res.is_demo],
      db,
    );
    return { res, paymentReference, paymentId: payment!.id };
  });

  try {
    const checkout = await provider.createCheckout({
      paymentReference: ctx.paymentReference,
      amount: Number(ctx.res.total_amount).toFixed(2),
      currency: ctx.res.currency,
      description: `Réservation ${ctx.res.reference}`,
      customer: { name: ctx.res.full_name, email: ctx.res.email, phone: ctx.res.phone },
      returnUrl,
    });
    await query("UPDATE payments SET provider_reference = $2 WHERE id = $1", [ctx.paymentId, checkout.providerReference]);
    await audit({ actorId: null, action: "payment.initiated", entityType: "payment", entityId: ctx.paymentId, details: { reference: ctx.paymentReference, provider: provider.id } });
    return { paymentReference: ctx.paymentReference, redirectUrl: checkout.redirectUrl };
  } catch (err) {
    // Erreur du prestataire : la tentative est marquée échouée, jamais réussie.
    await query("UPDATE payments SET status = 'failed', failure_reason = $2 WHERE id = $1", [
      ctx.paymentId,
      (err instanceof Error ? err.message : "Erreur du prestataire").slice(0, 300),
    ]);
    throw new PaymentProviderError("Le service de paiement est momentanément indisponible. Votre réservation reste en attente ; réessayez dans quelques instants.");
  }
}

export type WebhookOutcome =
  | "processed"
  | "duplicate"
  | "ignored"
  | "unknown_payment"
  | "amount_mismatch"
  | "needs_review";

/**
 * Traite une notification VÉRIFIÉE d'un prestataire.
 * Idempotence : la paire (provider, event_id) est unique en base ; une
 * notification répétée est enregistrée une seule fois et sans effet.
 */
export async function processPaymentEvent(providerId: string, event: VerifiedEvent): Promise<WebhookOutcome> {
  try {
    return await withTransaction(async (db) => {
      const inserted = await queryOne<{ id: string }>(
        `INSERT INTO payment_events (provider, event_id, event_type, payload)
         VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (provider, event_id) DO NOTHING RETURNING id`,
        [providerId, event.eventId, event.type, JSON.stringify(event.raw ?? {})],
        db,
      );
      if (!inserted) return "duplicate";

      const payment = await queryOne<{
        id: string; status: string; amount: string; currency: string; room_reservation_id: string | null; reference: string;
      }>(
        `SELECT id, status, amount, currency, room_reservation_id, reference FROM payments
          WHERE provider = $1 AND (($2::text IS NOT NULL AND provider_reference = $2) OR ($3::text IS NOT NULL AND reference = $3))
          FOR UPDATE`,
        [providerId, event.providerReference, event.paymentReference],
        db,
      );
      const finish = async (outcome: WebhookOutcome) => {
        await query("UPDATE payment_events SET outcome = $2, payment_id = $3 WHERE id = $1", [inserted.id, outcome, payment?.id ?? null], db);
        return outcome;
      };
      if (!payment) return finish("unknown_payment");

      // Le montant et la devise notifiés doivent correspondre exactement.
      if (toCents(event.amount) !== toCents(payment.amount) || event.currency.toUpperCase() !== payment.currency.trim().toUpperCase()) {
        await audit({ actorId: null, action: "payment.amount_mismatch", entityType: "payment", entityId: payment.id, details: { notified: event.amount, expected: payment.amount } }, db);
        return finish("amount_mismatch");
      }

      const allowed: Record<string, string[]> = {
        pending: ["succeeded", "failed", "cancelled"],
        cancelled: ["succeeded"], // paiement abouti après une annulation de tentative : à vérifier
        failed: ["succeeded"],
        succeeded: ["refunded"],
        refunded: [],
      };
      if (event.status === "pending" || !allowed[payment.status]?.includes(event.status)) return finish("ignored");

      await query(
        `UPDATE payments SET status = $2, failure_reason = $3,
            confirmed_at = CASE WHEN $2 = 'succeeded' THEN now() ELSE confirmed_at END
          WHERE id = $1`,
        [payment.id, event.status, event.failureReason ?? null],
        db,
      );
      await audit({ actorId: null, action: `payment.${event.status}`, entityType: "payment", entityId: payment.id, details: { reference: payment.reference, provider: providerId } }, db);

      if (event.status === "succeeded" && payment.room_reservation_id) {
        const res = await queryOne<{ status: string; total_amount: string }>(
          "SELECT status, total_amount FROM room_reservations WHERE id = $1 FOR UPDATE",
          [payment.room_reservation_id],
          db,
        );
        if (res?.status === "pending_payment") {
          await query(
            "UPDATE room_reservations SET status = 'confirmed', confirmed_at = now(), hold_expires_at = NULL WHERE id = $1",
            [payment.room_reservation_id],
            db,
          );
          await audit({ actorId: null, action: "room_reservation.confirmed_by_payment", entityType: "room_reservation", entityId: payment.room_reservation_id }, db);
          return finish("processed");
        }
        // Paiement reçu alors que la réservation a expiré ou a été annulée :
        // aucune confirmation automatique, vérification humaine (remboursement ou réattribution).
        await query("UPDATE room_reservations SET needs_review = true WHERE id = $1", [payment.room_reservation_id], db);
        return finish("needs_review");
      }
      return finish("processed");
    });
  } catch (err) {
    // Deux notifications identiques simultanées : la seconde échoue sur l'unicité.
    if (pgErrorCode(err) === PG.UNIQUE_VIOLATION) return "duplicate";
    throw err;
  }
}

/** Point d'entrée des notifications (route API). */
export async function handleWebhook(providerId: string, rawBody: string, headers: Headers): Promise<{ status: number; outcome?: WebhookOutcome }> {
  const provider = providerById(providerId);
  if (!provider) return { status: 404 };
  let event: VerifiedEvent;
  try {
    event = await provider.verifyWebhook(rawBody, headers);
  } catch {
    return { status: 400 };
  }
  const outcome = await processPaymentEvent(provider.id, event);
  return { status: 200, outcome };
}

// ---------------------------------------------------------------------
// Paiements enregistrés manuellement (espèces, virement reçu…)
// ---------------------------------------------------------------------
export type ManualPaymentInput = {
  target: { type: "room_reservation" | "venue_booking"; id: string };
  amount: number;
  currency: string;
  method: "cash" | "bank_transfer" | "mobile_money" | "cheque" | "card" | "other";
  payment_type: "deposit" | "balance" | "full" | "refund";
  external_reference?: string | null;
};

/**
 * Saisie par un utilisateur habilité d'un paiement EFFECTIVEMENT reçu
 * (espèces, virement crédité…). Tracé avec l'auteur et la date.
 */
export async function recordManualPayment(input: ManualPaymentInput, userId: string, db?: Queryable) {
  const run = async (c: Queryable) => {
    const reference = await nextReference("PY", c);
    const row = await queryOne<{ id: string }>(
      `INSERT INTO payments (reference, provider, provider_reference, room_reservation_id, venue_booking_id, amount, currency,
          method, payment_type, status, confirmed_at, recorded_by)
       VALUES ($1, 'manual', $2, $3, $4, $5, $6, $7, $8, 'succeeded', now(), $9) RETURNING id`,
      [
        reference,
        input.external_reference || null,
        input.target.type === "room_reservation" ? input.target.id : null,
        input.target.type === "venue_booking" ? input.target.id : null,
        input.amount,
        input.currency,
        input.method,
        input.payment_type,
        userId,
      ],
      c,
    );
    await audit({ actorId: userId, action: "payment.manual_recorded", entityType: "payment", entityId: row!.id, details: { reference, amount: input.amount, currency: input.currency, method: input.method, target: input.target } }, c);
    return { id: row!.id, reference };
  };
  try {
    return db ? await run(db) : await withTransaction(run);
  } catch (err) {
    if (pgErrorCode(err) === PG.UNIQUE_VIOLATION) throw new PaymentProviderError("Cette référence externe a déjà été enregistrée.");
    throw err;
  }
}

export type PaymentRow = {
  id: string;
  reference: string;
  provider: string;
  provider_reference: string | null;
  amount: string;
  currency: string;
  method: string;
  payment_type: string;
  status: string;
  is_demo: boolean;
  failure_reason: string | null;
  created_at: Date;
  confirmed_at: Date | null;
  recorded_by_name: string | null;
  target_reference: string | null;
  target_type: string;
};

export async function listPayments(status: string | undefined, db: Queryable = pool()): Promise<PaymentRow[]> {
  return query<PaymentRow>(
    `SELECT p.id, p.reference, p.provider, p.provider_reference, p.amount, p.currency, p.method, p.payment_type, p.status,
            p.is_demo, p.failure_reason, p.created_at, p.confirmed_at, u.full_name AS recorded_by_name,
            COALESCE(rr.reference, vb.reference) AS target_reference,
            CASE WHEN p.room_reservation_id IS NOT NULL THEN 'Chambre' WHEN p.venue_booking_id IS NOT NULL THEN 'Salle' ELSE 'Facture' END AS target_type
       FROM payments p
       LEFT JOIN users u ON u.id = p.recorded_by
       LEFT JOIN room_reservations rr ON rr.id = p.room_reservation_id
       LEFT JOIN venue_bookings vb ON vb.id = p.venue_booking_id
      WHERE ($1::text IS NULL OR p.status = $1)
      ORDER BY p.created_at DESC LIMIT 300`,
    [status || null],
    db,
  );
}

export const paymentsEnabled = () => env().PAYMENT_PROVIDER !== "none";
