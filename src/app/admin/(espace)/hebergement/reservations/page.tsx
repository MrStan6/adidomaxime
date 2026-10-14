import Link from "next/link";
import { AdminForm } from "@/components/admin/AdminForm";
import { AdminPageHeader, AField, EmptyState, FilterLinks } from "@/components/admin/ui";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { SubmitButton } from "@/components/ui/form";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { PAYMENT_METHODS, paymentMethodLabel, ROOM_RESERVATION_STATUSES, roomReservationStatusLabel } from "@/lib/labels";
import { requirePermission } from "@/server/auth/current-user";
import { hasPermission } from "@/server/auth/permissions";
import { listRoomReservations, ROOM_RES_TRANSITIONS } from "@/server/booking/rooms";
import { getSiteConfig } from "@/server/settings";
import { changeReservationStatus, recordRoomPayment } from "../actions";

export const metadata = { title: "Réservations de chambres" };

const LABEL: Record<string, string> = { confirmed: "Confirmer", cancelled: "Annuler", checked_in: "Arrivée du client", checked_out: "Départ du client", no_show: "Non présenté" };

export default async function RoomReservationsPage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const user = await requirePermission("rooms.view");
  const { statut } = await searchParams;
  const status = (ROOM_RESERVATION_STATUSES as readonly string[]).includes(statut ?? "") ? statut : undefined;
  const [rows, config] = await Promise.all([listRoomReservations(status), getSiteConfig()]);
  const canOperate = hasPermission(user.role, "room_reservations.manage");
  const canFinance = hasPermission(user.role, "finance.view");
  const canPay = hasPermission(user.role, "payments.manage");
  return (
    <>
      <Link href="/admin/hebergement" className="link text-sm">Hébergement</Link>
      <AdminPageHeader title="Réservations de chambres" description="Une réservation payée en ligne n'est confirmée qu'après notification authentifiée du prestataire." />
      <FilterLinks base="/admin/hebergement/reservations" param="statut" current={status} options={ROOM_RESERVATION_STATUSES.map((s) => ({ value: s, label: roomReservationStatusLabel[s].label }))} />
      {rows.length === 0 ? <EmptyState title="Aucune réservation de chambre." /> : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.id} className="rounded-lg border border-line bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{r.reference} — {r.customer_name}</p>
                  <p className="text-sm text-ink-soft">{r.customer_phone} {r.customer_email}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={r.status} map={roomReservationStatusLabel} />
                  {r.is_demo && <Badge tone="warning">Démonstration</Badge>}
                  {r.needs_review && <Badge tone="danger">À vérifier</Badge>}
                </div>
              </div>
              <p className="mt-3 text-[0.95rem]">
                {r.room_type_name} × {r.rooms_count} ({r.room_codes.join(", ") || "aucune chambre active"}), du {formatDate(r.check_in)} au {formatDate(r.check_out)}, {r.adults} adulte(s){r.children ? `, ${r.children} enfant(s)` : ""}
              </p>
              {canFinance && <p className="text-[0.95rem]">Montant : {formatMoney(r.total_amount, r.currency)}. Payé (confirmé) : {formatMoney(r.paid_amount, r.currency)}</p>}
              {r.status === "pending_payment" && r.hold_expires_at && <p className="text-sm text-ink-soft">Délai de paiement : {formatDateTime(r.hold_expires_at, config.timezone)}</p>}
              {r.special_requests && <p className="mt-2 whitespace-pre-line text-sm">Demandes : {r.special_requests}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {canOperate && ROOM_RES_TRANSITIONS[r.status].map((t) => (
                  <AdminForm key={t} action={changeReservationStatus} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={r.id} /><input type="hidden" name="to" value={t} />
                    {t === "cancelled" && <input name="reason" required placeholder="Motif" aria-label="Motif d'annulation" className="input w-44" />}
                    <SubmitButton pendingLabel="…" className={`btn btn-sm ${t === "cancelled" || t === "no_show" ? "btn-secondary" : "btn-primary"}`}>{LABEL[t]}</SubmitButton>
                  </AdminForm>
                ))}
              </div>
              {canPay && !["cancelled", "expired"].includes(r.status) && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-terracotta underline">Enregistrer un paiement reçu</summary>
                  <AdminForm action={recordRoomPayment} resetOnSuccess className="mt-3 grid gap-3 sm:grid-cols-4 sm:items-end">
                    <input type="hidden" name="id" value={r.id} />
                    <AField name="amount" label={`Montant (${r.currency})`}><input id={`amt-${r.id}`} name="amount" inputMode="decimal" className="input" required /></AField>
                    <AField name="payment_type" label="Type"><select id={`pt-${r.id}`} name="payment_type" className="input"><option value="deposit">Acompte</option><option value="balance">Solde</option><option value="full">Total</option><option value="refund">Remboursement</option></select></AField>
                    <AField name="method" label="Moyen"><select id={`pm-${r.id}`} name="method" className="input">{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{paymentMethodLabel[m]}</option>)}</select></AField>
                    <SubmitButton pendingLabel="…" className="btn btn-secondary btn-sm">Enregistrer</SubmitButton>
                  </AdminForm>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
