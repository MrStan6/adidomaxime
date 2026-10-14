import type { MetadataRoute } from "next";
import { listPublishedVenues } from "@/server/repositories/venues";
import { getSiteConfig } from "@/server/settings";
import { LEGAL_PAGES } from "@/server/content";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const config = await getSiteConfig();
  if (config.mode === "demo") return []; // le mode démonstration n'est pas référencé
  const base = config.siteUrl;
  const venues = await listPublishedVenues();
  const pages = ["", "/hotel", "/salles", "/devis", "/hebergement", "/services", "/galerie", "/contact"];
  return [
    ...pages.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 })),
    ...venues.map((v) => ({ url: `${base}/salles/${v.slug}`, lastModified: v.updated_at, priority: 0.8 })),
    ...Object.keys(LEGAL_PAGES).map((s) => ({ url: `${base}/${s}`, priority: 0.2 })),
  ];
}
