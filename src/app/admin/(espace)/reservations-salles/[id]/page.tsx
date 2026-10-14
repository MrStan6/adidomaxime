import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminForm } from "@/components/admin/AdminForm";
import { AdminPageHeader, AField, Panel } from "@/components/admin/ui";
import { StatusBadge } from "@/components/ui/Badge";
import { SubmitButton } from "@/components/ui/form";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { BLOCK_REASON_LABEL, PAYMENT_METHODS, paymentMethodLabel, paymentStatusLabel, venueBookingStatusLabel, type PaymentStatus } from "@/lib/labels";
import { requirePermission } from "@/server/auth/current-user";
import { hasPermission } from "@/server/auth/permissions";
import { query } from "@/server/db";
import { getVenueBooking, VENUE_BOOKING_TRANSITIONS } from "@/server/repositories/venue-bookings";
import { getSiteConfig } from "@/server/settings";
import { changeBookingStatus, recordVenuePayment } from "../actions";

export const metadata = { title: "Réservation de salle" };

const ACTION_LABEL: Record<string, string> = { confirmed: "Confirmer la réservation", cancelled: "Annuler", completed: "Marquer comme terminée" };

export default async function VenueBookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("venue_bookings.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const config = await getSiteConfig();
  const b = await getVenueBooking(id, config.timezone);
  if (!b) notFound();
  const canManage = hasPermission(user.role, "venue_bookings.manage");
  const canFinance = hasPermission(user.role, "finance.view");
  const canPay = hasPermission(user.role, "payments.manage");
  const payments = canFinance
    ? await query<{ reference: string; amount: string; currency: string; method: string; payment_type: string; status: PaymentStatus; confirmed_at: Date | null; created_at: Date }>(
        "SELECT reference, amount, currency, method, payment_type, status, confirmed_at, created_at FROM payments WHERE venue_booking_id = $1 ORDER BY created_at",
        [id],
      )
    : [];
  const transitions = VENUE_BOOKING_TRANSITIONS[b.status].filter((t) => b.kind === "booking" || t === "cancelled");

  return (
    <>
      <Link href="/admin/reservations-salles" className="link text-sm">Toutes les réservations</Link>
      <AdminPageHeader
        title={b.kind === "block" ? `Blocage ${b.reference}` : `${b.reference} — ${b.title}`}
        actions={b.kind === "block" ? <span className="badge badge-neutral">{b.status === "cancelled" ? "Blocage levé" : "Blocage actif"}</span> : <StatusBadge status={b.status} map={venueBookingStatusLabel} />}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Panel title="Détails">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <div><dt className="text-sm text-ink-soft">Salle</dt><dd>{b.venue_name}</dd></div>
              <div><dt className="text-sm text-ink-soft">Période</dt><dd>{b.starts_local} → {b.ends_local}</dd></div>
              {b.kind === "block" && <div><dt className="text-sm text-ink-soft">Motif</dt><dd>{BLOCK_REASON_LABEL[b.block_reason ?? "other"]}</dd></div>}
              {b.customer_name && <div><dt className="text-sm text-ink-soft">Client</dt><dd>{b.customer_name}<br /><span className="text-sm">{b.customer_phone} {b.customer_email}</span></dd></div>}
              {b.quote_reference && <div><dt className="text-sm text-ink-soft">Demande d'origine</dt><dd><Link href={`/admin/demandes/${b.quote_id}`} className="link">{b.quote_reference}</Link></dd></div>}
              {canFinance && b.amount && <div><dt className="text-sm text-ink-soft">Montant convenu</dt><dd>{formatMoney(b.amount, b.currency)}</dd></div>}
              {b.option_expires_on && <div><dt className="text-sm text-ink-soft">Option valable jusqu'au</dt><dd>{formatDate(b.option_expires_on)}</dd></div>}
              {b.confirmed_at && b.kind === "booking" && <div><dt className="text-sm text-ink-soft">Confirmée</dt><dd>{formatDateTime(b.confirmed_at, config.timezone)} par {b.confirmed_by_name ?? "—"}</dd></div>}
              {b.cancel_reason && <div><dt className="text-sm text-ink-soft">Motif d'annulation</dt><dd>{b.cancel_reason}</dd></div>}
              <div><dt className="text-sm text-ink-soft">Créée</dt><dd>{formatDateTime(b.created_at, config.timezone)} par {b.created_by_name ?? "—"}</dd></div>
              {b.notes && <div className="sm:col-span-2"><dt className="text-sm text-ink-soft">Notes</dt><dd className="whitespace-pre-line">{b.notes}</dd></div>}
            </dl>
          </Panel>

          {canFinance && b.kind === "booking" && (
            <Panel title="Paiements">
              {payments.length === 0 ? <p className="text-ink-soft">Aucun paiement enregistré.</p> : (
                <table className="table">
                  <thead><tr><th>Référence</th><th>Type</th><th>Moyen</th><th>Montant</th><th>Statut</th></tr></thead>
                  <tbody>{payments.map((p) => (
                    <tr key={p.reference}><td>{p.reference}</td><td>{p.payment_type === "deposit" ? "Acompte" : p.payment_type === "balance" ? "Solde" : p.payment_type === "refund" ? "Remboursement" : "Total"}</td><td>{paymentMethodLabel[p.method as keyof typeof paymentMethodLabel]}</td><td>{formatMoney(p.amount, p.currency)}</td><td><StatusBadge status={p.status} map={paymentStatusLabel} /></td></tr>
                  ))}</tbody>
                </table>
              )}
              {canPay && b.status !== "cancelled" && (
                <details className="mt-4">
                  <summary className="btn btn-secondary btn-sm cursor-pointer">Enregistrer un paiement reçu</summary>
                  <AdminForm action={recordVenuePayment} resetOnSuccess className="mt-4 space-y-4">
                    <input type="hidden" name="id" value={b.id} />
                    <p className="text-sm text-ink-soft">À utiliser uniquement pour une somme effectivement reçue (espèces remises, virement crédité…).</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <AField name="amount" label={`Montant${config.currency ? ` (${config.currency})` : ""}`}><input id="amount" name="amount" inputMode="decimal" className="input" required disabled={!config.currency} /></AField>
                      <AField name="payment_type" label="Type"><select id="payment_type" name="payment_type" className="input"><option value="deposit">Acompte</option><option value="balance">Solde</option><option value="full">Paiement total</option><option value="refund">Remboursement</option></select></AField>
                      <AField name="method" label="Moyen"><select id="method" name="method" className="input">{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{paymentMethodLabel[m]}</option>)}</select></AField>
                      <AField name="external_reference" label="Référence externe (reçu, virement…)"><input id="external_reference" name="external_reference" className="input" /></AField>
                    </div>
                    <SubmitButton pendingLabel="Enregistrement…">Enregistrer le paiement</SubmitButton>
                  </AdminForm>
                </details>
              )}
            </Panel>
          )}
        </div>

        {canManage && transitions.length > 0 && (
          <Panel title="Changer le statut">
            <div className="space-y-5">
              {transitions.map((t) => (
                <AdminForm key={t} action={changeBookingStatus} className="space-y-3 border-b border-line pb-5 last:border-0 last:pb-0">
                  <input type="hidden" name="id" value={b.id} />
                  <input type="hidden" name="to" value={t} />
                  {t === "confirmed" && (
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" name="conditions_met" value="on" required className="mt-0.5 h-4 w-4 accent-[#a0522d]" />
                      Les conditions de confirmation définies par la direction sont remplies.
                    </label>
                  )}
                  {t === "cancelled" && <AField name="reason" label={b.kind === "block" ? "Motif de levée" : "Motif d'annulation"}><input id="reason" name="reason" className="input" required /></AField>}
                  <SubmitButton pendingLabel="…" className={`btn btn-sm w-full ${t === "cancelled" ? "btn-secondary" : "btn-primary"}`}>{b.kind === "block" && t === "cancelled" ? "Lever le blocage" : ACTION_LABEL[t]}</SubmitButton>
                </AdminForm>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}
