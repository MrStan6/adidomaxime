import type { SiteConfig } from "@/server/settings";

/** Bandeau visible sur toutes les pages en mode démonstration. */
export function DemoBanner({ config }: { config: SiteConfig }) {
  if (config.mode !== "demo") return null;
  return (
    <div role="note" className="bg-ink px-4 py-2 text-center text-sm text-sand-light">
      <span className="sm:hidden">Site en démonstration : aucune réservation ni aucun paiement réel.</span>
      <span className="hidden sm:inline">
        Site en démonstration : les informations marquées « à confirmer » et les exemples ne sont pas encore validés.
        Aucune réservation ni aucun paiement réel n'est effectué.
      </span>
    </div>
  );
}
