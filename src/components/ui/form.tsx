"use client";

import { createContext, useContext } from "react";
import { useFormStatus } from "react-dom";

/**
 * État « envoi en cours » fourni par un formulaire qui gère lui-même sa
 * soumission (voir AdminForm). null = utiliser useFormStatus.
 */
export const FormPendingContext = createContext<boolean | null>(null);

/** Champ de formulaire accessible : libellé lié, aide, erreur annoncée. */
export function Field({
  name,
  label,
  error,
  hint,
  required,
  children,
  className = "",
}: {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={name} className="field-label">
        {label} {required ? <span aria-hidden className="text-terracotta">*</span> : <span className="font-normal text-ink-soft">(facultatif)</span>}
      </label>
      {children}
      {hint && !error && <p id={`${name}-hint`} className="field-hint">{hint}</p>}
      {error && <p id={`${name}-error`} className="field-error" role="alert">{error}</p>}
    </div>
  );
}

/** Attributs ARIA d'un champ selon son état d'erreur. */
export function aria(name: string, errors?: Record<string, string>, hint = false) {
  const err = errors?.[name];
  return {
    id: name,
    name,
    "aria-invalid": err ? (true as const) : undefined,
    "aria-describedby": err ? `${name}-error` : hint ? `${name}-hint` : undefined,
  };
}

export function SubmitButton({ children, pendingLabel, className = "btn btn-primary" }: { children: React.ReactNode; pendingLabel: string; className?: string }) {
  const status = useFormStatus();
  const pending = useContext(FormPendingContext) ?? status.pending;
  return (
    <button type="submit" className={className} disabled={pending} aria-disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

/** Champs anti-robots invisibles (pot de miel + jeton horodaté). */
export function FormGuardFields({ token }: { token: string }) {
  return (
    <>
      <input type="hidden" name="form_token" value={token} />
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Ne pas remplir ce champ
          <input type="text" name="website_url" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
    </>
  );
}

export function FormMessage({ status, message }: { status: string; message?: string }) {
  if (!message || status === "idle") return null;
  return (
    <div role={status === "error" ? "alert" : "status"} className={`rounded-md border px-4 py-3 ${status === "error" ? "border-danger/40 bg-[#fbeeec] text-danger" : "border-ok/40 bg-[#e9f3ec] text-ok"}`}>
      {message}
    </div>
  );
}
