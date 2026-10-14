import { AdminForm } from "@/components/admin/AdminForm";
import { AdminPageHeader, AField, Panel } from "@/components/admin/ui";
import { SubmitButton } from "@/components/ui/form";
import { ROLE_LABEL } from "@/lib/labels";
import { requireUser } from "@/server/auth/current-user";
import { changePassword } from "./actions";

export const metadata = { title: "Mon compte" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <AdminPageHeader title="Mon compte" description={`${user.full_name}, ${user.email} (${ROLE_LABEL[user.role]})`} />
      {user.must_change_password && (
        <p role="alert" className="mb-6 rounded-md border border-warn/30 bg-[#f8efdc] p-4 text-warn">Votre mot de passe est provisoire : choisissez-en un nouveau pour accéder à l'administration.</p>
      )}
      <Panel title="Changer de mot de passe" className="max-w-lg">
        <AdminForm action={changePassword} resetOnSuccess>
          <AField name="current" label="Mot de passe actuel"><input id="current" name="current" type="password" autoComplete="current-password" className="input" required /></AField>
          <AField name="next" label="Nouveau mot de passe" hint="12 caractères minimum, avec au moins une lettre et un chiffre. Une phrase de passe est idéale."><input id="next" name="next" type="password" autoComplete="new-password" className="input" required minLength={12} /></AField>
          <AField name="confirm" label="Confirmer le nouveau mot de passe"><input id="confirm" name="confirm" type="password" autoComplete="new-password" className="input" required /></AField>
          <SubmitButton pendingLabel="Enregistrement…">Changer le mot de passe</SubmitButton>
        </AdminForm>
      </Panel>
    </>
  );
}
