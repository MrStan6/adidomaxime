import Link from "next/link";
import { ArchImage } from "@/components/public/ArchImage";
import { ContactActions } from "@/components/public/ContactActions";
import { lodgingStatus } from "@/components/public/lodging-status";
import { VenueKeyFacts } from "@/components/public/venue-facts";
import { MapEmbed } from "@/components/public/MapEmbed";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { parseTitledList, paragraphs } from "@/lib/format";
import { bookingReadiness } from "@/server/booking/rooms";
import { getContentBlocks } from "@/server/content";
import { listPublishedMedia } from "@/server/repositories/media";
import { listPublicServices } from "@/server/repositories/services";
import { listPublishedVenues } from "@/server/repositories/venues";
import { getSiteConfig } from "@/server/settings";
import { JsonLd, organizationJsonLd } from "@/components/public/JsonLd";

export default async function HomePage() {
  const [config, content, venues, services, gallery] = await Promise.all([
    getSiteConfig(),
    getContentBlocks(),
    listPublishedVenues(),
    listPublicServices(),
    listPublishedMedia(),
  ]);
  const lodging = lodgingStatus(config, await bookingReadiness(config));
  const hero = content["home.hero"];
  const strengths = parseTitledList(content["home.strengths"]?.body ?? "");
  const facade = gallery.find((m) => m.category === "etablissement") ?? null;
  const showLocation = !!(config.geo && config.fullAddress);

  return (
    <>
      <JsonLd data={organizationJsonLd(config)} />

      {/* Introduction */}
      <section className="on-dark bg-earth text-paper">
        <div className="wrap grid items-end gap-10 pt-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:pt-20">
          <div className="pb-4 lg:pb-20">
            <h1 className="text-[2.5rem] text-paper sm:text-5xl lg:text-[3.75rem]">{hero?.title}</h1>
            <div className="measure mt-6 space-y-4 text-lg text-sand">
              {paragraphs(hero?.body ?? "").map((p, i) => <p key={i}>{p}</p>)}
            </div>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/salles" className="btn btn-gold">Découvrir et réserver une salle</Link>
              <Link href="/hebergement" className="btn btn-ghost-light">Préparer un séjour</Link>
            </div>
          </div>
          <ArchImage media={facade} priority sizes="(min-width: 1024px) 34vw, 90vw" className="mx-auto w-full max-w-md lg:max-w-none" />
        </div>
      </section>

      {/* Salles */}
      <section className="py-16 lg:py-24" aria-labelledby="salles-titre">
        <div className="wrap">
          <div className="measure">
            <h2 id="salles-titre" className="text-3xl text-earth sm:text-4xl">{content["home.venues_intro"]?.title}</h2>
            <p className="mt-4 text-ink-soft">{content["home.venues_intro"]?.body}</p>
          </div>
          <div className="mt-12 grid gap-12 md:grid-cols-2">
            {venues.map((v) => (
              <article key={v.id} className="grid gap-6 sm:grid-cols-[11rem_1fr] md:grid-cols-1 lg:grid-cols-[13rem_1fr]">
                <ArchImage media={v.cover} sizes="(min-width: 1024px) 13rem, (min-width: 640px) 11rem, 90vw" className="max-w-[16rem] sm:max-w-none" />
                <div className="flex flex-col">
                  <h3 className="text-2xl text-earth">
                    <Link href={`/salles/${v.slug}`} className="no-underline hover:text-terracotta">{v.name}</Link>
                  </h3>
                  {v.is_demo && <p className="mt-1"><Badge tone="warning">Exemple de démonstration</Badge></p>}
                  <p className="mt-3 text-ink-soft">{v.short_description}</p>
                  <div className="mt-5"><VenueKeyFacts venue={v} currency={config.currency} compact /></div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link href={`/devis?salle=${v.slug}`} className="btn btn-primary">Demander un devis</Link>
                    <Link href={`/salles/${v.slug}`} className="btn btn-secondary">Voir la salle</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Hébergement */}
      <section className="bg-sand py-16 lg:py-20" aria-labelledby="hebergement-titre">
        <div className="wrap grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div className="measure">
            <Badge tone={lodging.tone}>{lodging.label}</Badge>
            <h2 id="hebergement-titre" className="mt-4 text-3xl text-earth sm:text-4xl">{content["home.lodging"]?.title}</h2>
            <p className="mt-4">{content["home.lodging"]?.body}</p>
          </div>
          <Link href="/hebergement" className="btn btn-primary">{lodging.canBook ? "Voir les disponibilités" : "En savoir plus sur l'hébergement"}</Link>
        </div>
      </section>

      {/* Services réellement disponibles uniquement */}
      {services.length > 0 && (
        <section className="py-16 lg:py-20" aria-labelledby="services-titre">
          <div className="wrap">
            <h2 id="services-titre" className="text-3xl text-earth sm:text-4xl">Services sur place</h2>
            <ul className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {services.slice(0, 6).map((s) => (
                <li key={s.id} className="flex gap-4">
                  <Icon name={s.icon} className="mt-1 h-6 w-6 shrink-0 text-terracotta" />
                  <div>
                    <h3 className="font-sans text-lg font-semibold">{s.name}</h3>
                    <p className="mt-1 text-ink-soft">{s.description}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link href="/services" className="link mt-8 inline-block">Tous les services</Link>
          </div>
        </section>
      )}

      {/* Atouts confirmés (masqué si la liste est vide) */}
      {strengths.length > 0 && (
        <section className={`py-16 lg:py-20 ${services.length > 0 ? "border-t border-line" : ""}`} aria-labelledby="atouts-titre">
          <div className="wrap">
            <h2 id="atouts-titre" className="measure text-3xl text-earth sm:text-4xl">{content["home.strengths"]?.title}</h2>
            <ul className="mt-10 grid gap-10 md:grid-cols-3">
              {strengths.map((s) => (
                <li key={s.title} className="border-t-2 border-gold pt-5">
                  <h3 className="font-sans text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-ink-soft">{s.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Galerie */}
      {gallery.length > 0 && (
        <section className="bg-sand-light py-16 lg:py-20" aria-labelledby="galerie-titre">
          <div className="wrap">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 id="galerie-titre" className="text-3xl text-earth sm:text-4xl">En images</h2>
              <Link href="/galerie" className="link">Voir la galerie</Link>
            </div>
            <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
              {gallery.slice(0, 4).map((m, i) => (
                <li key={m.id}>
                  <ArchImage media={m} shape={i % 2 ? "rect" : "arch"} sizes="(min-width: 768px) 22vw, 45vw" />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Localisation : uniquement si adresse ET point géographique vérifiés */}
      {showLocation && (
        <section className="py-16 lg:py-20" aria-labelledby="acces-titre">
          <div className="wrap grid gap-8 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <h2 id="acces-titre" className="text-3xl text-earth sm:text-4xl">Nous trouver</h2>
              <p className="mt-4">{config.fullAddress}</p>
              {config.address.directions && <p className="mt-3 whitespace-pre-line text-ink-soft">{config.address.directions}</p>}
              <Link href="/contact" className="link mt-6 inline-block">Accès et informations pratiques</Link>
            </div>
            <MapEmbed geo={config.geo!} label={config.displayName} />
          </div>
        </section>
      )}

      {/* Contact */}
      <section className="on-dark bg-earth-deep py-16 text-paper lg:py-20" aria-labelledby="contact-titre">
        <div className="wrap grid gap-8 md:grid-cols-[1.2fr_1fr] md:items-center">
          <div className="measure">
            <h2 id="contact-titre" className="text-3xl text-paper sm:text-4xl">{content["home.contact"]?.title}</h2>
            <p className="mt-4 text-sand">{content["home.contact"]?.body}</p>
          </div>
          <div className="flex flex-col gap-4 md:items-end">
            <div className="flex flex-wrap gap-3">
              <Link href="/devis" className="btn btn-gold">Demander un devis</Link>
              <Link href="/contact" className="btn btn-ghost-light">Nous écrire</Link>
            </div>
            <ContactActions config={config} intent="event_info" dark />
          </div>
        </div>
      </section>
    </>
  );
}
