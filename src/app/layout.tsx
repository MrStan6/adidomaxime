import type { Metadata, Viewport } from "next";
import "@fontsource/albert-sans/400.css";
import "@fontsource/albert-sans/500.css";
import "@fontsource/albert-sans/600.css";
import "@fontsource/libre-caslon-display/400.css";
import "./globals.css";
import { connection } from "next/server";
import { getSiteConfig } from "@/server/settings";

export async function generateMetadata(): Promise<Metadata> {
  // Rendu à la demande : les métadonnées dépendent des paramètres en base,
  // qui n'est pas accessible pendant la construction de l'image Docker.
  await connection();
  const c = await getSiteConfig();
  const description =
    c.tagline ??
    "Salles événementielles pour conférences, formations, séminaires, réunions et cérémonies. Hébergement en préparation.";
  return {
    metadataBase: new URL(c.siteUrl),
    title: { default: c.displayName, template: `%s | ${c.displayName}` },
    description,
    openGraph: { type: "website", locale: "fr_FR", siteName: c.displayName, description },
    // Le mode démonstration ne doit jamais être indexé par les moteurs de recherche.
    robots: c.mode === "demo" ? { index: false, follow: false } : undefined,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#5a3a1e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
