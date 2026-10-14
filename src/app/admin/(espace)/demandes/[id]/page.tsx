import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminForm } from "@/components/admin/AdminForm";
import { VenueBookingForm } from "@/components/admin/VenueBookingForm";
import { AdminPageHeader, AField, Panel } from "@/components/admin/ui";
import { StatusBadge } from "@/components/ui/Badge";
import { SubmitButton } from "@/components/ui/form";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { layoutLabel, quoteStatusLabel, SOURCE_LABEL, venueBookingStatusLabel, type Layout } from "@/lib/labels";
import { telLink, whatsappLink, mailtoLink } from "@/lib/contact-links";
import { requirePermission } from "@/server/auth/current-user";
import { hasPermission } from "@/server/auth/permissions";
import { getQuote, listQuoteNotes, QUOTE_TRANSITIONS } from "@/server/repositories/quotes";
import { userOptions } from "@/server/repositories/users";
import { venueOptions } from "@/server/repositories/venues";
import { listBookingsForQuote } from "@/server/repositories/venue-bookings";
import { getSiteConfig } from "@/server/settings";
import { addNote, updateQuote } from "../actions";

export const metadata = { title: "Demande" };

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("quotes.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const q = await getQuote(id);
  if (!q) notFound();
  const config = await getSiteConfig();
  const [notes, users, venues, bookings] = await Promise.all([listQuoteNotes(id), userOptions(), venueOptions(false), listBookingsForQuote(id, config.timezone)]);
  const canManage = hasPermission(user.role, "quotes.manage");
  const canBook = hasPermission(user.role, "venue_bookings.manage");
  const allowed = [q.status, ...QUOTE_TRANSITIONS[q.status]];
  const wa = whatsappLink(q.phone ?? "", `Bonjour ${q.customer_name}, nous revenons vers vous concernant votre demande ${q.reference}.`);

  return (
    <>
      <Link href="/admin/demandes" className="link text-sm">Toutes les demandes</Link>
      <AdminPageHeader
        title={`${q.reference} — ${q.customer_name}`}
        description={`${q.request_type === "availability" ? "Vérification de disponibilité" : "Demande de devis"} reçue le ${formatDateTime(q.created_at, config.timezone)} (${SOURCE_LABEL[q.source]}).`}
        actions={<StatusBadge status={q.status} map={quoteStatusLabel} />}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Panel title="Besoin exprimé">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <div><dt className="text-sm text-ink-soft">Événement</dt><dd>{q.event_type}</dd></div>
              <div><dt className="text-sm text-ink-soft">Salle</dt><dd>{q.venue_name ?? "Recommandation demandée"}</dd></div>
              <div><dt className="text-sm text-ink-soft">Date</dt><dd>{formatDate(q.event_date)}{q.start_time ? `, ${q.start_time} – ${q.end_time ?? "?"}` : ""}</dd></div>
              <div><dt className="text-sm text-ink-soft">Participants</dt><dd>{q.participants}</dd></div>
              <div><dt className="text-sm text-ink-soft">Configuration</dt><dd>{q.layout ? layoutLabel[q.layout as Layout] : "—"}</dd></div>
              <div><dt className="text-sm text-ink-soft">Budget indicatif</dt><dd>{q.budget ?? "—"}</dd></div>
              <div className="sm:col-span-2"><dt className="text-sm text-ink-soft">Équipements</dt><dd>{q.equipment_needs.length ? q.equipment_needs.join(", ") : "—"}</dd></div>
              <div className="sm:col-span-2"><dt className="text-sm text-ink-soft">Restauration</dt><dd className="whitespace-pre-line">{q.catering_needs ?? "—"}</dd></div>
              <div className="sm:col-span-2"><dt className="text-sm text-ink-soft">Message</dt><dd className="whitespace-pre-line">{q.message ?? "—"}</dd></div>
            </dl>
          </Panel>

          {canManage && (
            <Panel title="Suivi commercial">
              <AdminForm action={updateQuote}>
                <input type="hidden" name="id" value={q.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <AField name="status" label="Statut">
                    <select id="status" name="status" className="input" defaultValue={q.status}>
                      {allowed.map((s) => <option key={s} value={s}>{quoteStatusLabel[s].label}</option>)}
                    </select>
                  </AField>
                  <AField name="quoted_amount" label={`Montant du devis${config.currency ? ` (${config.currency})` : ""}`} hint={config.currency ? undefined : "Configurez la devise dans les paramètres pour saisir un montant."}>
                    <input id="quoted_amount" name="quoted_amount" inputMode="decimal" className="input" defaultValue={q.quoted_amount ?? ""} disabled={!config.currency} />
                  </AField>
                  <AField name="follow_up_on" label="Date de relance"><input id="follow_up_on" name="follow_up_on" type="date" className="input" defaultValue={q.follow_up_on ?? ""} /></AField>
                  <AField name="assigned_to" label="Responsable">
                    <select id="assigned_to" name="assigned_to" className="input" defaultValue={q.assigned_to ?? ""}>
                      <option value="">Non attribuée</option>
                      {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                    </select>
                  </AField>
                  <AField name="venue_id" label="Salle proposée">
                    <select id="venue_id" name="venue_id" className="input" defaultValue={q.venue_id ?? ""}>
                      <option value="">À déterminer</option>
                      {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </AField>
                  <AField name="participants" label="Participants"><input id="participants" name="participants" type="number" min={1} className="input" defaultValue={q.participants} /></AField>
                  <AField name="event_date" label="Date de l'événement"><input id="event_date" name="event_date" type="date" className="input" defaultValue={q.event_date} /></AField>
                  <div className="grid grid-cols-2 gap-3">
                    <AField name="start_time" label="Début"><input id="start_time" name="start_time" type="time" className="input" defaultValue={q.start_time ?? ""} /></AField>
                    <AField name="end_time" label="Fin"><input id="end_time" name="end_time" type="time" className="input" defaultValue={q.end_time ?? ""} /></AField>
                  </div>
                </div>
                {q.quote_sent_at && <p className="text-sm text-ink-soft">Devis envoyé le {formatDateTime(q.quote_sent_at, config.timezone)}.</p>}
                <SubmitButton pendingLabel="Enregistrement…">Enregistrer le suivi</SubmitButton>
              </AdminForm>
            </Panel>
          )}

          <Panel title="Réservations liées">
            {bookings.length === 0 ? (
              <p className="text-ink-soft">Aucune option ni réservation n'a été créée pour cette demande.</p>
            ) : (
              <ul className="divide-y divide-line">
                {bookings.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link href={`/admin/reservations-salles/${b.id}`} className="link">{b.reference}</Link>
                    <span className="text-sm">{b.venue_name}, {b.starts_local} <StatusBadge status={b.status} map={venueBookingStatusLabel} /></span>
                  </li>
                ))}
              </ul>
            )}
            {canBook && (
              <details className="mt-4">
                <summary className="btn btn-secondary btn-sm cursor-pointer">Poser une option ou réserver une date</summary>
                <div className="mt-4">
                  <VenueBookingForm
                    venues={venues}
                    currency={config.currency}
                    defaults={{
                      venue_id: q.venue_id,
                      title: `${q.event_type} — ${q.organization ?? q.customer_name}`,
                      start_date: q.event_date,
                      start_time: q.start_time,
                      end_date: q.event_date,
                      end_time: q.end_time,
                      quote_id: q.id,
                      customer_id: q.customer_id,
                      customer_label: `${q.customer_name}${q.organization ? ` (${q.organization})` : ""}`,
                    }}
                  />
                </div>
              </details>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Contact">
            <p className="font-medium">{q.customer_name}</p>
            {q.organization && <p className="text-ink-soft">{q.organization}</p>}
            <ul className="mt-3 space-y-1.5 text-[0.95rem]">
              {q.phone && <li><a href={telLink(q.phone) ?? "#"} className="link">{q.phone}</a></li>}
              {q.email && <li><a href={mailtoLink(q.email, `Votre demande ${q.reference}`) ?? "#"} className="link">{q.email}</a></li>}
            </ul>
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp btn-sm mt-4">Répondre sur WhatsApp</a>}
            {q.quoted_amount && <p className="mt-4 text-[0.95rem]">Devis : <strong>{formatMoney(q.quoted_amount, q.quoted_currency)}</strong></p>}
            {q.assigned_name && <p className="mt-2 text-sm text-ink-soft">Suivi par {q.assigned_name}</p>}
          </Panel>

          <Panel title="Commentaires et relances">
            {canManage && (
              <AdminForm action={addNote} resetOnSuccess className="mb-5 space-y-3">
                <input type="hidden" name="id" value={q.id} />
                <AField name="body" label="Nouvelle note"><textarea id="body" name="body" rows={3} className="input" required /></AField>
                <div className="flex flex-wrap items-center gap-3">
                  <select name="kind" className="input w-auto" aria-label="Type de note" defaultValue="comment">
                    <option value="comment">Commentaire</option>
                    <option value="follow_up">Relance effectuée</option>
                  </select>
                  <SubmitButton pendingLabel="Ajout…" className="btn btn-secondary btn-sm">Ajouter</SubmitButton>
                </div>
              </AdminForm>
            )}
            {notes.length === 0 ? (
              <p className="text-ink-soft">Aucune note.</p>
            ) : (
              <ol className="space-y-4">
                {notes.map((n) => (
                  <li key={n.id} className="border-l-2 border-sand pl-3 text-[0.95rem]">
                    <p className="whitespace-pre-line">{n.body}</p>
                    <p className="mt-1 text-xs text-ink-soft">{n.kind === "follow_up" ? "Relance" : n.kind === "status_change" ? "Statut" : "Note"}, {n.author_name ?? "Système"}, {formatDateTime(n.created_at, config.timezone)}</p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
