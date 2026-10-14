import Image from "next/image";
import { AdminForm } from "@/components/admin/AdminForm";
import { AdminPageHeader, AField, EmptyState, Panel } from "@/components/admin/ui";
import { SubmitButton } from "@/components/ui/form";
import { MEDIA_CATEGORIES, mediaCategoryLabel } from "@/lib/labels";
import { mediaUrl } from "@/lib/media-url";
import { requirePermission } from "@/server/auth/current-user";
import { listAllRoomTypes } from "@/server/booking/rooms";
import { listAllMedia } from "@/server/repositories/media";
import { venueOptions } from "@/server/repositories/venues";
import { env } from "@/server/env";
import { removeMedia, saveMedia, uploadMedia } from "./actions";

export const metadata = { title: "Photos" };

type Opt = { id: string; name: string };

function Selects({ venues, roomTypes, d }: { venues: Opt[]; roomTypes: Opt[]; d: { category?: string; venue_id?: string | null; room_type_id?: string | null; prefix: string } }) {
  return (
    <>
      <AField name="category" label="Catégorie">
        <select id={`${d.prefix}category`} name="category" className="input" defaultValue={d.category ?? "etablissement"}>
          {MEDIA_CATEGORIES.map((c) => <option key={c} value={c}>{mediaCategoryLabel[c]}</option>)}
        </select>
      </AField>
      <AField name="venue_id" label="Salle associée">
        <select id={`${d.prefix}venue_id`} name="venue_id" className="input" defaultValue={d.venue_id ?? ""}>
          <option value="">Aucune</option>
          {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </AField>
      <AField name="room_type_id" label="Chambre associée">
        <select id={`${d.prefix}room_type_id`} name="room_type_id" className="input" defaultValue={d.room_type_id ?? ""}>
          <option value="">Aucune</option>
          {roomTypes.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </AField>
    </>
  );
}

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ salle?: string }> }) {
  await requirePermission("content.manage");
  const { salle } = await searchParams;
  const [all, venues, roomTypes] = await Promise.all([listAllMedia(), venueOptions(false), listAllRoomTypes()]);
  const media = salle ? all.filter((m) => m.venue_id === salle) : all;
  return (
    <>
      <AdminPageHeader title="Photos" description="Les photos sont redimensionnées et leurs métadonnées (dont la localisation GPS) supprimées automatiquement." />
      <Panel title="Ajouter une photo" className="mb-8">
        <AdminForm action={uploadMedia} resetOnSuccess>
          <AField name="file" label={`Image (JPEG, PNG ou WebP, ${env().UPLOAD_MAX_MB} Mo max.)`}>
            <input id="file" name="file" type="file" accept="image/jpeg,image/png,image/webp" required className="input py-2" />
          </AField>
          <div className="grid gap-4 sm:grid-cols-3">
            <Selects venues={venues} roomTypes={roomTypes} d={{ venue_id: salle, category: salle ? "salles" : undefined, prefix: "new-" }} />
          </div>
          <AField name="alt" label="Description de l'image (texte alternatif)" hint="Décrivez ce que montre la photo, ex. « Salle 1 en configuration théâtre, vue depuis l'entrée ».">
            <input id="alt" name="alt" className="input" required />
          </AField>
          <AField name="caption" label="Légende (facultatif)"><input id="caption" name="caption" className="input" /></AField>
          <label className="flex items-start gap-3 text-[0.95rem]">
            <input type="checkbox" name="authentic" value="on" required className="mt-1 h-5 w-5 accent-[#a0522d]" />
            Je confirme que cette photo représente réellement l&apos;établissement et que nous avons le droit de la publier.
          </label>
          <SubmitButton pendingLabel="Envoi…">Ajouter la photo</SubmitButton>
        </AdminForm>
      </Panel>

      {media.length === 0 ? (
        <EmptyState title="Aucune photo." />
      ) : (
        <ul className="grid gap-5 md:grid-cols-2">
          {media.map((m) => (
            <li key={m.id} className="rounded-lg border border-line bg-white p-4">
              <div className="relative aspect-[4/3] overflow-hidden rounded bg-sand">
                <Image src={mediaUrl(m.file_path)} alt={m.alt} fill sizes="(min-width: 768px) 40vw, 90vw" unoptimized={m.file_path.endsWith(".svg")} className="object-cover" />
                {m.is_placeholder && <span className="badge badge-warning absolute left-2 top-2">Visuel provisoire</span>}
              </div>
              <AdminForm action={saveMedia} className="mt-4 space-y-3">
                <input type="hidden" name="id" value={m.id} />
                <AField name="alt" label="Texte alternatif"><input id={`alt-${m.id}`} name="alt" className="input" defaultValue={m.alt} /></AField>
                <AField name="caption" label="Légende"><input id={`caption-${m.id}`} name="caption" className="input" defaultValue={m.caption ?? ""} /></AField>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Selects venues={venues} roomTypes={roomTypes} d={{ category: m.category, venue_id: m.venue_id, room_type_id: m.room_type_id, prefix: `${m.id}-` }} />
                </div>
                <div className="flex flex-wrap items-end gap-4">
                  <label className="flex min-h-12 items-center gap-2"><input type="checkbox" name="is_published" value="on" defaultChecked={m.is_published} className="h-5 w-5 accent-[#a0522d]" /> Publiée</label>
                  <AField name="sort_order" label="Ordre" className="w-24"><input id={`sort-${m.id}`} name="sort_order" type="number" min={0} className="input" defaultValue={m.sort_order} /></AField>
                  <SubmitButton pendingLabel="…" className="btn btn-secondary btn-sm">Enregistrer</SubmitButton>
                </div>
              </AdminForm>
              <form action={removeMedia} className="mt-2">
                <input type="hidden" name="id" value={m.id} />
                <button className="text-sm text-danger underline">Supprimer cette photo</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
