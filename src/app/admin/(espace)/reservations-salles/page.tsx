import Link from "next/link";
import { AdminPageHeader, EmptyState, FilterLinks, TableWrap } from "@/components/admin/ui";
import { StatusBadge } from "@/components/ui/Badge";
import { addDays, formatDate } from "@/lib/format";
import { BLOCK_REASON_LABEL, VENUE_BOOKING_STATUSES, venueBookingStatusLabel } from "@/lib/labels";
import { requirePermission } from "@/server/auth/current-user";
import { hasPermission } from "@/server/auth/permissions";
import { listVenueBookings, listVenueBookingsBetween, type VenueBookingRow } from "@/server/repositories/venue-bookings";
import { venueOptions } from "@/server/repositories/venues";
import { getSiteConfig } from "@/server/settings";

export const metadata = { title: "Réservations de salles" };

function monthBounds(mois?: string) {
  const now = new Date();
  const m = /^(\d{4})-(\d{2})$/.exec(mois ?? "");
  const y = m ? Number(m[1]) : now.getUTCFullYear();
  const mo = m ? Number(m[2]) - 1 : now.getUTCMonth();
  const first = new Date(Date.UTC(y, mo, 1));
  const next = new Date(Date.UTC(y, mo + 1, 1));
  const prev = new Date(Date.UTC(y, mo - 1, 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(first), to: iso(next), label: new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(first), prev: iso(prev).slice(0, 7), next: iso(next).slice(0, 7) };
}

function Cell({ items }: { items: VenueBookingRow[] }) {
  if (!items.length) return <span className="text-xs text-ink-soft/60">Libre</span>;
  return (
    <ul className="space-y-1">
      {items.map((b) => (
        <li key={b.id}>
          <Link href={`/admin/reservations-salles/${b.id}`} className={`block rounded px-2 py-1 text-xs no-underline ${b.kind === "block" ? "bg-[#ece7de]" : b.status === "confirmed" ? "bg-[#dcebdf]" : "bg-[#f6ead0]"}`}>
            <span className="font-semibold">{b.starts_local.slice(11)}–{b.ends_local.slice(11)}</span> {b.kind === "block" ? `Bloqué (${BLOCK_REASON_LABEL[b.block_reason ?? "other"]})` : b.title}
            {b.kind === "booking" && b.status === "option" && <span> (option)</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function VenueBookingsPage({ searchParams }: { searchParams: Promise<{ vue?: string; mois?: string; statut?: string }> }) {
  const user = await requirePermission("venue_bookings.view");
  const sp = await searchParams;
  const config = await getSiteConfig();
  const canManage = hasPermission(user.role, "venue_bookings.manage");
  const calendar = sp.vue === "calendrier";
  const actions = (
    <>
      <Link href={calendar ? "/admin/reservations-salles" : "/admin/reservations-salles?vue=calendrier"} className="btn btn-secondary btn-sm">{calendar ? "Vue liste" : "Vue calendrier"}</Link>
      {canManage && <Link href="/admin/reservations-salles/nouvelle?type=blocage" className="btn btn-secondary btn-sm">Bloquer une période</Link>}
      {canManage && <Link href="/admin/reservations-salles/nouvelle" className="btn btn-primary btn-sm">Nouvelle réservation</Link>}
    </>
  );

  if (calendar) {
    const m = monthBounds(sp.mois);
    const [venues, rows] = await Promise.all([venueOptions(false), listVenueBookingsBetween(m.from, m.to, config.timezone)]);
    const days: string[] = [];
    for (let d = m.from; d < m.to; d = addDays(d, 1)) days.push(d);
    return (
      <>
        <AdminPageHeader title="Calendrier des salles" description={`Heures affichées dans le fuseau de l'établissement (${config.timezone}).`} actions={actions} />
        <div className="mb-4 flex items-center gap-3">
          <Link href={`?vue=calendrier&mois=${m.prev}`} className="btn btn-secondary btn-sm">Mois précédent</Link>
          <p className="min-w-40 text-center font-semibold capitalize">{m.label}</p>
          <Link href={`?vue=calendrier&mois=${m.next}`} className="btn btn-secondary btn-sm">Mois suivant</Link>
        </div>
        <p className="mb-3 flex flex-wrap gap-3 text-xs"><span className="rounded bg-[#dcebdf] px-2 py-1">Confirmée</span><span className="rounded bg-[#f6ead0] px-2 py-1">Option</span><span className="rounded bg-[#ece7de] px-2 py-1">Blocage</span></p>
        <TableWrap>
          <table className="table bg-white">
            <thead><tr><th scope="col">Jour</th>{venues.map((v) => <th key={v.id} scope="col">{v.name}</th>)}</tr></thead>
            <tbody>
              {days.map((d) => (
                <tr key={d}>
                  <th scope="row" className="whitespace-nowrap text-left font-medium capitalize">{formatDate(d, { weekday: "short", day: "numeric", month: "short" })}</th>
                  {venues.map((v) => (
                    <td key={v.id} className="min-w-44">
                      <Cell items={rows.filter((b) => b.venue_id === v.id && b.start_day <= d && b.end_day >= d)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </>
    );
  }

  const status = (VENUE_BOOKING_STATUSES as readonly string[]).includes(sp.statut ?? "") ? sp.statut : undefined;
  const rows = await listVenueBookings({ status, upcomingOnly: !status }, config.timezone);
  return (
    <>
      <AdminPageHeader title="Réservations de salles" description="Options, réservations confirmées et blocages. Une salle ne peut jamais être occupée deux fois sur le même créneau." actions={actions} />
      <FilterLinks base="/admin/reservations-salles" param="statut" current={status} options={VENUE_BOOKING_STATUSES.map((s) => ({ value: s, label: venueBookingStatusLabel[s].label }))} />
      {!status && <p className="mb-3 text-sm text-ink-soft">Affichage : occupations à venir. Filtrez par statut pour voir l'historique.</p>}
      {rows.length === 0 ? (
        <EmptyState title="Aucune réservation à afficher." />
      ) : (
        <TableWrap>
          <table className="table bg-white">
            <thead><tr><th>Référence</th><th>Salle</th><th>Événement</th><th>Période</th><th>Statut</th></tr></thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td><Link href={`/admin/reservations-salles/${b.id}`} className="link">{b.reference}</Link></td>
                  <td>{b.venue_name}</td>
                  <td>{b.kind === "block" ? <span className="text-ink-soft">Blocage : {BLOCK_REASON_LABEL[b.block_reason ?? "other"]}</span> : b.title}{b.customer_name && <p className="text-xs text-ink-soft">{b.customer_name}</p>}</td>
                  <td className="whitespace-nowrap">{b.starts_local}<p className="text-xs text-ink-soft">→ {b.ends_local}</p></td>
                  <td>{b.kind === "block" ? <span className="badge badge-neutral">{b.status === "cancelled" ? "Levé" : "Blocage"}</span> : <StatusBadge status={b.status} map={venueBookingStatusLabel} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}
