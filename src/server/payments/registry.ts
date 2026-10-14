import { env } from "../env";
import { demoProvider } from "./demo-provider";
import type { PaymentProvider } from "./types";

/**
 * Registre des prestataires. Ajouter ici un prestataire réel lorsqu'il sera
 * choisi (après validation du pays, du compte marchand et des conditions).
 */
const PROVIDERS: Record<string, PaymentProvider> = {
  demo: demoProvider,
};

/** Prestataire actif, ou null si aucun paiement en ligne n'est configuré. */
export function activePaymentProvider(): PaymentProvider | null {
  const id = env().PAYMENT_PROVIDER;
  if (id === "none") return null;
  const p = PROVIDERS[id] ?? null;
  // Garde-fou supplémentaire (en plus de la validation de env.ts).
  if (p?.isDemo && env().APP_MODE === "production") return null;
  return p;
}

export function providerById(id: string): PaymentProvider | null {
  const p = PROVIDERS[id] ?? null;
  if (p?.isDemo && env().APP_MODE === "production") return null;
  return p;
}
