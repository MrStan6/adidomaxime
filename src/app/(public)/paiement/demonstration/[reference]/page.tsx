import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { queryOne } from "@/server/db";
import { env } from "@/server/env";
import { DEMO_SIGNATURE_HEADER, signDemoPayload } from "@/server/payments/demo-provider";
import { handleWebhook } from "@/server/payments/service";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Paiement de démonstration", robots: { index: false, follow: false } };

const safeReturn = (r: string | undefined) => (r && r.startsWith("/hebergement/reservation/") ? r : "/hebergement");

/**
 * Page du prestataire FICTIF. N'existe qu'en mode démonstration avec
 * PAYMENT_PROVIDER=demo. Les boutons émettent une notification signée,
 * traitée par le même code que celle d'un vrai prestataire.
 */
export default async function DemoPaymentPage({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<{ retour?: string }> }) {
  if (env().APP_MODE !== "demo" || env().PAYMENT_PROVIDER !== "demo") notFound();
  const [{ reference }, { retour }] = await Promise.all([params, searchParams]);
  const payment = await queryOne<{ amount: string; currency: string; status: string; provider_reference: string }>(
    "SELECT amount, currency, status, provider_reference FROM payments WHERE reference = $1 AND provider = 'demo'",
    [reference],
  );
  if (!payment) notFound();

  async function simulate(formData: FormData) {
    "use server";
    if (env().APP_MODE !== "demo") return;
    const outcome = formData.get("outcome") === "succeeded" ? "succeeded" : "failed";
    const p = await queryOne<{ amount: string; currency: string; provider_reference: string }>(
      "SELECT amount, currency, provider_reference FROM payments WHERE reference = $1 AND provider = 'demo'",
      [reference],
    );
    if (!p) return;
    const body = JSON.stringify({
      event_id: `evt_${randomUUID()}`,
      type: "payment.updated",
      provider_reference: p.provider_reference,
      payment_reference: reference,
      status: outcome,
      amount: Number(p.amount).toFixed(2),
      currency: p.currency.trim(),
      failure_reason: outcome === "failed" ? "Refus simulé (démonstration)" : undefined,
    });
    await handleWebhook("demo", body, new Headers({ [DEMO_SIGNATURE_HEADER]: signDemoPayload(body) }));
    redirect(safeReturn(String(formData.get("retour") ?? "")));
  }

  return (
    <div className="wrap max-w-xl py-14">
      <p className="rounded-md border-2 border-warn bg-[#f8efdc] p-4 font-semibold text-warn">
        DÉMONSTRATION — prestataire de paiement fictif. Aucune carte n'est demandée et aucune somme n'est débitée.
      </p>
      <h1 className="mt-8 text-3xl text-earth">Paiement {reference}</h1>
      <p className="mt-3 text-lg">Montant : {formatMoney(payment.amount, payment.currency)}</p>
      {payment.status !== "pending" ? (
        <p className="mt-6">Ce paiement n'est plus en attente (statut : {payment.status}).</p>
      ) : (
        <form action={simulate} className="mt-8 flex flex-wrap gap-3">
          <input type="hidden" name="retour" value={safeReturn(retour)} />
          <button name="outcome" value="succeeded" className="btn btn-primary">Simuler un paiement accepté</button>
          <button name="outcome" value="failed" className="btn btn-secondary">Simuler un refus</button>
        </form>
      )}
    </div>
  );
}
