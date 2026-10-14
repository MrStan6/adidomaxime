"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef } from "react";
import { initialFormState, type FormState } from "@/lib/validation/common";
import { FormMessage, FormPendingContext } from "../ui/form";

const ErrorsCtx = createContext<Record<string, string> | undefined>(undefined);

/**
 * Formulaire d'administration générique : exécute une action serveur et
 * affiche le message de retour ainsi que les erreurs par champ.
 */
export function AdminForm({
  action,
  children,
  className = "space-y-5",
  resetOnSuccess = false,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success" && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  // Soumission gérée ici plutôt que par <form action> : React réinitialise
  // sinon tous les champs après chaque envoi, y compris en cas d'erreur de
  // validation, et l'utilisateur perdrait sa saisie. `action` reste défini
  // pour le fonctionnement sans JavaScript.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const fd = new FormData(e.currentTarget, submitter instanceof HTMLElement ? submitter : null);
    startTransition(() => formAction(fd));
  }

  return (
    <ErrorsCtx.Provider value={state.errors}>
      <FormPendingContext.Provider value={pending}>
        <form ref={ref} action={formAction} onSubmit={onSubmit} className={className}>
          <FormMessage status={state.status} message={state.message} />
          {children}
        </form>
      </FormPendingContext.Provider>
    </ErrorsCtx.Provider>
  );
}

export function FieldError({ name }: { name: string }) {
  const errors = useContext(ErrorsCtx);
  const e = errors?.[name];
  return e ? <p className="field-error" role="alert">{e}</p> : null;
}
