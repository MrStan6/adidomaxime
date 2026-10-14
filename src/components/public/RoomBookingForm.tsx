"use client";

import Link from "next/link";
import { useActionState, useMemo } from "react";
import { submitRoomBooking } from "@/app/(public)/hebergement/reserver/actions";
import { initialFormState } from "@/lib/validation/common";
import { Field, FormGuardFields, FormMessage, SubmitButton, aria } from "../ui/form";

export function RoomBookingForm({
  hidden,
  token,
  submitLabel,
}: {
  hidden: Record<string, string>;
  token: string;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(submitRoomBooking, initialFormState);
  const formKey = useMemo(() => Math.random().toString(36), [state]);
  const errors = state.errors;
  const v = (state.values ?? {}) as Record<string, string | undefined>;
  return (
    <form key={formKey} action={formAction} className="relative space-y-5" noValidate>
      <FormGuardFields token={token} />
      {Object.entries(hidden).map(([k, val]) => <input key={k} type="hidden" name={k} value={val} />)}
      <FormMessage status={state.status} message={state.message} />
      {state.data?.newTotal && (
        <p className="text-sm">
          <Link href="/hebergement" className="link">Relancez la recherche</Link> pour voir le tarif à jour.
        </p>
      )}
      <Field name="full_name" label="Nom et prénom" required error={errors?.full_name}>
        <input className="input" autoComplete="name" required defaultValue={v.full_name} {...aria("full_name", errors)} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="phone" label="Téléphone" required error={errors?.phone}>
          <input className="input" type="tel" autoComplete="tel" required defaultValue={v.phone} {...aria("phone", errors)} />
        </Field>
        <Field name="email" label="Adresse électronique" required error={errors?.email}>
          <input className="input" type="email" autoComplete="email" required defaultValue={v.email} {...aria("email", errors)} />
        </Field>
      </div>
      <Field name="special_requests" label="Demandes particulières" error={errors?.special_requests}>
        <textarea className="input" rows={3} defaultValue={v.special_requests} {...aria("special_requests", errors)} />
      </Field>
      <label className="flex items-start gap-3">
        <input type="checkbox" name="terms" value="on" required className="mt-1 h-5 w-5 shrink-0 accent-[#a0522d]" />
        <span>J'accepte les <Link href="/conditions-reservation" className="link" target="_blank">conditions de réservation</Link> et les <Link href="/conditions-annulation" className="link" target="_blank">conditions d'annulation</Link>. <span aria-hidden className="text-terracotta">*</span></span>
      </label>
      {errors?.terms && <p className="field-error" role="alert">{errors.terms}</p>}
      <label className="flex items-start gap-3">
        <input type="checkbox" name="privacy" value="on" required className="mt-1 h-5 w-5 shrink-0 accent-[#a0522d]" />
        <span>J'accepte la <Link href="/confidentialite" className="link" target="_blank">politique de confidentialité</Link>. <span aria-hidden className="text-terracotta">*</span></span>
      </label>
      {errors?.privacy && <p className="field-error" role="alert">{errors.privacy}</p>}
      <SubmitButton pendingLabel="Enregistrement…" className="btn btn-primary w-full sm:w-auto">{submitLabel}</SubmitButton>
    </form>
  );
}
