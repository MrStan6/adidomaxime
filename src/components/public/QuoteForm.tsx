"use client";

import Link from "next/link";
import { useActionState, useMemo, useRef, useState } from "react";
import { submitQuoteRequest } from "@/app/(public)/devis/actions";
import { EQUIPMENT_OPTIONS, EVENT_TYPES, LAYOUTS, layoutLabel } from "@/lib/labels";
import { quoteRequestSchema } from "@/lib/validation/public-forms";
import { fieldErrors, formDataToObject, initialFormState, todayIso, type FieldErrors } from "@/lib/validation/common";
import { Field, FormGuardFields, FormMessage, SubmitButton, aria } from "../ui/form";
import { Icon } from "../ui/Icon";

type VenueOption = { id: string; name: string; slug: string };

/**
 * Formulaire de demande de devis / de disponibilité.
 * Validation dans le navigateur (retour immédiat) PUIS sur le serveur
 * (seule validation qui fait foi), avec le même schéma.
 */
export function QuoteForm({
  venues,
  defaultVenueSlug,
  defaultType = "quote",
  token,
}: {
  venues: VenueOption[];
  defaultVenueSlug?: string;
  defaultType?: "quote" | "availability";
  token: string;
}) {
  const [state, formAction] = useActionState(submitQuoteRequest, initialFormState);
  const [clientErrors, setClientErrors] = useState<FieldErrors | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // Nouvelle clé à chaque réponse : les valeurs saisies sont restaurées après une erreur.
  const formKey = useMemo(() => Math.random().toString(36), [state]);
  const errors = clientErrors ?? state.errors;
  const v = (state.values ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof v[k] === "string" ? (v[k] as string) : undefined);
  const defaultVenue = str("venue") ?? venues.find((x) => x.slug === defaultVenueSlug)?.id ?? (venues.length ? "" : "recommend");
  const selectedEquipment = Array.isArray(v.equipment) ? (v.equipment as string[]) : [];

  if (state.status === "success" && state.data) {
    const availability = state.data.requestType === "availability";
    return (
      <div className="rounded-lg border border-ok/30 bg-[#eef5f0] p-6 sm:p-8" role="status" tabIndex={-1} ref={(el) => el?.focus()}>
        <Icon name="check" className="h-8 w-8 text-ok" />
        <h2 className="mt-3 text-2xl text-earth">Votre demande est bien enregistrée</h2>
        <p className="mt-3">
          Référence : <strong className="font-semibold">{state.data.reference}</strong>. Conservez-la pour tout échange avec notre équipe.
        </p>
        <p className="mt-3">
          {availability
            ? "Notre équipe vérifie la disponibilité de la date demandée et vous recontacte."
            : "Notre équipe étudie votre demande et vous recontacte pour vous adresser une proposition."}
        </p>
        <p className="mt-3 rounded-md bg-paper p-3 text-sm text-ink-soft">
          Important : cette demande ne constitue pas une réservation. La date n'est réservée qu'après confirmation écrite de l'établissement.
        </p>
        <Link href="/" className="btn btn-secondary mt-6">Retour à l'accueil</Link>
      </div>
    );
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const parsed = quoteRequestSchema.safeParse(formDataToObject(new FormData(e.currentTarget), ["equipment"]));
    if (!parsed.success) {
      e.preventDefault();
      const errs = fieldErrors(parsed.error);
      setClientErrors(errs);
      const first = Object.keys(errs)[0];
      if (first) (formRef.current?.querySelector(`[name="${first}"]`) as HTMLElement | null)?.focus();
    } else {
      setClientErrors(null);
    }
  }

  return (
    <form key={formKey} ref={formRef} action={formAction} onSubmit={onSubmit} noValidate className="relative space-y-8">
      <FormGuardFields token={token} />
      <FormMessage status={clientErrors ? "error" : state.status} message={clientErrors ? "Certains champs sont à corriger." : state.message} />

      <fieldset className="space-y-3">
        <legend className="field-label">Votre demande</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["quote", "Recevoir un devis"],
            ["availability", "Vérifier une disponibilité"],
          ].map(([val, label]) => (
            <label key={val} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border-[1.5px] border-line bg-white px-4 has-[:checked]:border-terracotta has-[:checked]:bg-sand-light">
              <input type="radio" name="request_type" value={val} defaultChecked={(str("request_type") ?? defaultType) === val} className="h-4 w-4 accent-[#a0522d]" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="font-display text-2xl text-earth">Vos coordonnées</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="full_name" label="Nom et prénom" required error={errors?.full_name}>
            <input className="input" autoComplete="name" defaultValue={str("full_name")} {...aria("full_name", errors)} />
          </Field>
          <Field name="organization" label="Entreprise ou organisation" error={errors?.organization}>
            <input className="input" autoComplete="organization" defaultValue={str("organization")} {...aria("organization", errors)} />
          </Field>
          <Field name="phone" label="Téléphone" required error={errors?.phone} hint="Avec l'indicatif du pays, idéalement le numéro WhatsApp.">
            <input className="input" type="tel" inputMode="tel" autoComplete="tel" defaultValue={str("phone")} {...aria("phone", errors, true)} />
          </Field>
          <Field name="email" label="Adresse électronique" required error={errors?.email}>
            <input className="input" type="email" inputMode="email" autoComplete="email" defaultValue={str("email")} {...aria("email", errors)} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="font-display text-2xl text-earth">Votre événement</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="event_type" label="Type d'événement" required error={errors?.event_type}>
            <select className="input" defaultValue={str("event_type") ?? ""} {...aria("event_type", errors)}>
              <option value="" disabled>Choisir…</option>
              {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field name="venue" label="Salle souhaitée" required error={errors?.venue}>
            <select className="input" defaultValue={defaultVenue} {...aria("venue", errors)}>
              <option value="" disabled>Choisir…</option>
              {venues.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              <option value="recommend">Je souhaite une recommandation</option>
            </select>
          </Field>
          <Field name="event_date" label="Date souhaitée" required error={errors?.event_date} hint="Pour plusieurs jours, indiquez le premier et précisez dans le message.">
            <input className="input" type="date" min={todayIso()} defaultValue={str("event_date")} {...aria("event_date", errors, true)} />
          </Field>
          <Field name="participants" label="Nombre estimé de participants" required error={errors?.participants}>
            <input className="input" type="number" inputMode="numeric" min={1} defaultValue={str("participants")} {...aria("participants", errors)} />
          </Field>
          <Field name="start_time" label="Heure de début" required error={errors?.start_time}>
            <input className="input" type="time" defaultValue={str("start_time")} {...aria("start_time", errors)} />
          </Field>
          <Field name="end_time" label="Heure de fin" required error={errors?.end_time}>
            <input className="input" type="time" defaultValue={str("end_time")} {...aria("end_time", errors)} />
          </Field>
          <Field name="layout" label="Configuration souhaitée" error={errors?.layout} className="sm:col-span-2">
            <select className="input" defaultValue={str("layout") ?? ""} {...aria("layout", errors)}>
              <option value="">Pas de préférence / à définir ensemble</option>
              {LAYOUTS.map((l) => <option key={l} value={l}>{layoutLabel[l]}</option>)}
            </select>
          </Field>
        </div>

        <fieldset>
          <legend className="field-label">Équipements nécessaires <span className="font-normal text-ink-soft">(facultatif)</span></legend>
          <p className="field-hint mb-3 mt-0">Indiquez vos besoins ; leur disponibilité vous sera confirmée avec le devis.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {EQUIPMENT_OPTIONS.map((eq) => (
              <label key={eq} className="flex min-h-11 items-center gap-3">
                <input type="checkbox" name="equipment" value={eq} defaultChecked={selectedEquipment.includes(eq)} className="h-5 w-5 accent-[#a0522d]" />
                {eq}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="catering" label="Besoins en restauration" error={errors?.catering} hint="Pause-café, déjeuner, cocktail… Faisabilité confirmée avec le devis.">
            <textarea className="input" rows={3} defaultValue={str("catering")} {...aria("catering", errors, true)} />
          </Field>
          <Field name="budget" label="Budget indicatif" error={errors?.budget}>
            <input className="input" defaultValue={str("budget")} {...aria("budget", errors)} />
          </Field>
        </div>
        <Field name="message" label="Message complémentaire" error={errors?.message}>
          <textarea className="input" rows={5} defaultValue={str("message")} {...aria("message", errors)} />
        </Field>
      </fieldset>

      <div>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="privacy" value="on" className="mt-1 h-5 w-5 shrink-0 accent-[#a0522d]" aria-invalid={errors?.privacy ? true : undefined} aria-describedby={errors?.privacy ? "privacy-error" : undefined} />
          <span>
            J'accepte que mes informations soient utilisées pour traiter ma demande, conformément à la{" "}
            <Link href="/confidentialite" className="link" target="_blank">politique de confidentialité</Link>. <span aria-hidden className="text-terracotta">*</span>
          </span>
        </label>
        {errors?.privacy && <p id="privacy-error" className="field-error" role="alert">{errors.privacy}</p>}
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-soft">Cette demande n'engage ni vous ni l'établissement et ne constitue pas une réservation.</p>
        <SubmitButton pendingLabel="Envoi en cours…">Envoyer ma demande</SubmitButton>
      </div>
    </form>
  );
}
