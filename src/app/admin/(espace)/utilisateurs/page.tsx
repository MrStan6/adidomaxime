import { AdminForm } from "@/components/admin/AdminForm";
import { AdminPageHeader, AField, Panel } from "@/components/admin/ui";
import { SubmitButton } from "@/components/ui/form";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/labels";
import { requirePermission } from "@/server/auth/current-user";
import { ROLES } from "@/server/auth/permissions";
import { listUsers } from "@/server/repositories/users";
import { getSiteConfig } from "@/server/settings";
import { inviteUser, resetPassword, updateAccess } from "./actions";

export const metadata = { title: "Utilisateurs" };

const ROLE_HELP: Record<string, string> = {
  admin: "Accès complet, gestion des comptes et des paramètres.",
  commercial: "Demandes, réservations de salles, fiches des salles, contenus. Voit les montants.",
  reception: "Consultation des demandes et salles, messages, réservations de chambres. Sans données financières.",
  comptabilite: "Paiements, factures et chiffre d'affaires. Consultation des réservations.",
};

export default async function UsersPage() {
  const me = await requirePermission("users.manage");
  const [users, config] = await Promise.all([listUsers(), getSiteConfig()]);
  return (
    <>
      <AdminPageHeader title="Utilisateurs" description="Un compte nominatif par personne : ne partagez jamais un mot de passe." />
      <Panel title="Rôles" className="mb-6">
        <dl className="grid gap-3 sm:grid-cols-2">{ROLES.map((r) => <div key={r}><dt className="font-semibold">{ROLE_LABEL[r]}</dt><dd className="text-sm text-ink-soft">{ROLE_HELP[r]}</dd></div>)}</dl>
      </Panel>
      <div className="space-y-3">
        {users.map((u) => (
          <details key={u.id} className="rounded-lg border border-line bg-white">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-4">
              <span><span className="font-semibold">{u.full_name}</span> <span className="text-sm text-ink-soft">{u.email}</span></span>
              <span className="flex gap-2">
                <span className="badge badge-info">{ROLE_LABEL[u.role]}</span>
                {!u.is_active && <span className="badge badge-danger">Désactivé</span>}
                {u.must_change_password && <span className="badge badge-warning">Mot de passe provisoire</span>}
              </span>
            </summary>
            <div className="space-y-5 border-t border-line p-4">
              <p className="text-sm text-ink-soft">Dernière connexion : {u.last_login_at ? formatDateTime(u.last_login_at, config.timezone) : "jamais"}</p>
              <AdminForm action={updateAccess} className="flex flex-wrap items-end gap-4">
                <input type="hidden" name="id" value={u.id} />
                <AField name="full_name" label="Nom"><input id={`n-${u.id}`} name="full_name" className="input" defaultValue={u.full_name} /></AField>
                <AField name="role" label="Rôle">
                  <select id={`r-${u.id}`} name="role" className="input" defaultValue={u.role}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
                </AField>
                <label className="flex min-h-12 items-center gap-2"><input type="checkbox" name="is_active" value="on" defaultChecked={u.is_active} className="h-5 w-5 accent-[#a0522d]" disabled={u.id === me.id} /> Compte actif</label>
                {u.id === me.id && <input type="hidden" name="is_active" value="on" />}
                <SubmitButton pendingLabel="…" className="btn btn-primary btn-sm">Enregistrer</SubmitButton>
              </AdminForm>
              {u.id !== me.id && (
                <AdminForm action={resetPassword}>
                  <input type="hidden" name="id" value={u.id} />
                  <SubmitButton pendingLabel="…" className="btn btn-secondary btn-sm">Réinitialiser le mot de passe</SubmitButton>
                </AdminForm>
              )}
            </div>
          </details>
        ))}
      </div>
      <Panel title="Créer un compte" className="mt-8">
        <AdminForm action={inviteUser} resetOnSuccess>
          <div className="grid gap-4 sm:grid-cols-3">
            <AField name="full_name" label="Nom"><input id="full_name" name="full_name" className="input" required /></AField>
            <AField name="email" label="Adresse électronique"><input id="email" name="email" type="email" className="input" required /></AField>
            <AField name="role" label="Rôle"><select id="role" name="role" className="input" defaultValue="reception">{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></AField>
          </div>
          <SubmitButton pendingLabel="Création…">Créer le compte</SubmitButton>
        </AdminForm>
      </Panel>
    </>
  );
}
