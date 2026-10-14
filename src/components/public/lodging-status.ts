import type { SiteConfig } from "@/server/settings";
import type { Readiness } from "@/server/booking/rooms";
import type { Tone } from "@/lib/labels";

/** Statut public de l'hébergement, toujours transparent. */
export function lodgingStatus(config: SiteConfig, readiness: Readiness): { label: string; tone: Tone; canBook: boolean } {
  if (config.rooms.publicStatus === "open" && readiness.ready) {
    // En mode démonstration, le parcours est testable mais aucune réservation n'est réelle.
    if (config.mode === "demo") return { label: "Démonstration : réservation fictive", tone: "warning", canBook: true };
    return { label: "Réservation en ligne ouverte", tone: "success", canBook: true };
  }
  if (config.rooms.publicStatus === "open") return { label: "Réservation sur demande", tone: "info", canBook: false };
  if (config.rooms.publicStatus === "to_confirm") return { label: "Informations et disponibilités à confirmer", tone: "warning", canBook: false };
  return { label: "Ouverture à venir", tone: "neutral", canBook: false };
}
