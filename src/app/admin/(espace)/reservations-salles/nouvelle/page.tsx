import { VenueBookingForm } from "@/components/admin/VenueBookingForm";
import { AdminPageHeader, Panel } from "@/components/admin/ui";
import { requirePermission } from "@/server/auth/current-user";
import { venueOptions } from "@/server/repositories/venues";
import { getSiteConfig } from "@/server/settings";

export const metadata = { title: "Nouvelle réservation" };

export default async function NewVenueBookingPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  await requirePermission("venue_bookings.manage");
  const block = (await searchParams).type === "blocage";
  const [venues, config] = await Promise.all([venueOptions(false), getSiteConfig()]);
  return (
    <>
      <AdminPageHeader
        title={block ? "Bloquer une période" : "Nouvelle réservation de salle"}
        description={block ? "Rend la salle indisponible (maintenance, usage interne, travaux)." : "Pour une demande reçue sur le site, créez plutôt l'option depuis la fiche de la demande afin de garder le lien."}
      />
      <Panel><VenueBookingForm venues={venues} kind={block ? "block" : "booking"} currency={config.currency} /></Panel>
    </>
  );
}
