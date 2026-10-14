import { AdminForm } from "@/components/admin/AdminForm";
import { AdminPageHeader, AField, Panel } from "@/components/admin/ui";
import { SubmitButton } from "@/components/ui/form";
import { formatDateShort } from "@/lib/format";
import { requirePermission } from "@/server/auth/current-user";
import { listContentBlocks } from "@/server/content";
import { listAllFaqs, type Faq } from "@/server/repositories/faqs";
import { removeFaq, saveBlock, saveFaq } from "./actions";

export const metadata = { title: "Textes et FAQ" };

const GROUPS: { prefix: string; label: string }[] = [
  { prefix: "home.", label: "Page d'accueil" },
  { prefix: "hotel.", label: "Page « L'hôtel »" },
  { prefix: "salles.", label: "Page des salles" },
  { prefix: "hebergement.", label: "Page hébergement" },
  { prefix: "services.", label: "Page services" },
  { prefix: "contact.", label: "Page contact" },
  { prefix: "legal.", label: "Pages juridiques" },
];
const HINTS: Record<string, string> = {
  "home.strengths": "Une ligne par atout, au format « Titre | Texte ». Uniquement des atouts confirmés. Vide = section masquée.",
  "contact.practical": "Accès aux salles, stationnement, consignes… Vide = section masquée.",
};

function FaqForm({ f }: { f?: Faq }) {
  const p = f?.id ?? "new";
  return (
    <AdminForm action={saveFaq} resetOnSuccess={!f} className="space-y-3">
      {f && <input type="hidden" name="id" value={f.id} />}
      <AField name="question" label="Question"><input id={`q-${p}`} name="question" className="input" defaultValue={f?.question} required /></AField>
      <AField name="answer" label="Réponse"><textarea id={`a-${p}`} name="answer" rows={3} className="input" defaultValue={f?.answer} required /></AField>
      <div className="flex flex-wrap items-end gap-4">
        <AField name="category" label="Rubrique">
          <select id={`c-${p}`} name="category" className="input" defaultValue={f?.category ?? "general"}>
            <option value="general">Générale</option><option value="salles">Salles</option><option value="hebergement">Hébergement</option><option value="paiement">Paiement</option>
          </select>
        </AField>
        <AField name="sort_order" label="Ordre" className="w-24"><input id={`o-${p}`} name="sort_order" type="number" min={0} className="input" defaultValue={f?.sort_order ?? 0} /></AField>
        <label className="flex min-h-12 items-center gap-2"><input type="checkbox" name="is_published" value="on" defaultChecked={f?.is_published} className="h-5 w-5 accent-[#a0522d]" /> Publiée</label>
        <SubmitButton pendingLabel="…" className="btn btn-primary btn-sm">{f ? "Enregistrer" : "Ajouter"}</SubmitButton>
      </div>
    </AdminForm>
  );
}

export default async function ContentPage() {
  await requirePermission("content.manage");
  const [blocks, faqs] = await Promise.all([listContentBlocks(), listAllFaqs()]);
  return (
    <>
      <AdminPageHeader title="Textes et FAQ" description="Les modifications sont visibles immédiatement sur le site. Séparez les paragraphes par une ligne vide. N'écrivez que des informations confirmées." />
      <div className="space-y-8">
        {GROUPS.map((g) => (
          <Panel key={g.prefix} title={g.label}>
            <div className="space-y-3">
              {blocks.filter((b) => b.key.startsWith(g.prefix)).map((b) => (
                <details key={b.key} className="rounded-md border border-line">
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <span className="font-medium">{b.title || b.key}</span>
                    <span className="flex items-center gap-2 text-xs text-ink-soft">
                      {/À RENSEIGNER|MODÈLE À/i.test(b.body) && <span className="badge badge-warning">À compléter</span>}
                      {!b.body.trim() && <span className="badge badge-neutral">Vide (masqué)</span>}
                      Modifié le {formatDateShort(b.updated_at)}
                    </span>
                  </summary>
                  <div className="border-t border-line p-4">
                    <AdminForm action={saveBlock} className="space-y-3">
                      <input type="hidden" name="key" value={b.key} />
                      <AField name="title" label="Titre"><input id={`t-${b.key}`} name="title" className="input" defaultValue={b.title} /></AField>
                      <AField name="body" label="Texte" hint={HINTS[b.key]}><textarea id={`b-${b.key}`} name="body" rows={b.key.startsWith("legal.") ? 16 : 6} className="input font-[inherit]" defaultValue={b.body} /></AField>
                      <SubmitButton pendingLabel="Enregistrement…" className="btn btn-primary btn-sm">Enregistrer</SubmitButton>
                    </AdminForm>
                  </div>
                </details>
              ))}
            </div>
          </Panel>
        ))}

        <Panel title="Questions fréquentes">
          <p className="mb-4 text-sm text-ink-soft">Les questions publiées s'affichent sur la page Contact.</p>
          <div className="space-y-3">
            {faqs.map((f) => (
              <details key={f.id} className="rounded-md border border-line">
                <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3"><span>{f.question}</span>{f.is_published ? <span className="badge badge-success">Publiée</span> : <span className="badge badge-neutral">Brouillon</span>}</summary>
                <div className="border-t border-line p-4">
                  <FaqForm f={f} />
                  <form action={removeFaq} className="mt-3"><input type="hidden" name="id" value={f.id} /><button className="text-sm text-danger underline">Supprimer</button></form>
                </div>
              </details>
            ))}
          </div>
          <h3 className="mb-3 mt-6 font-semibold">Ajouter une question</h3>
          <FaqForm />
        </Panel>
      </div>
    </>
  );
}
