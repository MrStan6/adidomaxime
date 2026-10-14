import { AdminForm } from "@/components/admin/AdminForm";
import { AdminPageHeader, EmptyState, FilterLinks } from "@/components/admin/ui";
import { SubmitButton } from "@/components/ui/form";
import { formatDateTime } from "@/lib/format";
import { contactTopicLabel } from "@/lib/labels";
import { mailtoLink, telLink } from "@/lib/contact-links";
import { requirePermission } from "@/server/auth/current-user";
import { hasPermission } from "@/server/auth/permissions";
import { listContactMessages } from "@/server/repositories/contact";
import { getSiteConfig } from "@/server/settings";
import { updateMessageStatus } from "./actions";

export const metadata = { title: "Messages" };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const user = await requirePermission("messages.view");
  const { statut } = await searchParams;
  const status = ["new", "handled", "archived"].includes(statut ?? "") ? statut : "new";
  const [messages, config] = await Promise.all([listContactMessages(status), getSiteConfig()]);
  const canManage = hasPermission(user.role, "messages.manage");
  return (
    <>
      <AdminPageHeader title="Messages de contact" />
      <FilterLinks base="/admin/messages" param="statut" current={status} showAll={false} options={[{ value: "new", label: "Non traités" }, { value: "handled", label: "Traités" }, { value: "archived", label: "Archivés" }]} />
      {messages.length === 0 ? <EmptyState title="Aucun message." /> : (
        <ul className="space-y-4">
          {messages.map((m) => (
            <li key={m.id} className="rounded-lg border border-line bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{m.full_name} <span className="badge badge-neutral ml-1">{contactTopicLabel[m.topic as keyof typeof contactTopicLabel]}</span></p>
                  <p className="text-sm">
                    {m.phone && <a href={telLink(m.phone) ?? "#"} className="link mr-3">{m.phone}</a>}
                    {m.email && <a href={mailtoLink(m.email, "Votre message") ?? "#"} className="link">{m.email}</a>}
                  </p>
                </div>
                <p className="text-sm text-ink-soft">{formatDateTime(m.created_at, config.timezone)}</p>
              </div>
              <p className="mt-3 whitespace-pre-line">{m.message}</p>
              {m.handled_by_name && <p className="mt-2 text-xs text-ink-soft">Traité par {m.handled_by_name}, {formatDateTime(m.handled_at, config.timezone)}</p>}
              {canManage && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {(["handled", "archived", "new"] as const).filter((s) => s !== m.status).map((s) => (
                    <AdminForm key={s} action={updateMessageStatus} className="">
                      <input type="hidden" name="id" value={m.id} /><input type="hidden" name="status" value={s} />
                      <SubmitButton pendingLabel="…" className="btn btn-secondary btn-sm">{s === "handled" ? "Marquer comme traité" : s === "archived" ? "Archiver" : "Remettre en non traité"}</SubmitButton>
                    </AdminForm>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
