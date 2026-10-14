import { AdminPageHeader, EmptyState, FilterLinks, TableWrap } from "@/components/admin/ui";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { formatDateTime, formatMoney } from "@/lib/format";
import { PAYMENT_STATUSES, paymentMethodLabel, paymentStatusLabel, type PaymentStatus } from "@/lib/labels";
import { requirePermission } from "@/server/auth/current-user";
import { listPayments } from "@/server/payments/service";
import { activePaymentProvider } from "@/server/payments/registry";
import { getSiteConfig } from "@/server/settings";

export const metadata = { title: "Paiements" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  await requirePermission("payments.view");
  const { statut } = await searchParams;
  const status = (PAYMENT_STATUSES as readonly string[]).includes(statut ?? "") ? statut : undefined;
  const [rows, config] = await Promise.all([listPayments(status), getSiteConfig()]);
  const provider = activePaymentProvider();
  return (
    <>
      <AdminPageHeader
        title="Paiements"
        description={`Paiement en ligne : ${provider ? provider.label : "aucun prestataire configuré"}. Les paiements reçus sur place s'enregistrent depuis la fiche de la réservation.`}
      />
      <FilterLinks base="/admin/paiements" param="statut" current={status} options={PAYMENT_STATUSES.map((s) => ({ value: s, label: paymentStatusLabel[s].label }))} />
      {rows.length === 0 ? <EmptyState title="Aucun paiement enregistré." /> : (
        <TableWrap>
          <table className="table bg-white">
            <thead><tr><th>Référence</th><th>Objet</th><th>Montant</th><th>Moyen</th><th>Statut</th><th>Confirmation</th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>{p.reference}{p.is_demo && <p><Badge tone="warning">Démonstration, non réel</Badge></p>}</td>
                  <td>{p.target_type} {p.target_reference}</td>
                  <td className="whitespace-nowrap">{p.payment_type === "refund" ? "− " : ""}{formatMoney(p.amount, p.currency)}</td>
                  <td>{p.provider === "manual" ? `${paymentMethodLabel[p.method as keyof typeof paymentMethodLabel]} (saisi par ${p.recorded_by_name ?? "?"})` : p.provider}</td>
                  <td><StatusBadge status={p.status as PaymentStatus} map={paymentStatusLabel} />{p.failure_reason && <p className="text-xs text-ink-soft">{p.failure_reason}</p>}</td>
                  <td className="whitespace-nowrap">{p.confirmed_at ? formatDateTime(p.confirmed_at, config.timezone) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}
