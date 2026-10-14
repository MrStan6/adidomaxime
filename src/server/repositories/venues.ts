import { query, queryOne, type Queryable, pool } from "../db";
import { env } from "../env";
import type { Layout } from "@/lib/labels";

export type VenueCapacity = { id: string; layout: Layout; label: string | null; capacity: number; is_validated: boolean };

export type Venue = {
  id: string;
  slug: string;
  name: string;
  short_description: string;
  description: string;
  area_m2: string | null;
  equipment: string[];
  included_services: string[];
  optional_services: string[];
  booking_conditions: string;
  pricing_mode: "on_request" | "published";
  price_amount: string | null;
  price_unit: string | null;
  is_published: boolean;
  sort_order: number;
  is_demo: boolean;
  updated_at: Date;
};

export type VenueWithDetails = Venue & {
  capacities: VenueCapacity[];
  cover: { file_path: string; alt: string; is_placeholder: boolean } | null;
};

const showDemo = () => env().APP_MODE === "demo";

const DETAILS_SQL = `
  SELECT v.*,
    COALESCE((SELECT json_agg(json_build_object('id', c.id, 'layout', c.layout, 'label', c.label,
                   'capacity', c.capacity, 'is_validated', c.is_validated) ORDER BY c.capacity DESC)
                FROM venue_capacities c WHERE c.venue_id = v.id AND ($1::boolean OR c.is_validated)), '[]') AS capacities,
    (SELECT json_build_object('file_path', m.file_path, 'alt', m.alt, 'is_placeholder', m.is_placeholder)
       FROM media m WHERE m.venue_id = v.id AND m.is_published ORDER BY m.is_placeholder, m.sort_order, m.created_at LIMIT 1) AS cover
  FROM venues v`;

/** Salles publiées, avec seulement les capacités VALIDÉES. */
export async function listPublishedVenues(db: Queryable = pool()): Promise<VenueWithDetails[]> {
  return query<VenueWithDetails>(
    `${DETAILS_SQL} WHERE v.is_published AND ($2::boolean OR NOT v.is_demo) ORDER BY v.sort_order, v.name`,
    [false, showDemo()],
    db,
  );
}

export async function getPublishedVenueBySlug(slug: string, db: Queryable = pool()): Promise<VenueWithDetails | null> {
  return queryOne<VenueWithDetails>(
    `${DETAILS_SQL} WHERE v.slug = $3 AND v.is_published AND ($2::boolean OR NOT v.is_demo)`,
    [false, showDemo(), slug],
    db,
  );
}

/** Administration : toutes les salles, toutes capacités. */
export async function listAllVenues(db: Queryable = pool()): Promise<VenueWithDetails[]> {
  return query<VenueWithDetails>(`${DETAILS_SQL} ORDER BY v.sort_order, v.name`, [true], db);
}

export async function getVenue(id: string, db: Queryable = pool()): Promise<VenueWithDetails | null> {
  return queryOne<VenueWithDetails>(`${DETAILS_SQL} WHERE v.id = $2`, [true, id], db);
}

export type VenueInput = {
  name: string;
  slug: string;
  short_description: string;
  description: string;
  area_m2: number | null;
  equipment: string[];
  included_services: string[];
  optional_services: string[];
  booking_conditions: string;
  pricing_mode: "on_request" | "published";
  price_amount: number | null;
  price_unit: string | null;
  is_published: boolean;
  sort_order: number;
};

export async function createVenue(input: VenueInput, db: Queryable = pool()) {
  return queryOne<{ id: string }>(
    `INSERT INTO venues (name, slug, short_description, description, area_m2, equipment, included_services,
        optional_services, booking_conditions, pricing_mode, price_amount, price_unit, is_published, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
    venueParams(input),
    db,
  );
}

export async function updateVenue(id: string, input: VenueInput, db: Queryable = pool()) {
  return queryOne<{ id: string }>(
    `UPDATE venues SET name=$1, slug=$2, short_description=$3, description=$4, area_m2=$5, equipment=$6,
        included_services=$7, optional_services=$8, booking_conditions=$9, pricing_mode=$10, price_amount=$11,
        price_unit=$12, is_published=$13, sort_order=$14
      WHERE id = $15 RETURNING id`,
    [...venueParams(input), id],
    db,
  );
}

function venueParams(i: VenueInput) {
  return [
    i.name,
    i.slug,
    i.short_description,
    i.description,
    i.area_m2,
    i.equipment,
    i.included_services,
    i.optional_services,
    i.booking_conditions,
    i.pricing_mode,
    i.pricing_mode === "published" ? i.price_amount : null,
    i.pricing_mode === "published" ? i.price_unit : null,
    i.is_published,
    i.sort_order,
  ];
}

/** Remplace l'ensemble des capacités d'une salle. */
export async function replaceCapacities(
  venueId: string,
  capacities: { layout: Layout; label: string | null; capacity: number; is_validated: boolean }[],
  db: Queryable,
) {
  await query("DELETE FROM venue_capacities WHERE venue_id = $1", [venueId], db);
  for (const c of capacities) {
    await query(
      "INSERT INTO venue_capacities (venue_id, layout, label, capacity, is_validated) VALUES ($1,$2,$3,$4,$5)",
      [venueId, c.layout, c.label, c.capacity, c.is_validated],
      db,
    );
  }
}

/** Liste minimale pour les sélecteurs de formulaire. */
export async function venueOptions(publishedOnly: boolean, db: Queryable = pool()) {
  return query<{ id: string; name: string; slug: string }>(
    `SELECT id, name, slug FROM venues WHERE ($1::boolean = false OR is_published) AND ($2::boolean OR NOT is_demo)
      ORDER BY sort_order, name`,
    [publishedOnly, publishedOnly ? showDemo() : true],
    db,
  );
}
