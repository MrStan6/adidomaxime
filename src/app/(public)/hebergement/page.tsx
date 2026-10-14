import type { Metadata } from "next";
import Link from "next/link";
import { ContactActions } from "@/components/public/ContactActions";
import { lodgingStatus } from "@/components/public/lodging-status";
import { PageIntro } from "@/components/public/PageIntro";
import { RoomSearchForm } from "@/components/public/RoomSearchForm";
import { RoomTypeCard } from "@/components/public/RoomTypeCard";
import { Badge } from "@/components/ui/Badge";
import { bookingReadiness, listPublicRoomTypes } from "@/server/booking/rooms";
import { getContent } from "@/server/content";
import { getSiteConfig } from "@/server/settings";

export const metadata: Metadata = {
  title: "Chambres et hébergement",
  description: "Informations sur l'hébergement de l'établissement : chambres, disponibilités et réservation lorsque l'ouverture est confirmée.",
  alternates: { canonical: "/hebergement" },
};

export default async function LodgingPage() {
  const config = await getSiteConfig();
  const [intro, readiness, roomTypes] = await Promise.all([getContent("hebergement.intro"), bookingReadiness(config), listPublicRoomTypes()]);
  const status = lodgingStatus(config, readiness);
  return (
    <>
      <PageIntro title={intro.title || "Chambres et hébergement"} body={intro.body}>
        <p className="mt-6"><Badge tone={status.tone}>{status.label}</Badge></p>
      </PageIntro>

      {status.canBook && (
        <section className="wrap py-10" aria-labelledby="recherche-titre">
          <h2 id="recherche-titre" className="mb-4 text-2xl text-earth">Vérifier les disponibilités</h2>
          <RoomSearchForm maxRooms={config.rooms.maxRoomsPerBooking} />
        </section>
      )}

      {roomTypes.length > 0 ? (
        <section className="wrap pb-14" aria-labelledby="chambres-titre">
          <h2 id="chambres-titre" className="mt-10 text-3xl text-earth">Nos chambres</h2>
          {!status.canBook && <p className="mt-3 text-ink-soft">Informations indicatives, susceptibles d'évoluer jusqu'à l'ouverture.</p>}
          <div className="mt-6">{roomTypes.map((rt) => <RoomTypeCard key={rt.id} rt={rt} />)}</div>
        </section>
      ) : null}

      {!status.canBook && (
        <section className="bg-sand py-14">
          <div className="wrap flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="measure">
              <h2 className="text-3xl text-earth">Une question sur l'hébergement ?</h2>
              <p className="mt-3">La réservation en ligne n'est pas encore ouverte. Écrivez-nous pour être informé de l'ouverture ou pour préparer un séjour lié à un événement.</p>
            </div>
            <div className="flex flex-col gap-3">
              <Link href="/contact?sujet=hebergement" className="btn btn-primary">Nous écrire</Link>
              <ContactActions config={config} intent="rooms" />
            </div>
          </div>
        </section>
      )}
    </>
  );
}
