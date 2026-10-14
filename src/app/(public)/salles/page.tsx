import type { Metadata } from "next";
import Link from "next/link";
import { ArchImage } from "@/components/public/ArchImage";
import { ContactActions } from "@/components/public/ContactActions";
import { PageIntro } from "@/components/public/PageIntro";
import { VenueKeyFacts } from "@/components/public/venue-facts";
import { Badge } from "@/components/ui/Badge";
import { getContent } from "@/server/content";
import { listPublishedVenues } from "@/server/repositories/venues";
import { getSiteConfig } from "@/server/settings";

export const metadata: Metadata = {
  title: "Salles événementielles",
  description: "Deux salles pour vos conférences, formations, séminaires, réunions et cérémonies. Demandez un devis ou vérifiez une disponibilité.",
  alternates: { canonical: "/salles" },
};

export default async function VenuesPage() {
  const [config, intro, venues] = await Promise.all([getSiteConfig(), getContent("salles.intro"), listPublishedVenues()]);
  return (
    <>
      <PageIntro title={intro.title || "Salles événementielles"} body={intro.body}>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/devis" className="btn btn-primary">Demander un devis</Link>
          <Link href="/devis?type=disponibilite" className="btn btn-secondary">Vérifier une disponibilité</Link>
        </div>
      </PageIntro>

      <div className="wrap divide-y divide-line">
        {venues.length === 0 && <p className="py-16 text-ink-soft">La présentation des salles sera publiée prochainement. Contactez-nous pour toute demande.</p>}
        {venues.map((v, i) => (
          <article key={v.id} className="grid gap-8 py-14 md:grid-cols-[minmax(0,20rem)_1fr] md:gap-14 lg:py-20">
            <ArchImage media={v.cover} priority={i === 0} sizes="(min-width: 768px) 20rem, 90vw" className="max-w-xs md:max-w-none" />
            <div className="flex flex-col justify-center">
              <h2 className="text-3xl text-earth sm:text-4xl">{v.name}</h2>
              {v.is_demo && <p className="mt-2"><Badge tone="warning">Exemple de démonstration</Badge></p>}
              <p className="measure mt-4 text-lg">{v.short_description}</p>
              <div className="mt-6"><VenueKeyFacts venue={v} currency={config.currency} /></div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={`/salles/${v.slug}`} className="btn btn-primary">Découvrir la salle</Link>
                <Link href={`/devis?salle=${v.slug}`} className="btn btn-secondary">Demander un devis</Link>
              </div>
            </div>
          </article>
        ))}
      </div>

      <section className="bg-sand py-14">
        <div className="wrap flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="measure">
            <h2 className="text-3xl text-earth">Vous hésitez entre les deux salles ?</h2>
            <p className="mt-3">Décrivez votre événement et demandez une recommandation : nous vous orienterons vers l'espace adapté.</p>
          </div>
          <div className="flex flex-col gap-3">
            <Link href="/devis" className="btn btn-primary">Demander une recommandation</Link>
            <ContactActions config={config} intent="venue_quote" />
          </div>
        </div>
      </section>
    </>
  );
}
