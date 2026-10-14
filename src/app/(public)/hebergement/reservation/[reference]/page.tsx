import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge, Badge } from "@/components/ui/Badge";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { roomReservationStatusLabel } from "@/lib/labels";
import { getReservationByAccess } from "@/server/booking/rooms";
import { getSiteConfig } from "@/server/settings";

export const metadata: Metadata = { title: "Votre réservation", robots: { index: false, follow: false } };

/**
 * Récapitulatif client : le statut affiché est TOUJOURS lu en base
 * (jamais déduit des paramètres de retour du prestataire de paiement).
 */
export default async function ReservationStatusPage({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ reference }, { t }] = await Promise.all([params, searchParams]);
  const res = t ? await getReservationByAccess(reference, t) : null;
  if (!res) notFound();
  const config = await getSiteConfig();
  const messages: Record<string, string> = {
    pending_payment: "Votre paiement n'a pas encore été confirmé par le prestataire. Si vous venez de payer, actualisez cette page dans quelques instants.",
    pending_confirmation: "Votre demande est enregistrée. Elle n'est pas encore confirmée : notre équipe vous contactera.",
    confirmed: "Votre réservation est confirmée.",
    expired: "Le délai de paiement est dépassé : les chambres ont été libérées. Aucun paiement confirmé n'a été enregistré.",
    cancelled: "Cette réservation a été annulée.",
  };
  return (
    <div className="wrap max-w-2xl py-12">
      <h1 className="text-4xl text-earth">Réservation {res.reference}</h1>
      <p className="mt-4 flex flex-wrap gap-2">
        <StatusBadge status={res.status} map={roomReservationStatusLabel} />
        {res.is_demo && <Badge tone="warning">Démonstration : aucune réservation réelle</Badge>}
      </p>
      <p className="mt-4 text-lg">{messages[res.status] ?? ""}</p>
      <dl className="mt-8 space-y-2 rounded-lg bg-sand-light p-6">
        <div className="flex justify-between gap-4"><dt>Chambre</dt><dd>{res.room_type_name} × {res.rooms_count}</dd></div>
        <div className="flex justify-between gap-4"><dt>Arrivée</dt><dd>{formatDate(res.check_in)}</dd></div>
        <div className="flex justify-between gap-4"><dt>Départ</dt><dd>{formatDate(res.check_out)}</dd></div>
        <div className="flex justify-between gap-4"><dt>Montant</dt><dd>{formatMoney(res.total_amount, res.currency)}</dd></div>
        <div className="flex justify-between gap-4"><dt>Paiement confirmé</dt><dd>{Number(res.paid_amount) > 0 ? formatMoney(res.paid_amount, res.currency) : "Aucun"}</dd></div>
        {res.status === "pending_payment" && res.hold_expires_at && (
          <div className="flex justify-between gap-4"><dt>Paiement attendu avant</dt><dd>{formatDateTime(res.hold_expires_at, config.timezone)}</dd></div>
        )}
      </dl>
      <p className="mt-6 text-sm text-ink-soft">Conservez ce lien : il permet de consulter votre réservation. Pour toute modification, <Link href="/contact?sujet=hebergement" className="link">contactez-nous</Link> en indiquant la référence.</p>
    </div>
  );
}
