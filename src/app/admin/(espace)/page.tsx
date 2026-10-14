import Link from "next/link";
import { AdminPageHeader, EmptyState, Panel } from "@/components/admin/ui";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDate, formatMoney } from "@/lib/format";
import { quoteStatusLabel, venueBookingStatusLabel } from "@/lib/labels";
import { requirePermission } from "@/server/auth/current-user";
import { hasPermission } from "@/server/auth/permissions";
import { configChecklist } from "@/server/config-checklist";
import { getDashboardStats, venuesTodayStatus } from "@/server/repositories/dashboard";
import { listQuotes } from "@/server/repositories/quotes";
import { listVenueBookings } from "@/server/repositories/venue-bookings";
import { getSiteConfig } from "@/server/settings";

function Stat({ label, value, href, hint }: { label: string; value: number | string; href?: string; hint?: string }) {
  const inner = (
    <>
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="mt-1 font-display text-4xl text-earth">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-lg border border-line bg-white p-5 no-underline hover:border-terracotta">{inner}</Link>
  ) : (
    <div className="rounded-lg border border-line bg-white p-5">{inner}</div>
  );
}

export default async function DashboardPage() {
  const user = await requirePermission("dashboard.view");
  const config = await getSiteConfig();
  const canQuotes = hasPermission(user.role, "quotes.view");
  const canFinance = hasPermission(user.role, "finance.view");
  const [stats, venues, upcoming, followUps, checklist] = await Promise.all([
    getDashboardStats(),
    venuesTodayStatus(config.timezone),
    listVenueBookings({ upcomingOnly: true }, config.timezone),
    canQuotes ? listQuotes({ followUpDue: true, limit: 8 }) : Promise.resolve([]),
    hasPermission(user.role, "settings.manage") ? configChecklist(config) : Promise.resolve(null),
  ]);
  const events = upcoming.filter((b) => b.kind === "booking" && b.status !== "cancelled").slice(0, 8);

  return (
    <>
      <AdminPageHeader title={`Bonjour ${user.full_name.split(" ")[0]}`} description="Indicateurs calculés en temps réel à partir des données enregistrées." />

      {stats.reviewNeeded > 0 && (
        <p role="alert" className="mb-6 rounded-md border border-danger/30 bg-[#fbeeec] p-4 text-danger">
          {stats.reviewNeeded} réservation(s) de chambre nécessitent une vérification (paiement reçu après expiration). <Link href="/admin/hebergement/reservations" className="underline">Voir</Link>
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {canQuotes && <Stat label="Demandes reçues" value={stats.quotesTotal} hint={`${stats.quotesLast30} sur 30 jours`} href="/admin/demandes" />}
        {canQuotes && <Stat label="Devis en cours" value={stats.quotesOpen} hint={`dont ${stats.quotesNew} nouvelles`} href="/admin/demandes" />}
        <Stat label="Événements confirmés à venir" value={stats.venueConfirmedUpcoming} hint={`${stats.venueOptionsUpcoming} option(s) en attente`} href="/admin/reservations-salles" />
        <Stat label="Messages non traités" value={stats.contactsNew} href={hasPermission(user.role, "messages.view") ? "/admin/messages" : undefined} />
        <Stat label="Réservations de chambres confirmées" value={stats.roomConfirmed} hint={`${stats.roomPending} en attente`} />
        {canFinance && <Stat label="Paiements confirmés" value={stats.paymentsSucceededCount} hint={`${stats.paymentsPending} en attente`} href={hasPermission(user.role, "payments.view") ? "/admin/paiements" : undefined} />}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title="État des salles">
          <ul className="divide-y divide-line">
            {venues.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="font-medium">{v.name}</span>
                <span className="text-sm text-ink-soft">
                  {v.busy_now ? <span className="badge badge-warning">Occupée actuellement</span> : <span className="badge badge-success">Libre actuellement</span>}
                  {v.next_start && <span className="ml-2">Prochain : {v.next_start}</span>}
                </span>
              </li>
            ))}
          </ul>
          <Link href="/admin/reservations-salles?vue=calendrier" className="link mt-3 inline-block text-sm">Ouvrir le calendrier</Link>
        </Panel>

        <Panel title="Événements à venir">
          {events.length === 0 ? (
            <p className="text-ink-soft">Aucun événement enregistré à venir.</p>
          ) : (
            <ul className="divide-y divide-line">
              {events.map((b) => (
                <li key={b.id} className="py-3">
                  <Link href={`/admin/reservations-salles/${b.id}`} className="font-medium hover:underline">{b.title}</Link>
                  <p className="text-sm text-ink-soft">{b.venue_name}, {b.starts_local} <StatusBadge status={b.status} map={venueBookingStatusLabel} /></p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {canQuotes && (
          <Panel title="Relances à faire">
            {followUps.length === 0 ? (
              <p className="text-ink-soft">Aucune relance en retard.</p>
            ) : (
              <ul className="divide-y divide-line">
                {followUps.map((q) => (
                  <li key={q.id} className="py-3">
                    <Link href={`/admin/demandes/${q.id}`} className="font-medium hover:underline">{q.customer_name}</Link>{" "}
                    <StatusBadge status={q.status} map={quoteStatusLabel} />
                    <p className="text-sm text-ink-soft">Relance prévue le {formatDate(q.follow_up_on)}, événement du {formatDate(q.event_date)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}

        {canFinance && (
          <Panel title="Chiffre d'affaires encaissé par activité">
            {stats.revenue.length === 0 ? (
              <p className="text-ink-soft">Aucun paiement confirmé enregistré.</p>
            ) : (
              <table className="table">
                <tbody>
                  {stats.revenue.map((r) => (
                    <tr key={r.activity + r.currency}><td>{r.activity}</td><td className="text-right font-semibold">{formatMoney(r.amount, r.currency)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-3 text-xs text-ink-soft">Paiements confirmés uniquement, hors démonstration, remboursements déduits.</p>
          </Panel>
        )}

        {checklist && (
          <Panel title={`Configuration à compléter (${checklist.remaining})`} className="lg:col-span-2">
            {checklist.remaining === 0 ? (
              <EmptyState title="Toutes les informations essentielles sont renseignées." />
            ) : (
              <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                {checklist.items.filter((i) => !i.done).map((i) => (
                  <li key={i.label} className="flex items-center gap-2 text-[0.95rem]">
                    <span className="badge badge-warning">À renseigner</span>
                    <Link href={i.href} className="hover:underline">{i.label}</Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>
    </>
  );
}
