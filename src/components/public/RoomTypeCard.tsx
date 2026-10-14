import { ArchImage } from "./ArchImage";
import { Badge } from "../ui/Badge";
import { Icon } from "../ui/Icon";
import type { RoomType } from "@/server/booking/rooms";

export function RoomTypeFacts({ rt }: { rt: RoomType }) {
  return (
    <ul className="space-y-1.5 text-[0.95rem]">
      <li className="flex gap-2"><Icon name="users" className="h-5 w-5 text-terracotta" />Jusqu'à {rt.max_occupancy} personne{rt.max_occupancy > 1 ? "s" : ""} ({rt.max_adults} adulte{rt.max_adults > 1 ? "s" : ""} max.)</li>
      <li className="flex gap-2"><Icon name="bed" className="h-5 w-5 text-terracotta" />{rt.bed_description || `${rt.bed_count} lit${rt.bed_count > 1 ? "s" : ""}`}</li>
    </ul>
  );
}

export function RoomTypeCard({ rt, children }: { rt: RoomType; children?: React.ReactNode }) {
  return (
    <article className="grid gap-6 border-t border-line py-10 sm:grid-cols-[12rem_1fr] lg:grid-cols-[14rem_1fr]">
      <ArchImage media={rt.cover ?? { file_path: "/placeholders/chambre.svg", alt: "Image provisoire — photographie de chambre à venir", is_placeholder: true }} sizes="(min-width: 640px) 14rem, 80vw" className="max-w-[16rem] sm:max-w-none" />
      <div>
        <h3 className="text-2xl text-earth">{rt.name}</h3>
        {rt.is_demo && <p className="mt-1"><Badge tone="warning">Exemple de démonstration</Badge></p>}
        {rt.description && <p className="mt-3 text-ink-soft">{rt.description}</p>}
        <div className="mt-4"><RoomTypeFacts rt={rt} /></div>
        {rt.amenities.length > 0 && <p className="mt-3 text-[0.95rem] text-ink-soft">Équipements : {rt.amenities.join(", ")}</p>}
        {children}
      </div>
    </article>
  );
}
