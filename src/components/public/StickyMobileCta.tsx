import type { SiteConfig } from "@/server/settings";
import { whatsappLink, whatsappMessage, telLink } from "@/lib/contact-links";
import { StickyMobileCtaBar } from "./StickyMobileCtaBar";

/** Barre d'action fixe sur mobile : devis + WhatsApp ou appel (si configurés). */
export function StickyMobileCta({ config }: { config: SiteConfig }) {
  return (
    <StickyMobileCtaBar
      whatsapp={whatsappLink(config.whatsapp, whatsappMessage("general", { establishment: config.name ?? undefined }))}
      tel={telLink(config.phone)}
    />
  );
}
