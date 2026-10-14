import type { MetadataRoute } from "next";
import { getSiteConfig } from "@/server/settings";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const config = await getSiteConfig();
  if (config.mode === "demo") return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/hebergement/reservation", "/hebergement/reserver", "/paiement"] },
    sitemap: `${config.siteUrl}/sitemap.xml`,
  };
}
