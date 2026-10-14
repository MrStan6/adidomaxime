import { telLink, whatsappLink, whatsappMessage, mailtoLink, type WhatsAppIntent } from "@/lib/contact-links";
import type { SiteConfig } from "@/server/settings";
import { Icon } from "../ui/Icon";

/**
 * Boutons d'appel et WhatsApp. Chacun n'apparaît QUE si la coordonnée est
 * configurée. WhatsApp ouvre une conversation : ce n'est pas une réservation.
 */
export function ContactActions({
  config,
  intent = "general",
  venueName,
  showEmail = false,
  dark = false,
}: {
  config: SiteConfig;
  intent?: WhatsAppIntent;
  venueName?: string;
  showEmail?: boolean;
  dark?: boolean;
}) {
  const wa = whatsappLink(config.whatsapp, whatsappMessage(intent, { venueName, establishment: config.name ?? undefined }));
  const tel = telLink(config.phone);
  const mail = showEmail ? mailtoLink(config.email) : null;
  if (!wa && !tel && !mail) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {wa && (
        <a href={wa} className="btn btn-whatsapp" target="_blank" rel="noopener noreferrer">
          <Icon name="whatsapp" /> Écrire sur WhatsApp
        </a>
      )}
      {tel && (
        <a href={tel} className={`btn ${dark ? "btn-ghost-light" : "btn-secondary"}`}>
          <Icon name="phone" /> Appeler
        </a>
      )}
      {mail && (
        <a href={mail} className={`btn ${dark ? "btn-ghost-light" : "btn-secondary"}`}>
          <Icon name="mail" /> Envoyer un courriel
        </a>
      )}
    </div>
  );
}
