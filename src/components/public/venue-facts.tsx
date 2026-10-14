import { layoutLabel, type Layout } from "@/lib/labels";
import { formatMoney } from "@/lib/format";
import type { VenueWithDetails } from "@/server/repositories/venues";
import { Icon } from "../ui/Icon";

/** Capacité maximale VALIDÉE, sinon null (affiché « à confirmer »). */
export function maxCapacity(v: VenueWithDetails) {
  const validated = v.capacities.filter((c) => c.is_validated);
  if (!validated.length) return null;
  return validated.reduce((a, b) => (b.capacity > a.capacity ? b : a));
}

export function priceLabel(v: VenueWithDetails, currency: string | null): string {
  if (v.pricing_mode === "published") {
    const amount = formatMoney(v.price_amount, currency);
    if (amount) return `À partir de ${amount}${v.price_unit ? ` ${v.price_unit}` : ""}`;
  }
  return "Tarif sur demande";
}

export function capacityLabel(layout: Layout, label: string | null) {
  return layout === "other" && label ? label : layoutLabel[layout];
}

export function VenueKeyFacts({ venue, currency, compact = false }: { venue: VenueWithDetails; currency: string | null; compact?: boolean }) {
  const max = maxCapacity(venue);
  return (
    <dl className={`grid gap-x-6 gap-y-2 text-[0.95rem] ${compact ? "" : "sm:grid-cols-2"}`}>
      <div className="flex items-center gap-2">
        <Icon name="users" className="h-5 w-5 text-terracotta" />
        <dt className="sr-only">Capacité</dt>
        <dd>{max ? `Jusqu'à ${max.capacity} personnes (${capacityLabel(max.layout, max.label).toLowerCase()})` : "Capacité à confirmer"}</dd>
      </div>
      <div className="flex items-center gap-2">
        <Icon name="ruler" className="h-5 w-5 text-terracotta" />
        <dt className="sr-only">Superficie</dt>
        <dd>{venue.area_m2 ? `${Number(venue.area_m2).toLocaleString("fr-FR")} m²` : "Superficie à confirmer"}</dd>
      </div>
      <div className={`flex items-center gap-2 ${compact ? "" : "sm:col-span-2"}`}>
        <Icon name="info" className="h-5 w-5 text-terracotta" />
        <dt className="sr-only">Tarif</dt>
        <dd>{priceLabel(venue, currency)}</dd>
      </div>
    </dl>
  );
}
