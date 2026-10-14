import { query, queryOne, type Queryable, pool } from "../db";

export type Service = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  status: "planned" | "available" | "suspended";
  is_published: boolean;
  sort_order: number;
  updated_at: Date;
};

/**
 * Services visibles publiquement : publiés ET réellement disponibles.
 * Un service envisagé ou suspendu n'apparaît jamais dans l'offre publique.
 */
export async function listPublicServices(db: Queryable = pool()): Promise<Service[]> {
  return query<Service>(
    "SELECT * FROM services WHERE is_published AND status = 'available' ORDER BY sort_order, name",
    [],
    db,
  );
}

export async function listAllServices(db: Queryable = pool()): Promise<Service[]> {
  return query<Service>("SELECT * FROM services ORDER BY sort_order, name", [], db);
}

export async function upsertService(
  s: { id?: string; slug: string; name: string; description: string; icon: string; status: Service["status"]; is_published: boolean; sort_order: number },
  userId: string,
  db: Queryable = pool(),
) {
  if (s.id) {
    return queryOne<{ id: string }>(
      `UPDATE services SET slug=$2, name=$3, description=$4, icon=$5, status=$6, is_published=$7, sort_order=$8, updated_by=$9
        WHERE id=$1 RETURNING id`,
      [s.id, s.slug, s.name, s.description, s.icon, s.status, s.is_published, s.sort_order, userId],
      db,
    );
  }
  return queryOne<{ id: string }>(
    `INSERT INTO services (slug, name, description, icon, status, is_published, sort_order, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [s.slug, s.name, s.description, s.icon, s.status, s.is_published, s.sort_order, userId],
    db,
  );
}
