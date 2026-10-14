import { AdminForm, FieldError } from "@/components/admin/AdminForm";
import { AdminPageHeader, AField, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { SubmitButton } from "@/components/ui/form";
import { SERVICE_STATUS_LABEL } from "@/lib/labels";
import { requirePermission } from "@/server/auth/current-user";
import { listAllServices, type Service } from "@/server/repositories/services";
import { saveService } from "./actions";

export const metadata = { title: "Services" };

function ServiceForm({ s }: { s?: Service }) {
  const p = s?.id ?? "new";
  return (
    <AdminForm action={saveService} resetOnSuccess={!s} className="space-y-3">
      {s && <input type="hidden" name="id" value={s.id} />}
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_8rem]">
        <AField name="name" label="Nom"><input id={`name-${p}`} name="name" className="input" defaultValue={s?.name} required /></AField>
        <AField name="slug" label="Identifiant"><input id={`slug-${p}`} name="slug" className="input" defaultValue={s?.slug} required /></AField>
        <AField name="icon" label="Icône"><input id={`icon-${p}`} name="icon" className="input" defaultValue={s?.icon ?? "star"} /></AField>
      </div>
      <AField name="description" label="Description"><textarea id={`desc-${p}`} name="description" rows={2} className="input" defaultValue={s?.description} /></AField>
      <div className="flex flex-wrap items-end gap-4">
        <AField name="status" label="Statut réel">
          <select id={`status-${p}`} name="status" className="input" defaultValue={s?.status ?? "planned"}>
            <option value="planned">Envisagé (non disponible)</option>
            <option value="available">Disponible</option>
            <option value="suspended">Suspendu</option>
          </select>
        </AField>
        <AField name="sort_order" label="Ordre" className="w-24"><input id={`sort-${p}`} name="sort_order" type="number" min={0} className="input" defaultValue={s?.sort_order ?? 50} /></AField>
        <div>
          <label className="flex min-h-12 items-center gap-2"><input type="checkbox" name="is_published" value="on" defaultChecked={s?.is_published} className="h-5 w-5 accent-[#a0522d]" /> Publié sur le site</label>
          <FieldError name="is_published" />
        </div>
        <SubmitButton pendingLabel="…" className="btn btn-primary btn-sm">{s ? "Enregistrer" : "Ajouter"}</SubmitButton>
      </div>
    </AdminForm>
  );
}

export default async function ServicesAdminPage() {
  await requirePermission("content.manage");
  const services = await listAllServices();
  return (
    <>
      <AdminPageHeader title="Services" description="Un service n'apparaît sur le site que s'il est à la fois « disponible » et « publié ». Les activités envisagées restent invisibles." />
      <div className="space-y-4">
        {services.map((s) => (
          <details key={s.id} className="rounded-lg border border-line bg-white">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-4">
              <span className="font-semibold">{s.name}</span>
              <span className="flex gap-2">
                <Badge tone={SERVICE_STATUS_LABEL[s.status]!.tone}>{SERVICE_STATUS_LABEL[s.status]!.label}</Badge>
                {s.is_published && s.status === "available" ? <Badge tone="success">Visible sur le site</Badge> : <Badge>Non visible</Badge>}
              </span>
            </summary>
            <div className="border-t border-line p-4"><ServiceForm s={s} /></div>
          </details>
        ))}
      </div>
      <Panel title="Ajouter un service" className="mt-8"><ServiceForm /></Panel>
    </>
  );
}
