import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminForm } from "@/components/admin/AdminForm";
import { AdminPageHeader, AField, Panel } from "@/components/admin/ui";
import { SubmitButton } from "@/components/ui/form";
import { LAYOUTS, layoutLabel } from "@/lib/labels";
import { requirePermission } from "@/server/auth/current-user";
import { getVenue } from "@/server/repositories/venues";
import { getSiteConfig } from "@/server/settings";
import { saveVenue } from "../actions";

export const metadata = { title: "Modifier une salle" };

export default async function EditVenuePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("venues.manage");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [v, config] = await Promise.all([getVenue(id), getSiteConfig()]);
  if (!v) notFound();
  const cap = (l: string) => v.capacities.find((c) => c.layout === l);
  return (
    <>
      <Link href="/admin/salles" className="link text-sm">Toutes les salles</Link>
      <AdminPageHeader title={v.name} actions={<Link href={`/salles/${v.slug}`} target="_blank" className="btn btn-secondary btn-sm">Voir sur le site</Link>} />
      <AdminForm action={saveVenue} className="space-y-6">
        <input type="hidden" name="id" value={v.id} />
        <Panel title="Présentation">
          <div className="grid gap-4 sm:grid-cols-2">
            <AField name="name" label="Nom" hint="Laissez « (nom provisoire) » tant que le nom n'est pas validé."><input id="name" name="name" className="input" defaultValue={v.name} required /></AField>
            <AField name="slug" label="Adresse de la page" hint={`/salles/${v.slug}`}><input id="slug" name="slug" className="input" defaultValue={v.slug} required /></AField>
          </div>
          <div className="mt-4 space-y-4">
            <AField name="short_description" label="Résumé (cartes et référencement)"><textarea id="short_description" name="short_description" rows={2} className="input" defaultValue={v.short_description} /></AField>
            <AField name="description" label="Description complète" hint="Séparez les paragraphes par une ligne vide."><textarea id="description" name="description" rows={7} className="input" defaultValue={v.description} /></AField>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2"><input type="checkbox" name="is_published" value="on" defaultChecked={v.is_published} className="h-5 w-5 accent-[#a0522d]" /> Publiée sur le site</label>
            <AField name="sort_order" label="Ordre d'affichage" className="w-32"><input id="sort_order" name="sort_order" type="number" min={0} className="input" defaultValue={v.sort_order} /></AField>
          </div>
        </Panel>

        <Panel title="Dimensions et capacités">
          <AField name="area_m2" label="Superficie (m²)" hint="Laisser vide tant qu'elle n'est pas confirmée." className="max-w-xs">
            <input id="area_m2" name="area_m2" inputMode="decimal" className="input" defaultValue={v.area_m2 ?? ""} />
          </AField>
          <p className="mt-5 text-sm text-ink-soft">Indiquez la capacité par configuration. Cochez « validée » uniquement après vérification : sinon elle reste masquée sur le site.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="table">
              <thead><tr><th>Configuration</th><th>Capacité (personnes)</th><th>Validée</th></tr></thead>
              <tbody>
                {LAYOUTS.map((l) => (
                  <tr key={l}>
                    <td>{l === "other" ? <input name="cap_other_label" aria-label="Nom de la configuration personnalisée" placeholder="Autre (préciser)" className="input" defaultValue={cap(l)?.label ?? ""} /> : layoutLabel[l]}</td>
                    <td><input name={`cap_${l}`} aria-label={`Capacité ${layoutLabel[l]}`} type="number" min={1} className="input max-w-32" defaultValue={cap(l)?.capacity ?? ""} /></td>
                    <td><input type="checkbox" name={`val_${l}`} value="on" aria-label={`Capacité ${layoutLabel[l]} validée`} defaultChecked={cap(l)?.is_validated} className="h-5 w-5 accent-[#a0522d]" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Équipements et services">
          <p className="mb-3 text-sm text-ink-soft">Un élément par ligne. Ne listez que ce qui est réellement disponible.</p>
          <div className="grid gap-4 md:grid-cols-3">
            <AField name="equipment" label="Équipements disponibles"><textarea id="equipment" name="equipment" rows={6} className="input" defaultValue={v.equipment.join("\n")} /></AField>
            <AField name="included_services" label="Services inclus"><textarea id="included_services" name="included_services" rows={6} className="input" defaultValue={v.included_services.join("\n")} /></AField>
            <AField name="optional_services" label="Services en option"><textarea id="optional_services" name="optional_services" rows={6} className="input" defaultValue={v.optional_services.join("\n")} /></AField>
          </div>
        </Panel>

        <Panel title="Tarif et conditions">
          <div className="grid gap-4 sm:grid-cols-3">
            <AField name="pricing_mode" label="Affichage du tarif">
              <select id="pricing_mode" name="pricing_mode" className="input" defaultValue={v.pricing_mode}>
                <option value="on_request">Tarif sur demande</option>
                <option value="published" disabled={!config.currency}>Tarif publié (« à partir de »){config.currency ? "" : " — devise non configurée"}</option>
              </select>
            </AField>
            <AField name="price_amount" label={`Montant${config.currency ? ` (${config.currency})` : ""}`}><input id="price_amount" name="price_amount" inputMode="decimal" className="input" defaultValue={v.price_amount ?? ""} /></AField>
            <AField name="price_unit" label="Unité" hint="ex. « par demi-journée »"><input id="price_unit" name="price_unit" className="input" defaultValue={v.price_unit ?? ""} /></AField>
          </div>
          <AField name="booking_conditions" label="Conditions de réservation (résumé)" className="mt-4"><textarea id="booking_conditions" name="booking_conditions" rows={3} className="input" defaultValue={v.booking_conditions} /></AField>
        </Panel>
        <div className="sticky bottom-0 -mx-5 border-t border-line bg-[#f6f3ee]/95 px-5 py-4 backdrop-blur">
          <SubmitButton pendingLabel="Enregistrement…">Enregistrer la fiche</SubmitButton>
        </div>
      </AdminForm>
    </>
  );
}
