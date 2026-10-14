import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchImage } from "@/components/public/ArchImage";
import { ContactActions } from "@/components/public/ContactActions";
import { capacityLabel, priceLabel } from "@/components/public/venue-facts";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { paragraphs, truncate } from "@/lib/format";
import { listMediaFor } from "@/server/repositories/media";
import { getPublishedVenueBySlug } from "@/server/repositories/venues";
import { getSiteConfig } from "@/server/settings";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const venue = await getPublishedVenueBySlug((await params).slug);
  if (!venue) return { title: "Salle introuvable" };
  return {
    title: venue.name,
    description: truncate(venue.short_description || venue.description, 155),
    alternates: { canonical: `/salles/${venue.slug}` },
  };
}

function List({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <h2 className="font-sans text-lg font-semibold">{title}</h2>
      {items.length ? (
        <ul className="mt-3 space-y-2">
          {items.map((x) => (
            <li key={x} className="flex gap-2.5"><Icon name="check" className="mt-1 h-4 w-4 shrink-0 text-terracotta" />{x}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-ink-soft">{empty}</p>
      )}
    </div>
  );
}

export default async function VenuePage({ params }: Props) {
  const { slug } = await params;
  const [config, venue] = await Promise.all([getSiteConfig(), getPublishedVenueBySlug(slug)]);
  if (!venue) notFound();
  const photos = await listMediaFor({ venueId: venue.id, publishedOnly: true });
  const validated = venue.capacities.filter((c) => c.is_validated);

  return (
    <>
      <nav aria-label="Fil d'Ariane" className="wrap pt-6 text-sm text-ink-soft">
        <Link href="/salles" className="link">Salles événementielles</Link> <span aria-hidden>/</span> <span aria-current="page">{venue.name}</span>
      </nav>

      <section className="wrap grid gap-10 py-10 lg:grid-cols-[1fr_minmax(0,24rem)] lg:gap-16 lg:py-14">
        <div>
          <h1 className="text-4xl text-earth sm:text-5xl">{venue.name}</h1>
          {venue.is_demo && <p className="mt-3"><Badge tone="warning">Exemple de démonstration</Badge></p>}
          <div className="measure mt-6 space-y-4 text-lg">
            {paragraphs(venue.description).map((p, i) => <p key={i}>{p}</p>)}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/devis?salle=${venue.slug}`} className="btn btn-primary">Demander un devis</Link>
            <Link href={`/devis?salle=${venue.slug}&type=disponibilite`} className="btn btn-secondary">Vérifier la disponibilité</Link>
          </div>
          <div className="mt-4"><ContactActions config={config} intent="venue_quote" venueName={venue.name} /></div>
        </div>
        <ArchImage media={venue.cover} priority sizes="(min-width: 1024px) 24rem, 90vw" className="max-w-sm lg:max-w-none" />
      </section>

      <section className="bg-sand-light py-12 lg:py-16" aria-label="Caractéristiques">
        <div className="wrap grid gap-10 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <h2 className="font-sans text-lg font-semibold">Capacités</h2>
            {validated.length ? (
              <table className="mt-3 w-full text-[0.95rem]">
                <caption className="sr-only">Capacité selon la configuration</caption>
                <tbody>
                  {validated.map((c) => (
                    <tr key={c.id} className="border-b border-line">
                      <th scope="row" className="py-2 text-left font-normal">{capacityLabel(c.layout, c.label)}</th>
                      <td className="py-2 text-right font-semibold">{c.capacity} pers.</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-3 text-ink-soft">Les capacités par configuration seront publiées après validation. Indiquez votre nombre de participants dans votre demande.</p>
            )}
            <p className="mt-4 text-[0.95rem]">
              <span className="font-semibold">Superficie : </span>
              {venue.area_m2 ? `${Number(venue.area_m2).toLocaleString("fr-FR")} m²` : "à confirmer"}
            </p>
          </div>
          <List title="Équipements disponibles" items={venue.equipment} empty="La liste des équipements sera précisée prochainement ; vos besoins sont étudiés avec le devis." />
          <List title="Services inclus" items={venue.included_services} empty="Précisés avec le devis." />
          <List title="Services en option" items={venue.optional_services} empty="Précisés avec le devis." />
          <div>
            <h2 className="font-sans text-lg font-semibold">Tarif</h2>
            <p className="mt-3">{priceLabel(venue, config.currency)}</p>
            <p className="mt-2 text-sm text-ink-soft">Le montant définitif dépend de la date, de la durée et des services choisis.</p>
          </div>
          <div>
            <h2 className="font-sans text-lg font-semibold">Conditions de réservation</h2>
            <div className="mt-3 space-y-2 text-[0.95rem]">{paragraphs(venue.booking_conditions || "Communiquées avec le devis.").map((p, i) => <p key={i}>{p}</p>)}</div>
            <Link href="/conditions-location-salles" className="link mt-3 inline-block text-[0.95rem]">Conditions de location des salles</Link>
          </div>
        </div>
      </section>

      {photos.length > 1 && (
        <section className="wrap py-12 lg:py-16" aria-labelledby="photos-titre">
          <h2 id="photos-titre" className="text-3xl text-earth">Photographies</h2>
          <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3">
            {photos.map((m) => (
              <li key={m.id}><ArchImage media={m} shape="rect" sizes="(min-width: 768px) 30vw, 45vw" /></li>
            ))}
          </ul>
        </section>
      )}

      <section className="on-dark bg-earth py-12 text-paper">
        <div className="wrap flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <p className="font-display text-2xl sm:text-3xl">Une date en tête pour {venue.name} ?</p>
          <div className="flex flex-wrap gap-3">
            <Link href={`/devis?salle=${venue.slug}`} className="btn btn-gold">Demander un devis</Link>
            <Link href={`/devis?salle=${venue.slug}&type=disponibilite`} className="btn btn-ghost-light">Vérifier la disponibilité</Link>
          </div>
        </div>
      </section>
    </>
  );
}
