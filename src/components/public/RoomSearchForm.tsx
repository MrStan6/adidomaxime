import { todayIso } from "@/lib/validation/common";

/** Formulaire de recherche (GET) : fonctionne même sans JavaScript. */
export function RoomSearchForm({ values, maxRooms }: { values?: Record<string, string | number>; maxRooms: number }) {
  const v = values ?? {};
  return (
    <form action="/hebergement/recherche" method="get" className="grid gap-4 rounded-lg border border-line bg-white p-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_0.6fr_0.6fr_0.6fr_auto] lg:items-end">
      <div>
        <label htmlFor="check_in" className="field-label">Arrivée</label>
        <input id="check_in" name="check_in" type="date" required min={todayIso()} defaultValue={String(v.check_in ?? "")} className="input" />
      </div>
      <div>
        <label htmlFor="check_out" className="field-label">Départ</label>
        <input id="check_out" name="check_out" type="date" required min={todayIso()} defaultValue={String(v.check_out ?? "")} className="input" />
      </div>
      <div>
        <label htmlFor="adults" className="field-label">Adultes</label>
        <input id="adults" name="adults" type="number" min={1} max={20} required defaultValue={String(v.adults ?? 2)} className="input" />
      </div>
      <div>
        <label htmlFor="children" className="field-label">Enfants</label>
        <input id="children" name="children" type="number" min={0} max={20} defaultValue={String(v.children ?? 0)} className="input" />
      </div>
      <div>
        <label htmlFor="rooms" className="field-label">Chambres</label>
        <input id="rooms" name="rooms" type="number" min={1} max={maxRooms} required defaultValue={String(v.rooms ?? 1)} className="input" />
      </div>
      <button type="submit" className="btn btn-primary sm:col-span-2 lg:col-span-1">Rechercher</button>
    </form>
  );
}
