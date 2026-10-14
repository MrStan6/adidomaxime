import { z } from "zod";
import { createHmac } from "node:crypto";
import { env } from "../env";
import { safeEqual } from "../security/crypto";
import {
  type CheckoutRequest,
  type CheckoutResult,
  type PaymentProvider,
  type VerifiedEvent,
  WebhookVerificationError,
} from "./types";

/**
 * Prestataire de DÉMONSTRATION. Aucune somme n'est jamais débitée.
 * - refusé au démarrage si APP_MODE=production (voir env.ts) ;
 * - toutes les transactions créées sont marquées is_demo = true ;
 * - la « page de paiement » est une page interne clairement identifiée.
 * Il reproduit le fonctionnement d'un vrai prestataire (notification
 * signée HMAC) afin de tester l'idempotence et la gestion des erreurs.
 */
export const DEMO_SIGNATURE_HEADER = "x-demo-signature";

const eventSchema = z.object({
  event_id: z.string().min(8),
  type: z.string(),
  provider_reference: z.string(),
  payment_reference: z.string(),
  status: z.enum(["succeeded", "failed", "cancelled", "refunded", "pending"]),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  currency: z.string().length(3),
  failure_reason: z.string().optional(),
});

function secret(): string {
  const s = env().DEMO_PAYMENT_WEBHOOK_SECRET;
  if (!s || s.length < 16) throw new Error("DEMO_PAYMENT_WEBHOOK_SECRET manquant.");
  return s;
}

export function signDemoPayload(rawBody: string): string {
  return createHmac("sha256", secret()).update(rawBody).digest("hex");
}

export const demoProvider: PaymentProvider = {
  id: "demo",
  label: "Paiement de démonstration (aucun débit réel)",
  isDemo: true,

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    if (env().APP_MODE === "production") throw new Error("Prestataire de démonstration interdit en production.");
    const providerReference = `demo_${req.paymentReference}`;
    return {
      providerReference,
      redirectUrl: `/paiement/demonstration/${encodeURIComponent(req.paymentReference)}?retour=${encodeURIComponent(req.returnUrl)}`,
    };
  },

  async verifyWebhook(rawBody: string, headers: Headers): Promise<VerifiedEvent> {
    const signature = headers.get(DEMO_SIGNATURE_HEADER) ?? "";
    if (!signature || !safeEqual(signature, signDemoPayload(rawBody))) {
      throw new WebhookVerificationError("Signature invalide.");
    }
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      throw new WebhookVerificationError("Corps de notification illisible.");
    }
    const parsed = eventSchema.safeParse(json);
    if (!parsed.success) throw new WebhookVerificationError("Notification incomplète.");
    const e = parsed.data;
    return {
      eventId: e.event_id,
      type: e.type,
      providerReference: e.provider_reference,
      paymentReference: e.payment_reference,
      status: e.status,
      amount: e.amount,
      currency: e.currency.toUpperCase(),
      failureReason: e.failure_reason,
      raw: json,
    };
  },
};
