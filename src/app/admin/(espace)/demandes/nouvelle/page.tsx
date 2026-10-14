import { AdminForm } from "@/components/admin/AdminForm";
import { AdminPageHeader, AField, Panel } from "@/components/admin/ui";
import { SubmitButton } from "@/components/ui/form";
import { EVENT_TYPES } from "@/lib/labels";
import { requirePermission } from "@/server/auth/current-user";
import { venueOptions } from "@/server/repositories/venues";
import { createManualQuote } from "../actions";

export const metadata = { title: "Saisir une demande" };

export default async function NewQuotePage() {
  await requirePermission("quotes.manage");
  const venues = await venueOptions(false);
  return (
    <>
      <AdminPageHeader title="Saisir une demande" description="Pour centraliser les demandes reçues par WhatsApp, téléphone, courriel ou sur place." />
      <Panel>
        <AdminForm action={createManualQuote}>
          <div className="grid gap-4 sm:grid-cols-2">
            <AField name="source" label="Canal">
              <select id="source" name="source" className="input" defaultValue="whatsapp">
                <option value="whatsapp">WhatsApp</option><option value="phone">Téléphone</option><option value="email">Courriel</option><option value="walk_in">Visite sur place</option><option value="other">Autre</option>
              </select>
            </AField>
            <AField name="request_type" label="Type">
              <select id="request_type" name="request_type" className="input"><option value="quote">Devis</option><option value="availability">Disponibilité</option></select>
            </AField>
            <AField name="full_name" label="Nom du demandeur"><input id="full_name" name="full_name" className="input" required /></AField>
            <AField name="organization" label="Organisation"><input id="organization" name="organization" className="input" /></AField>
            <AField name="phone" label="Téléphone"><input id="phone" name="phone" type="tel" className="input" required /></AField>
            <AField name="email" label="Courriel (facultatif)"><input id="email" name="email" type="email" className="input" /></AField>
            <AField name="event_type" label="Type d'événement">
              <select id="event_type" name="event_type" className="input">{EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            </AField>
            <AField name="venue_id" label="Salle">
              <select id="venue_id" name="venue_id" className="input"><option value="">À déterminer</option>{venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
            </AField>
            <AField name="event_date" label="Date"><input id="event_date" name="event_date" type="date" className="input" required /></AField>
            <AField name="participants" label="Participants"><input id="participants" name="participants" type="number" min={1} className="input" required /></AField>
            <AField name="start_time" label="Début"><input id="start_time" name="start_time" type="time" className="input" /></AField>
            <AField name="end_time" label="Fin"><input id="end_time" name="end_time" type="time" className="input" /></AField>
          </div>
          <AField name="message" label="Détails"><textarea id="message" name="message" rows={4} className="input" /></AField>
          <SubmitButton pendingLabel="Enregistrement…">Enregistrer la demande</SubmitButton>
        </AdminForm>
      </Panel>
    </>
  );
}
