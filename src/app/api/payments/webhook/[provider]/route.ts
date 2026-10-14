import { handleWebhook } from "@/server/payments/service";

/**
 * Réception des notifications des prestataires de paiement.
 * Seule source de vérité pour confirmer un paiement en ligne.
 */
export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const raw = await request.text();
  if (raw.length > 100_000) return new Response("Payload too large", { status: 413 });
  try {
    const result = await handleWebhook(provider, raw, request.headers);
    return Response.json({ received: result.status === 200, outcome: result.outcome ?? null }, { status: result.status });
  } catch (err) {
    console.error("[webhook] erreur de traitement :", err);
    // 500 : le prestataire réessaiera ; l'idempotence évite tout double traitement.
    return Response.json({ received: false }, { status: 500 });
  }
}
