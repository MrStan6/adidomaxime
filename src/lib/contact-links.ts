/**
 * Liens de contact (téléphone, WhatsApp). Retournent null si la coordonnée
 * n'est pas configurée : le bouton correspondant n'est alors pas affiché.
 * WhatsApp ouvre une conversation ; ce n'est PAS un système de réservation.
 */

/** Ne conserve que les chiffres et un « + » initial. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return trimmed.startsWith("+") || trimmed.startsWith("00") ? `+${digits.replace(/^00/, "")}` : digits;
}

export function telLink(raw: string | null | undefined): string | null {
  const n = normalizePhone(raw);
  return n ? `tel:${n}` : null;
}

/** WhatsApp exige un numéro au format international sans « + ». */
export function whatsappLink(raw: string | null | undefined, message?: string): string | null {
  const n = normalizePhone(raw);
  if (!n || !n.startsWith("+")) return null;
  const base = `https://wa.me/${n.slice(1)}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export type WhatsAppIntent = "venue_quote" | "rooms" | "event_info" | "general";

export function whatsappMessage(intent: WhatsAppIntent, context?: { venueName?: string; establishment?: string }): string {
  const where = context?.establishment ? ` (${context.establishment})` : "";
  switch (intent) {
    case "venue_quote":
      return `Bonjour${where}, je souhaite obtenir un devis pour ${context?.venueName ? `la ${context.venueName}` : "une salle"}. Date envisagée : … Nombre de participants : … Type d'événement : …`;
    case "rooms":
      return `Bonjour${where}, j'ai une question concernant l'hébergement. Dates souhaitées : … Nombre de personnes : …`;
    case "event_info":
      return `Bonjour${where}, je souhaite des informations pour organiser un événement : …`;
    default:
      return `Bonjour${where}, je souhaite obtenir des informations : …`;
  }
}

export function mailtoLink(email: string | null | undefined, subject?: string): string | null {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
}
