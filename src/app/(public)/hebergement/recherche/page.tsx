import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RoomSearchForm } from "@/components/public/RoomSearchForm";
import { RoomTypeCard } from "@/components/public/RoomTypeCard";
import { formatDate, formatMoney } from "@/lib/format";
import { roomSearchSchema } from "@/lib/validation/public-forms";
import { fieldErrors } from "@/lib/validation/common";
import { bookingReadiness, searchAvailability } from "@/server/booking/rooms";
import { getSiteConfig } from "@/server/settings";

export const metadata: Metadata = { title: "Disponibilités", robots: { index: false } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const config = await getSiteConfig();
  if (!(await bookingReadiness(config)).ready) redirect("/hebergement");
  const sp = await searchParams;
  const parsed = roomSearchSchema.safeParse(sp);
  const errors = parsed.success ? null : fieldErrors(parsed.error);
  const tooMany = parsed.success && parsed.data.rooms > config.rooms.maxRoomsPerBooking;
  const results = parsed.success && !tooMany ? await searchAvailability(parsed.data) : [];

  return (
    <div className="wrap py-12">
      <h1 className="text-4xl text-earth">Disponibilités</h1>
      <div className="mt-6"><RoomSearchForm values={sp} maxRooms={config.rooms.maxRoomsPerBooking} /></div>
      {errors && (
        <div role="alert" className="mt-6 rounded-md border border-danger/30 bg-[#fbeeec] p-4 text-danger">
          {Object.values(errors).map((e) => <p key={e}>{e}</p>)}
        </div>
      )}
      {tooMany && <p role="alert" className="mt-6 text-danger">Au-delà de {config.rooms.maxRoomsPerBooking} chambres, <Link href="/contact?sujet=hebergement" className="link">contactez-nous</Link>.</p>}
      {parsed.success && !tooMany && (
        <section className="mt-10" aria-live="polite">
          <p className="text-ink-soft">
            Du {formatDate(parsed.data.check_in)} au {formatDate(parsed.data.check_out)}, {parsed.data.adults} adulte(s)
            {parsed.data.children ? `, ${parsed.data.children} enfant(s)` : ""}, {parsed.data.rooms} chambre(s)
          </p>
          {results.length === 0 ? (
            <div className="mt-6 rounded-lg bg-sand-light p-6">
              <h2 className="text-2xl text-earth">Aucune chambre disponible pour ces critères</h2>
              <p className="mt-2">Essayez d'autres dates ou un nombre de chambres différent, ou <Link href="/contact?sujet=hebergement" className="link">contactez-nous</Link>.</p>
            </div>
          ) : (
            <div className="mt-4">
              {results.map(({ roomType, quote }) => {
                const q = new URLSearchParams({ ...Object.fromEntries(Object.entries(parsed.data).map(([k, v]) => [k, String(v)])), room_type_id: roomType.id });
                return (
                  <RoomTypeCard key={roomType.id} rt={roomType}>
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-md bg-sand-light p-4">
                      <div>
                        <p className="text-xl font-semibold">{formatMoney(quote.total, quote.currency)}</p>
                        <p className="text-sm text-ink-soft">pour {quote.nights} nuit(s) et {parsed.data.rooms} chambre(s)</p>
                      </div>
                      <Link href={`/hebergement/reserver?${q}`} className="btn btn-primary">Choisir cette chambre</Link>
                    </div>
                  </RoomTypeCard>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
