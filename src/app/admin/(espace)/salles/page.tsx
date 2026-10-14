import Link from "next/link";
import { AdminPageHeader, ToFill } from "@/components/admin/ui";
import { requirePermission } from "@/server/auth/current-user";
import { listAllVenues } from "@/server/repositories/venues";

export const metadata = { title: "Fiches des salles" };

export default async function AdminVenuesPage() {
  await requirePermission("venues.manage");
  const venues = await listAllVenues();
  return (
    <>
      <AdminPageHeader title="Fiches des salles" description="Seules les capacités marquées « validées » sont affichées sur le site." />
      <ul className="grid gap-4 md:grid-cols-2">
        {venues.map((v) => (
          <li key={v.id} className="rounded-lg border border-line bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-sans text-lg font-semibold">{v.name}</h2>
              {v.is_published ? <span className="badge badge-success">Publiée</span> : <span className="badge badge-neutral">Masquée</span>}
            </div>
            <ul className="mt-3 flex flex-wrap gap-2 text-sm">
              {!v.capacities.some((c) => c.is_validated) && <li><ToFill>Capacités à valider</ToFill></li>}
              {!v.area_m2 && <li><ToFill>Superficie</ToFill></li>}
              {v.pricing_mode === "on_request" && <li className="badge badge-neutral">Tarif sur demande</li>}
              {/provisoire/i.test(v.name) && <li><ToFill>Nom définitif</ToFill></li>}
            </ul>
            <div className="mt-4 flex gap-2">
              <Link href={`/admin/salles/${v.id}`} className="btn btn-primary btn-sm">Modifier</Link>
              <Link href={`/salles/${v.slug}`} target="_blank" className="btn btn-secondary btn-sm">Voir sur le site</Link>
              <Link href={`/admin/medias?salle=${v.id}`} className="btn btn-secondary btn-sm">Photos</Link>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
