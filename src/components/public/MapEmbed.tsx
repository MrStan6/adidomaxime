/**
 * Carte OpenStreetMap (sans clé API ni traceur publicitaire). N'est affichée
 * que pour des coordonnées marquées comme vérifiées par l'établissement.
 */
export function MapEmbed({ geo, label }: { geo: { lat: number; lng: number }; label: string }) {
  const d = 0.006;
  const bbox = [geo.lng - d, geo.lat - d, geo.lng + d, geo.lat + d].map((n) => n.toFixed(5)).join(",");
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${geo.lat},${geo.lng}`;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${geo.lat},${geo.lng}`;
  const osm = `https://www.openstreetmap.org/?mlat=${geo.lat}&mlon=${geo.lng}#map=17/${geo.lat}/${geo.lng}`;
  return (
    <div>
      <iframe
        title={`Carte : localisation de ${label}`}
        src={src}
        loading="lazy"
        className="aspect-[4/3] w-full rounded-md border border-line"
        referrerPolicy="no-referrer"
      />
      <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <a href={directions} target="_blank" rel="noopener noreferrer" className="link">Itinéraire (Google Maps)</a>
        <a href={osm} target="_blank" rel="noopener noreferrer" className="link">Agrandir la carte</a>
      </p>
    </div>
  );
}
