import { query, queryOne, type Queryable, pool } from "../db";

export type Media = {
  id: string;
  file_path: string;
  alt: string;
  caption: string | null;
  category: string;
  venue_id: string | null;
  room_type_id: string | null;
  is_placeholder: boolean;
  is_published: boolean;
  sort_order: number;
  width: number | null;
  height: number | null;
  created_at: Date;
};

export { mediaUrl } from "@/lib/media-url";

export async function listPublishedMedia(category?: string, db: Queryable = pool()): Promise<Media[]> {
  return query<Media>(
    `SELECT * FROM media WHERE is_published AND ($1::text IS NULL OR category = $1)
      ORDER BY is_placeholder, sort_order, created_at DESC LIMIT 200`,
    [category ?? null],
    db,
  );
}

export async function listMediaFor(
  filter: { venueId?: string; roomTypeId?: string; publishedOnly?: boolean },
  db: Queryable = pool(),
): Promise<Media[]> {
  return query<Media>(
    `SELECT * FROM media
      WHERE ($1::uuid IS NULL OR venue_id = $1) AND ($2::uuid IS NULL OR room_type_id = $2)
        AND ($3::boolean = false OR is_published)
      ORDER BY is_placeholder, sort_order, created_at`,
    [filter.venueId ?? null, filter.roomTypeId ?? null, filter.publishedOnly ?? false],
    db,
  );
}

export async function listAllMedia(db: Queryable = pool()): Promise<(Media & { venue_name: string | null; room_type_name: string | null })[]> {
  return query(
    `SELECT m.*, v.name AS venue_name, rt.name AS room_type_name
       FROM media m LEFT JOIN venues v ON v.id = m.venue_id LEFT JOIN room_types rt ON rt.id = m.room_type_id
      ORDER BY m.created_at DESC LIMIT 500`,
    [],
    db,
  );
}

export async function insertMedia(
  m: {
    file_path: string;
    alt: string;
    caption: string | null;
    category: string;
    venue_id: string | null;
    room_type_id: string | null;
    width: number | null;
    height: number | null;
    uploaded_by: string;
  },
  db: Queryable = pool(),
) {
  return queryOne<{ id: string }>(
    `INSERT INTO media (file_path, alt, caption, category, venue_id, room_type_id, width, height, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [m.file_path, m.alt, m.caption, m.category, m.venue_id, m.room_type_id, m.width, m.height, m.uploaded_by],
    db,
  );
}

export async function updateMedia(
  id: string,
  m: { alt: string; caption: string | null; category: string; venue_id: string | null; room_type_id: string | null; is_published: boolean; sort_order: number },
  db: Queryable = pool(),
) {
  return queryOne<{ id: string }>(
    `UPDATE media SET alt=$2, caption=$3, category=$4, venue_id=$5, room_type_id=$6, is_published=$7, sort_order=$8
      WHERE id = $1 RETURNING id`,
    [id, m.alt, m.caption, m.category, m.venue_id, m.room_type_id, m.is_published, m.sort_order],
    db,
  );
}

export async function deleteMedia(id: string, db: Queryable = pool()) {
  return queryOne<{ file_path: string }>("DELETE FROM media WHERE id = $1 RETURNING file_path", [id], db);
}
