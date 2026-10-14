import { AdminPageHeader, TableWrap } from "@/components/admin/ui";
import { formatDateTime } from "@/lib/format";
import { requirePermission } from "@/server/auth/current-user";
import { listAudit } from "@/server/repositories/users";
import { getSiteConfig } from "@/server/settings";

export const metadata = { title: "Journal des opérations" };

export default async function AuditPage() {
  await requirePermission("audit.view");
  const [rows, config] = await Promise.all([listAudit(300), getSiteConfig()]);
  return (
    <>
      <AdminPageHeader title="Journal des opérations" description="Historique non modifiable des opérations importantes (300 dernières)." />
      <TableWrap>
        <table className="table bg-white">
          <thead><tr><th>Date</th><th>Utilisateur</th><th>Opération</th><th>Élément</th><th>Détails</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap">{formatDateTime(r.created_at, config.timezone)}</td>
                <td>{r.actor_name ?? <span className="text-ink-soft">Site / système</span>}</td>
                <td><code className="text-xs">{r.action}</code></td>
                <td className="text-xs">{r.entity_type}</td>
                <td className="max-w-md break-words text-xs text-ink-soft">{Object.keys(r.details).length ? JSON.stringify(r.details) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </>
  );
}
