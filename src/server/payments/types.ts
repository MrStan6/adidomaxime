/**
 * Interface commune des prestataires de paiement.
 *
 * Aucun prestataire réel n'est intégré à ce stade : le choix dépend du pays
 * de l'établissement et de l'ouverture d'un compte marchand. Pour en ajouter
 * un (Mobile Money, agrégateur, banque…), créer un fichier dans ce dossier
 * qui implémente PaymentProvider, puis l'enregistrer dans registry.ts.
 *
 * Règles impératives :
 *  - aucune donnée de carte ne transite ni n'est stockée ici (paiement sur
 *    la page hébergée du prestataire) ;
 *  - le statut « payé » ne provient JAMAIS de la redirection du navigateur,
 *    uniquement d'une notification serveur authentifiée (verifyWebhook) ou
 *    d'une vérification serveur à serveur.
 */
export type CheckoutRequest = {
  paymentReference: string; // notre référence (PY-…)
  amount: string; // décimal en chaîne, ex. "45000.00"
  currency: string; // ISO 4217
  description: string;
  customer: { name: string; email: string | null; phone: string | null };
  returnUrl: string; // page de retour (affiche le statut lu en base)
};

export type CheckoutResult = {
  providerReference: string;
  redirectUrl: string;
};

export type VerifiedEvent = {
  eventId: string; // identifiant unique de la notification (idempotence)
  type: string;
  providerReference: string | null;
  paymentReference: string | null;
  status: "succeeded" | "failed" | "cancelled" | "refunded" | "pending";
  amount: string;
  currency: string;
  failureReason?: string;
  raw: unknown;
};

export interface PaymentProvider {
  readonly id: string;
  readonly label: string;
  /** true si les transactions sont fictives (affiché comme tel partout). */
  readonly isDemo: boolean;
  createCheckout(req: CheckoutRequest): Promise<CheckoutResult>;
  /** Vérifie la signature et décode la notification. Lève une erreur si invalide. */
  verifyWebhook(rawBody: string, headers: Headers): Promise<VerifiedEvent>;
}

export class PaymentProviderError extends Error {}
export class WebhookVerificationError extends Error {}
