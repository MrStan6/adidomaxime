import Link from "next/link";
import { AdminForm } from "@/components/admin/AdminForm";
import { AdminPageHeader, AField, EmptyState, Panel, TableWrap } from "@/components/admin/ui";
import { SubmitButton } from "@/components/ui/form";
import { BLOCK_REASON_LABEL, ROOM_OPERATIONAL_STATUS_LABEL } from "@/lib/labels";
import { requirePermission } from "@/server/auth/current-user";
import { hasPermission } from "@/server/auth/permissions";
import { bookingReadiness, listAllRoomTypes } from "@/server/booking/rooms";
import { listActiveBlocks, listRooms } from "@/server/booking/rooms-admin";
import { getSiteConfig } from "@/server/settings";
import { blockRoom, saveLodgingSettings, saveRoomUnit, unblockRoom } from "./actions";

export const metadata = { title: "Hébergement" };

const STATUS_OPTS = Object.entries(ROOM_OPERATIONAL_STATUS_LABEL);

export default async function LodgingAdminPage() {
  const user = await requirePermission("rooms.view");
  const config = await getSiteConfig();
  const [readiness, types, rooms, blocks] = await Promise.all([bookingReadiness(config), listAllRoomTypes(), listRooms(), listActiveBlocks()]);
  const canManage = hasPermission(user.role, "rooms.manage");
  const canOperate = hasPermission(user.role, "room_reservations.manage");
  return (
    <>
      <AdminPageHeader
        title="Hébergement"
        description="Préparez les chambres ici. La réservation en ligne ne peut être activée que lorsque toutes les conditions sont réunies."
        actions={<Link href="/admin/hebergement/reservations" className="btn btn-primary btn-sm">Réservations de chambres</Link>}
      />

      <Panel title="Ouverture de la réservation en ligne" className="mb-6">
        {readiness.ready ? (
          <p className="mb-4 rounded-md bg-[#e9f3ec] p-3 text-ok">La réservation en ligne est active.</p>
        ) : (
          <div className="mb-4 rounded-md bg-[#f8efdc] p-4 text-[0.95rem]">
            <p className="font-semibold text-warn">Réservation en ligne inactive. Conditions manquantes :</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">{readiness.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
        )}
        {canManage && (
          <AdminForm action={saveLodgingSettings}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <AField name="public_status" label="Statut affiché sur le site">
                <select id="public_status" name="public_status" className="input" defaultValue={config.rooms.publicStatus}>
                  <option value="coming_soon">Ouverture à venir</option>
                  <option value="to_confirm">Informations à confirmer</option>
                  <option value="open">Ouvert</option>
                </select>
              </AField>
              <AField name="payment_mode" label="Mode de paiement">
                <select id="payment_mode" name="payment_mode" className="input" defaultValue={config.rooms.paymentMode}>
                  <option value="on_confirmation">Sans paiement en ligne (confirmation par l'équipe)</option>
                  <option value="online">Paiement en ligne (prestataire requis)</option>
                </select>
              </AField>
              <AField name="hold_minutes" label="Délai de paiement (minutes)"><input id="hold_minutes" name="hold_minutes" type="number" min={10} max={1440} className="input" defaultValue={config.rooms.holdMinutes} /></AField>
              <AField name="max_rooms" label="Chambres max. par réservation"><input id="max_rooms" name="max_rooms" type="number" min={1} max={10} className="input" defaultValue={config.rooms.maxRoomsPerBooking} /></AField>
            </div>
            <label className="flex items-center gap-2"><input type="checkbox" name="booking_enabled" value="on" defaultChecked={config.rooms.bookingEnabled} className="h-5 w-5 accent-[#a0522d]" /> Activer la réservation en ligne</label>
            <SubmitButton pendingLabel="Vérification…">Enregistrer</SubmitButton>
          </AdminForm>
        )}
      </Panel>

      <Panel title="Catégories de chambres" className="mb-6">
        {types.length === 0 ? <EmptyState title="Aucune catégorie.">Créez une catégorie lorsque les caractéristiques des chambres sont confirmées.</EmptyState> : (
          <ul className="divide-y divide-line">
            {types.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span><Link href={`/admin/hebergement/categories/${t.id}`} className="link font-medium">{t.name}</Link> {t.is_demo && <span className="badge badge-warning">Démo</span>}</span>
                <span className="flex gap-2 text-sm">
                  <span className="badge badge-neutral">{t.units_in_service}/{t.units_total} en service</span>
                  {t.is_published ? <span className="badge badge-success">Publiée</span> : <span className="badge badge-neutral">Non publiée</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
        {canManage && <Link href="/admin/hebergement/categories/nouvelle" className="btn btn-secondary btn-sm mt-4">Nouvelle catégorie</Link>}
      </Panel>

      <Panel title="Chambres" className="mb-6">
        {rooms.length > 0 && (
          <TableWrap>
            <table className="table">
              <thead><tr><th>N°</th><th>Catégorie</th><th>État</th>{canManage && <th><span className="sr-only">Actions</span></th>}</tr></thead>
              <tbody>
                {rooms.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.code}</td>
                    <td>{r.room_type_name}</td>
                    <td>{canManage ? (
                      <AdminForm action={saveRoomUnit} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="id" value={r.id} /><input type="hidden" name="code" value={r.code} /><input type="hidden" name="room_type_id" value={r.room_type_id} />
                        <select name="operational_status" defaultValue={r.operational_status} className="input w-auto" aria-label={`État de la chambre ${r.code}`}>
                          {STATUS_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                        <SubmitButton pendingLabel="…" className="btn btn-secondary btn-sm">OK</SubmitButton>
                      </AdminForm>
                    ) : ROOM_OPERATIONAL_STATUS_LABEL[r.operational_status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
        {canManage && types.length > 0 && (
          <AdminForm action={saveRoomUnit} resetOnSuccess className="mt-5 grid gap-3 sm:grid-cols-[8rem_1fr_1fr_auto] sm:items-end">
            <AField name="code" label="N° de chambre"><input id="code" name="code" className="input" required /></AField>
            <AField name="room_type_id" label="Catégorie"><select id="room_type_id" name="room_type_id" className="input">{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></AField>
            <AField name="operational_status" label="État"><select id="operational_status" name="operational_status" className="input" defaultValue="planned">{STATUS_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></AField>
            <SubmitButton pendingLabel="…" className="btn btn-primary">Ajouter</SubmitButton>
          </AdminForm>
        )}
      </Panel>

      <Panel title="Indisponibilités (maintenance, travaux…)">
        {blocks.length === 0 ? <p className="text-ink-soft">Aucun blocage en cours ou à venir.</p> : (
          <ul className="divide-y divide-line">
            {blocks.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>Chambre {b.room_code} : du {b.check_in} au {b.check_out} ({BLOCK_REASON_LABEL[b.block_reason] ?? b.block_reason})</span>
                {canOperate && <AdminForm action={unblockRoom} className=""><input type="hidden" name="id" value={b.id} /><SubmitButton pendingLabel="…" className="btn btn-secondary btn-sm">Lever</SubmitButton></AdminForm>}
              </li>
            ))}
          </ul>
        )}
        {canOperate && rooms.length > 0 && (
          <AdminForm action={blockRoom} resetOnSuccess className="mt-5 grid gap-3 sm:grid-cols-4 sm:items-end">
            <AField name="room_id" label="Chambre"><select id="room_id" name="room_id" className="input">{rooms.map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}</select></AField>
            <AField name="from" label="Du"><input id="from" name="from" type="date" className="input" required /></AField>
            <AField name="to" label="Au (exclu)"><input id="to" name="to" type="date" className="input" required /></AField>
            <AField name="reason" label="Motif"><input id="reason" name="reason" className="input" defaultValue="Maintenance" required /></AField>
            <SubmitButton pendingLabel="…" className="btn btn-secondary btn-sm sm:col-span-4 sm:w-fit">Bloquer</SubmitButton>
          </AdminForm>
        )}
      </Panel>
    </>
  );
}
