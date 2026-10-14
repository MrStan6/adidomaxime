import { DemoBanner } from "@/components/public/DemoBanner";
import { SiteFooter } from "@/components/public/SiteFooter";
import { SiteHeader } from "@/components/public/SiteHeader";
import { StickyMobileCta } from "@/components/public/StickyMobileCta";
import { getSiteConfig } from "@/server/settings";

// Contenu lu en base à chaque requête : les modifications faites dans
// l'administration sont visibles immédiatement.
export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const config = await getSiteConfig();
  return (
    <>
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-paper focus:px-4 focus:py-2">
        Aller au contenu
      </a>
      <DemoBanner config={config} />
      <SiteHeader config={config} />
      <main id="contenu" className="pb-20 lg:pb-0">{children}</main>
      <SiteFooter config={config} />
      <StickyMobileCta config={config} />
    </>
  );
}
