import Link from "next/link";
import { AdminPageHeader, EmptyState, FilterLinks, TableWrap } from "@/components/admin/ui";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDate, formatDateShort } from "@/lib/format";
import { QUOTE_STATUSES, quoteStatusLabel, SOURCE_LABEL } from "@/lib/labels";
import { requirePermission } from "@/server/auth/current-user";
import { hasPermission } from "@/server/auth/permissions";
import { listQuotes } from "@/server/repositories/quotes";

export const metadata = { title: "Demandes de devis" };

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ statut?: string; q?: string; relance?: string }> }) {
  const user = await requirePermission("quotes.view");
  const sp = await searchParams;
  const status = (QUOTE_STATUSES as readonly string[]).includes(sp.statut ?? "") ? sp.statut : undefined;
  const quotes = await listQuotes({ status, q: sp.q, followUpDue: sp.relance === "1" });
  return (
    <>
      <AdminPageHeader
        title="Demandes de devis"
        description="Demandes reçues par le site ou saisies par l'équipe. Une demande n'est jamais une réservation."
        actions={hasPermission(user.role, "quotes.manage") ? <Link href="/admin/demandes/nouvelle" className="btn btn-primary btn-sm">Saisir une demande</Link> : null}
      />
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        {status && <input type="hidden" name="statut" value={status} />}
        <label htmlFor="q" className="sr-only">Rechercher</label>
        <input id="q" name="q" defaultValue={sp.q} placeholder="Nom, organisation, référence, téléphone…" className="input max-w-md" />
        <button className="btn btn-secondary">Rechercher</button>
        <Link href="/admin/demandes?relance=1" className="btn btn-secondary">Relances en retard</Link>
      </form>
      <FilterLinks base="/admin/demandes" param="statut" current={status} options={QUOTE_STATUSES.map((s) => ({ value: s, label: quoteStatusLabel[s].label }))} />
      {quotes.length === 0 ? (
        <EmptyState title="Aucune demande ne correspond.">Les demandes envoyées depuis le site apparaîtront ici.</EmptyState>
      ) : (
        <TableWrap>
          <table className="table rounded-lg bg-white">
            <thead><tr><th>Référence</th><th>Demandeur</th><th>Événement</th><th>Salle</th><th>Statut</th><th>Reçue le</th></tr></thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id}>
                  <td><Link href={`/admin/demandes/${q.id}`} className="link font-medium">{q.reference}</Link>{q.request_type === "availability" && <p className="text-xs text-ink-soft">Disponibilité</p>}</td>
                  <td>{q.customer_name}{q.organization && <p className="text-xs text-ink-soft">{q.organization}</p>}</td>
                  <td>{q.event_type}<p className="text-xs text-ink-soft">{formatDate(q.event_date)}, {q.participants} pers.</p></td>
                  <td>{q.venue_name ?? <span className="text-ink-soft">Recommandation</span>}</td>
                  <td><StatusBadge status={q.status} map={quoteStatusLabel} /></td>
                  <td>{formatDateShort(q.created_at)}<p className="text-xs text-ink-soft">{SOURCE_LABEL[q.source]}</p></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}
