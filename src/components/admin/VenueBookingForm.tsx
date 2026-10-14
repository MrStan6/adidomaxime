import { AdminForm } from "./AdminForm";
import { AField } from "./ui";
import { SubmitButton } from "../ui/form";
import { createBooking } from "@/app/admin/(espace)/reservations-salles/actions";

type Defaults = {
  venue_id?: string | null;
  title?: string;
  start_date?: string;
  start_time?: string | null;
  end_date?: string;
  end_time?: string | null;
  quote_id?: string;
  customer_id?: string;
  customer_label?: string;
};

/** Création d'une option, d'une réservation ou d'un blocage de salle. */
export function VenueBookingForm({ venues, defaults = {}, kind = "booking", currency }: { venues: { id: string; name: string }[]; defaults?: Defaults; kind?: "booking" | "block"; currency: string | null }) {
  return (
    <AdminForm action={createBooking}>
      <input type="hidden" name="kind" value={kind} />
      {defaults.quote_id && <input type="hidden" name="quote_id" value={defaults.quote_id} />}
      {defaults.customer_id && <input type="hidden" name="customer_id" value={defaults.customer_id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <AField name="venue_id" label="Salle">
          <select id="venue_id" name="venue_id" className="input" defaultValue={defaults.venue_id ?? ""} required>
            <option value="" disabled>Choisir…</option>
            {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </AField>
        <AField name="title" label={kind === "block" ? "Motif détaillé" : "Intitulé de l'événement"}>
          <input id="title" name="title" className="input" defaultValue={defaults.title} required />
        </AField>
        <AField name="start_date" label="Début (date)"><input id="start_date" name="start_date" type="date" className="input" defaultValue={defaults.start_date} required /></AField>
        <AField name="start_time" label="Début (heure)"><input id="start_time" name="start_time" type="time" className="input" defaultValue={defaults.start_time ?? "08:00"} required /></AField>
        <AField name="end_date" label="Fin (date)"><input id="end_date" name="end_date" type="date" className="input" defaultValue={defaults.end_date ?? defaults.start_date} required /></AField>
        <AField name="end_time" label="Fin (heure)"><input id="end_time" name="end_time" type="time" className="input" defaultValue={defaults.end_time ?? "18:00"} required /></AField>
      </div>

      {kind === "block" ? (
        <AField name="block_reason" label="Type de blocage">
          <select id="block_reason" name="block_reason" className="input" defaultValue="maintenance">
            <option value="maintenance">Maintenance</option>
            <option value="internal">Usage interne</option>
            <option value="works">Travaux</option>
            <option value="other">Autre</option>
          </select>
        </AField>
      ) : (
        <>
          {defaults.customer_id ? (
            <p className="rounded-md bg-sand-light p-3 text-[0.95rem]">Client : <strong>{defaults.customer_label}</strong></p>
          ) : (
            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="field-label">Client</legend>
              <AField name="customer_name" label="Nom"><input id="customer_name" name="customer_name" className="input" /></AField>
              <AField name="customer_organization" label="Organisation"><input id="customer_organization" name="customer_organization" className="input" /></AField>
              <AField name="customer_phone" label="Téléphone"><input id="customer_phone" name="customer_phone" type="tel" className="input" /></AField>
              <AField name="customer_email" label="Courriel"><input id="customer_email" name="customer_email" type="email" className="input" /></AField>
            </fieldset>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <AField name="status" label="Statut">
              <select id="status" name="status" className="input" defaultValue="option">
                <option value="option">Option (date retenue, non confirmée)</option>
                <option value="confirmed">Réservation confirmée</option>
              </select>
            </AField>
            <AField name="option_expires_on" label="Option valable jusqu'au" hint="Pour une option uniquement.">
              <input id="option_expires_on" name="option_expires_on" type="date" className="input" />
            </AField>
            <AField name="amount" label={`Montant convenu${currency ? ` (${currency})` : ""}`} hint={currency ? undefined : "Devise non configurée : montant indisponible."}>
              <input id="amount" name="amount" inputMode="decimal" className="input" disabled={!currency} />
            </AField>
          </div>
          <label className="flex items-start gap-3 text-[0.95rem]">
            <input type="checkbox" name="conditions_met" value="on" className="mt-1 h-5 w-5 accent-[#a0522d]" />
            <span>Pour une réservation confirmée : je confirme que les conditions définies par la direction sont remplies (devis accepté, acompte reçu le cas échéant).</span>
          </label>
        </>
      )}
      <AField name="notes" label="Notes internes"><textarea id="notes" name="notes" className="input" rows={3} /></AField>
      <SubmitButton pendingLabel="Enregistrement…">{kind === "block" ? "Bloquer la période" : "Enregistrer"}</SubmitButton>
    </AdminForm>
  );
}
