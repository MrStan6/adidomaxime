"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { submitContact } from "@/app/(public)/contact/actions";
import { CONTACT_TOPICS, contactTopicLabel } from "@/lib/labels";
import { contactSchema } from "@/lib/validation/public-forms";
import { fieldErrors, formDataToObject, initialFormState, type FieldErrors } from "@/lib/validation/common";
import { Field, FormGuardFields, FormMessage, SubmitButton, aria } from "../ui/form";

export function ContactForm({ token, defaultTopic }: { token: string; defaultTopic?: string }) {
  const [state, formAction] = useActionState(submitContact, initialFormState);
  const [clientErrors, setClientErrors] = useState<FieldErrors | null>(null);
  const formKey = useMemo(() => Math.random().toString(36), [state]);
  const errors = clientErrors ?? state.errors;
  const v = (state.values ?? {}) as Record<string, string | undefined>;

  if (state.status === "success") return <FormMessage status="success" message={state.message} />;

  return (
    <form
      key={formKey}
      action={formAction}
      noValidate
      className="relative space-y-5"
      onSubmit={(e) => {
        const r = contactSchema.safeParse(formDataToObject(new FormData(e.currentTarget)));
        if (!r.success) {
          e.preventDefault();
          setClientErrors(fieldErrors(r.error));
        } else setClientErrors(null);
      }}
    >
      <FormGuardFields token={token} />
      <FormMessage status={clientErrors ? "error" : state.status} message={clientErrors ? "Certains champs sont à corriger." : state.message} />
      <Field name="full_name" label="Nom" required error={errors?.full_name}>
        <input className="input" autoComplete="name" defaultValue={v.full_name} {...aria("full_name", errors)} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="phone" label="Téléphone" error={errors?.phone}>
          <input className="input" type="tel" autoComplete="tel" defaultValue={v.phone} {...aria("phone", errors)} />
        </Field>
        <Field name="email" label="Adresse électronique" error={errors?.email} hint="Indiquez au moins un téléphone ou une adresse.">
          <input className="input" type="email" autoComplete="email" defaultValue={v.email} {...aria("email", errors, true)} />
        </Field>
      </div>
      <Field name="topic" label="Sujet" required error={errors?.topic}>
        <select className="input" defaultValue={v.topic ?? defaultTopic ?? "general"} {...aria("topic", errors)}>
          {CONTACT_TOPICS.map((t) => <option key={t} value={t}>{contactTopicLabel[t]}</option>)}
        </select>
      </Field>
      <Field name="message" label="Message" required error={errors?.message}>
        <textarea className="input" rows={6} defaultValue={v.message} {...aria("message", errors)} />
      </Field>
      <div>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="privacy" value="on" className="mt-1 h-5 w-5 shrink-0 accent-[#a0522d]" aria-invalid={errors?.privacy ? true : undefined} />
          <span>J'accepte que mes informations soient utilisées pour répondre à mon message (<Link href="/confidentialite" className="link" target="_blank">politique de confidentialité</Link>). <span aria-hidden className="text-terracotta">*</span></span>
        </label>
        {errors?.privacy && <p className="field-error" role="alert">{errors.privacy}</p>}
      </div>
      <SubmitButton pendingLabel="Envoi en cours…">Envoyer le message</SubmitButton>
    </form>
  );
}
