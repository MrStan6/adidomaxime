import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminForm } from "@/components/admin/AdminForm";
import { AdminPageHeader, AField, Panel } from "@/components/admin/ui";
import { SubmitButton } from "@/components/ui/form";
import { formatDate, formatMoney } from "@/lib/format";
import { requirePermission } from "@/server/auth/current-user";
import { getRoomType } from "@/server/booking/rooms";
import { listRates } from "@/server/booking/rooms-admin";
import { getSiteConfig } from "@/server/settings";
import { addCategoryRate, removeRate, saveCategory } from "../../actions";

export const metadata = { title: "Catégorie de chambres" };

export default async function RoomTypePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("rooms.manage");
  const { id } = await params;
  const isNew = id === "nouvelle";
  if (!isNew && !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const rt = isNew ? null : await getRoomType(id);
  if (!isNew && !rt) notFound();
  const [rates, config] = await Promise.all([rt ? listRates(rt.id) : Promise.resolve([]), getSiteConfig()]);
  return (
    <>
      <Link href="/admin/hebergement" className="link text-sm">Hébergement</Link>
      <AdminPageHeader title={rt?.name ?? "Nouvelle catégorie"} description="Ne renseignez que des caractéristiques confirmées. Une catégorie non publiée reste invisible sur le site." />
      <AdminForm action={saveCategory} className="space-y-6">
        {rt && <input type="hidden" name="id" value={rt.id} />}
        <Panel title="Description">
          <div className="grid gap-4 sm:grid-cols-2">
            <AField name="name" label="Nom"><input id="name" name="name" className="input" defaultValue={rt?.name} required /></AField>
            <AField name="slug" label="Identifiant (adresse)"><input id="slug" name="slug" className="input" defaultValue={rt?.slug} required /></AField>
          </div>
          <AField name="description" label="Description" className="mt-4"><textarea id="description" name="description" rows={4} className="input" defaultValue={rt?.description} /></AField>
        </Panel>
        <Panel title="Capacité et couchage">
          <div className="grid gap-4 sm:grid-cols-4">
            <AField name="max_adults" label="Adultes max."><input id="max_adults" name="max_adults" type="number" min={1} className="input" defaultValue={rt?.max_adults ?? 2} /></AField>
            <AField name="max_children" label="Enfants max."><input id="max_children" name="max_children" type="number" min={0} className="input" defaultValue={rt?.max_children ?? 0} /></AField>
            <AField name="max_occupancy" label="Total max."><input id="max_occupancy" name="max_occupancy" type="number" min={1} className="input" defaultValue={rt?.max_occupancy ?? 2} /></AField>
            <AField name="bed_count" label="Nombre de lits"><input id="bed_count" name="bed_count" type="number" min={1} className="input" defaultValue={rt?.bed_count ?? 1} /></AField>
          </div>
          <AField name="bed_description" label="Description du couchage" hint="ex. « 1 lit double »" className="mt-4"><input id="bed_description" name="bed_description" className="input" defaultValue={rt?.bed_description} /></AField>
          <AField name="amenities" label="Équipements (un par ligne)" className="mt-4"><textarea id="amenities" name="amenities" rows={5} className="input" defaultValue={rt?.amenities.join("\n")} /></AField>
        </Panel>
        <Panel title="Règles">
          <AField name="stay_rules" label="Règles de séjour"><textarea id="stay_rules" name="stay_rules" rows={4} className="input" defaultValue={rt?.stay_rules} /></AField>
          <AField name="cancellation_policy" label="Conditions d'annulation" className="mt-4"><textarea id="cancellation_policy" name="cancellation_policy" rows={4} className="input" defaultValue={rt?.cancellation_policy} /></AField>
          <div className="mt-4 flex flex-wrap items-end gap-6">
            <label className="flex min-h-12 items-center gap-2"><input type="checkbox" name="is_published" value="on" defaultChecked={rt?.is_published} className="h-5 w-5 accent-[#a0522d]" /> Publiée sur le site</label>
            <AField name="sort_order" label="Ordre" className="w-24"><input id="sort_order" name="sort_order" type="number" min={0} className="input" defaultValue={rt?.sort_order ?? 0} /></AField>
          </div>
        </Panel>
        <SubmitButton pendingLabel="Enregistrement…">Enregistrer la catégorie</SubmitButton>
      </AdminForm>

      {rt && (
        <Panel title="Tarifs par nuit" className="mt-8">
          <p className="mb-4 text-sm text-ink-soft">Une nuit sans tarif n'est pas réservable : les périodes tarifaires définissent aussi les dates de commercialisation. Les périodes ne peuvent pas se chevaucher.</p>
          {rates.length === 0 ? <p className="text-ink-soft">Aucun tarif.</p> : (
            <table className="table mb-5">
              <thead><tr><th>Du</th><th>Au (exclu)</th><th>Par nuit</th><th>Libellé</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {rates.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.starts_on)}</td><td>{formatDate(r.ends_on)}</td><td>{formatMoney(r.nightly_amount, r.currency)}</td><td>{r.label ?? ""}</td>
                    <td><AdminForm action={removeRate} className=""><input type="hidden" name="id" value={r.id} /><SubmitButton pendingLabel="…" className="text-sm text-danger underline">Supprimer</SubmitButton></AdminForm></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {config.currency ? (
            <AdminForm action={addCategoryRate} resetOnSuccess className="grid gap-3 sm:grid-cols-5 sm:items-end">
              <input type="hidden" name="room_type_id" value={rt.id} />
              <AField name="starts_on" label="Du"><input id="starts_on" name="starts_on" type="date" className="input" required /></AField>
              <AField name="ends_on" label="Au (exclu)"><input id="ends_on" name="ends_on" type="date" className="input" required /></AField>
              <AField name="nightly_amount" label={`Prix/nuit (${config.currency})`}><input id="nightly_amount" name="nightly_amount" inputMode="decimal" className="input" required /></AField>
              <AField name="label" label="Libellé"><input id="label" name="label" className="input" placeholder="Saison…" /></AField>
              <SubmitButton pendingLabel="…" className="btn btn-primary">Ajouter</SubmitButton>
            </AdminForm>
          ) : (
            <p className="rounded-md bg-[#f8efdc] p-3 text-warn">Configurez la devise dans les paramètres avant de saisir des tarifs.</p>
          )}
        </Panel>
      )}
    </>
  );
}
