"use client";

import { useActionState, useState } from "react";
import { login } from "../actions";
import { initialFormState } from "@/lib/validation/common";
import { FormMessage, SubmitButton } from "@/components/ui/form";

export function LoginForm() {
  const [state, action] = useActionState(login, initialFormState);
  // Champ contrôlé : l'adresse reste saisie après un échec (React réinitialise
  // sinon le formulaire à chaque soumission). Le mot de passe, lui, est vidé.
  const [email, setEmail] = useState("");
  return (
    <form action={action} className="space-y-5">
      <FormMessage status={state.status} message={state.message} />
      <div>
        <label htmlFor="email" className="field-label">Adresse électronique</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label htmlFor="password" className="field-label">Mot de passe</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      <SubmitButton pendingLabel="Connexion…" className="btn btn-primary w-full">Se connecter</SubmitButton>
    </form>
  );
}
