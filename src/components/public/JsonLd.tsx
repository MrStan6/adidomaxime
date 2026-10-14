import type { SiteConfig } from "@/server/settings";

/**
 * Données structurées : publiées uniquement avec des informations
 * confirmées (aucune note, aucun avis, aucun prix inventé).
 */
export function organizationJsonLd(c: SiteConfig): Record<string, unknown> | null {
  if (!c.name) return null; // pas de données structurées sans nom officiel
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": c.fullAddress ? "LocalBusiness" : "Organization",
    name: c.name,
    url: c.siteUrl,
  };
  if (c.phone) data.telephone = c.phone;
  if (c.email) data.email = c.email;
  if (c.fullAddress) {
    data.address = {
      "@type": "PostalAddress",
      streetAddress: c.address.street ?? undefined,
      addressLocality: c.address.city ?? undefined,
      addressRegion: c.address.region ?? undefined,
      addressCountry: c.address.country ?? undefined,
    };
  }
  if (c.geo) data.geo = { "@type": "GeoCoordinates", latitude: c.geo.lat, longitude: c.geo.lng };
  const sameAs = [c.social.facebook, c.social.instagram, c.social.linkedin].filter(Boolean);
  if (sameAs.length) data.sameAs = sameAs;
  return data;
}

export function JsonLd({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return null;
  // échappement de « < » pour empêcher toute injection de balise
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
