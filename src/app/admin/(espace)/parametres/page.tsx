import { AdminForm, FieldError } from "@/components/admin/AdminForm";
import { AdminPageHeader, AField, Panel, ToFill } from "@/components/admin/ui";
import { SubmitButton } from "@/components/ui/form";
import { requirePermission } from "@/server/auth/current-user";
import { loadSettings } from "@/server/settings";
import { saveSettings, uploadLogo } from "./actions";

export const metadata = { title: "Paramètres" };

type F = { key: string; label: string; hint?: string; textarea?: boolean; type?: string };

const SECTIONS: { title: string; intro?: string; fields: F[] }[] = [
  { title: "Établissement", fields: [
    { key: "establishment.name", label: "Nom commercial", hint: "Vide : le site affiche « Complexe hôtelier »." },
    { key: "establishment.tagline", label: "Accroche (référencement)" },
    { key: "establishment.timezone", label: "Fuseau horaire", hint: "Format IANA, ex. Africa/Abidjan. Indispensable pour les horaires des réservations." },
    { key: "hours.reception", label: "Horaires d'accueil confirmés", textarea: true },
  ] },
  { title: "Coordonnées", intro: "Un bouton d'appel ou WhatsApp n'apparaît sur le site que si le numéro est renseigné.", fields: [
    { key: "contact.phone", label: "Téléphone officiel", type: "tel" },
    { key: "contact.whatsapp", label: "Numéro WhatsApp", hint: "Au format international : +indicatif puis numéro.", type: "tel" },
    { key: "contact.email", label: "Adresse électronique officielle", type: "email" },
  ] },
  { title: "Adresse et accès", fields: [
    { key: "address.street", label: "Adresse" },
    { key: "address.city", label: "Ville" },
    { key: "address.region", label: "Région" },
    { key: "address.country", label: "Pays" },
    { key: "address.directions", label: "Indications pour venir", textarea: true },
  ] },
  { title: "Point géographique", intro: "La carte n'est affichée que si les coordonnées sont cochées comme vérifiées (relevées sur place ou contrôlées sur une carte).", fields: [
    { key: "geo.latitude", label: "Latitude", hint: "ex. 5.3364" },
    { key: "geo.longitude", label: "Longitude", hint: "ex. -4.0267" },
  ] },
  { title: "Commerce", fields: [
    { key: "commerce.currency", label: "Devise (code ISO)", hint: "ex. XOF, XAF, EUR. Aucun prix n'est affiché sans devise." },
    { key: "commerce.payment_methods", label: "Moyens de paiement acceptés", hint: "Texte informatif." },
  ] },
  { title: "Informations légales", intro: "À compléter et faire valider selon la réglementation du pays de l'établissement.", fields: [
    { key: "legal.company_name", label: "Raison sociale" },
    { key: "legal.legal_form", label: "Forme juridique" },
    { key: "legal.registration_number", label: "Numéro d'immatriculation" },
    { key: "legal.tax_id", label: "Identifiant fiscal" },
    { key: "legal.publication_director", label: "Directeur de la publication" },
    { key: "legal.hosting_provider", label: "Hébergeur du site (nom, adresse)" },
  ] },
  { title: "Réseaux sociaux", fields: [
    { key: "social.facebook", label: "Page Facebook", type: "url" },
    { key: "social.instagram", label: "Compte Instagram", type: "url" },
    { key: "social.linkedin", label: "Page LinkedIn", type: "url" },
  ] },
];

export default async function SettingsPage() {
  await requirePermission("settings.manage");
  const s = await loadSettings();
  return (
    <>
      <AdminPageHeader title="Paramètres de l'établissement" description="Laissez vide toute information non confirmée : l'élément correspondant reste masqué sur le site." />
      <Panel title="Logo" className="mb-6">
        {s["establishment.logo_path"] ? <p className="mb-3">Logo officiel enregistré.</p> : <p className="mb-3"><ToFill>Aucun logo officiel</ToFill> <span className="text-sm text-ink-soft">Un logotype textuel provisoire est affiché.</span></p>}
        <AdminForm action={uploadLogo} className="flex flex-wrap items-end gap-3">
          <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="input max-w-sm py-2" aria-label="Fichier du logo" />
          <SubmitButton pendingLabel="Envoi…" className="btn btn-secondary btn-sm">Enregistrer le logo</SubmitButton>
        </AdminForm>
        {s["establishment.logo_path"] && (
          <AdminForm action={uploadLogo} className="mt-2"><input type="hidden" name="remove" value="1" /><SubmitButton pendingLabel="…" className="text-sm text-danger underline">Retirer le logo</SubmitButton></AdminForm>
        )}
      </Panel>
      <AdminForm action={saveSettings} className="space-y-6">
        {SECTIONS.map((sec) => (
          <Panel key={sec.title} title={sec.title}>
            {sec.intro && <p className="mb-4 text-sm text-ink-soft">{sec.intro}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              {sec.fields.map((f) => (
                <AField key={f.key} name={f.key} label={f.label} hint={f.hint} className={f.textarea ? "sm:col-span-2" : ""}>
                  {f.textarea ? (
                    <textarea id={f.key} name={f.key} rows={3} className="input" defaultValue={s[f.key] ?? ""} />
                  ) : (
                    <input id={f.key} name={f.key} type={f.type ?? "text"} className="input" defaultValue={s[f.key] ?? ""} />
                  )}
                </AField>
              ))}
            </div>
            {sec.title === "Point géographique" && (
              <div className="mt-4">
                <label className="flex items-center gap-2"><input type="checkbox" name="geo.verified" value="on" defaultChecked={s["geo.verified"] === "true"} className="h-5 w-5 accent-[#a0522d]" /> Coordonnées vérifiées</label>
                <FieldError name="geo.verified" />
              </div>
            )}
            {sec.title === "Informations légales" && (
              <label className="mt-4 flex items-start gap-2"><input type="checkbox" name="legal.validated" value="on" defaultChecked={s["legal.validated"] === "true"} className="mt-1 h-5 w-5 accent-[#a0522d]" /> Les pages juridiques ont été complétées et validées par un professionnel du droit.</label>
            )}
          </Panel>
        ))}
        <div className="sticky bottom-0 -mx-5 border-t border-line bg-[#f6f3ee]/95 px-5 py-4 backdrop-blur">
          <SubmitButton pendingLabel="Enregistrement…">Enregistrer les paramètres</SubmitButton>
        </div>
      </AdminForm>
    </>
  );
}
