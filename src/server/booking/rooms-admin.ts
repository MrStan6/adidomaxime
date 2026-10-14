import { query, queryOne, withTransaction, PG, pgErrorCode, pgConstraint, type Queryable, pool } from "../db";
import { audit } from "../audit";

/** Gestion administrative de l'hébergement (catégories, chambres, tarifs). */
export class RoomAdminError extends Error {}

export type RoomTypeInput = {
  name: string;
  slug: string;
  description: string;
  max_adults: number;
  max_children: number;
  max_occupancy: number;
  bed_count: number;
  bed_description: string;
  amenities: string[];
  stay_rules: string;
  cancellation_policy: string;
  is_published: boolean;
  sort_order: number;
};

export async function saveRoomType(id: string | null, i: RoomTypeInput, userId: string) {
  if (i.max_occupancy > i.max_adults + i.max_children) throw new RoomAdminError("La capacité totale ne peut pas dépasser adultes + enfants.");
  const params = [i.name, i.slug, i.description, i.max_adults, i.max_children, i.max_occupancy, i.bed_count, i.bed_description, i.amenities, i.stay_rules, i.cancellation_policy, i.is_published, i.sort_order];
  try {
    return await withTransaction(async (db) => {
      const row = id
        ? await queryOne<{ id: string }>(
            `UPDATE room_types SET name=$1, slug=$2, description=$3, max_adults=$4, max_children=$5, max_occupancy=$6, bed_count=$7,
               bed_description=$8, amenities=$9, stay_rules=$10, cancellation_policy=$11, is_published=$12, sort_order=$13 WHERE id=$14 RETURNING id`,
            [...params, id],
            db,
          )
        : await queryOne<{ id: string }>(
            `INSERT INTO room_types (name, slug, description, max_adults, max_children, max_occupancy, bed_count, bed_description,
               amenities, stay_rules, cancellation_policy, is_published, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
            params,
            db,
          );
      if (!row) throw new RoomAdminError("Catégorie introuvable.");
      await audit({ actorId: userId, action: id ? "room_type.updated" : "room_type.created", entityType: "room_type", entityId: row.id, details: { name: i.name, published: i.is_published } }, db);
      return row;
    });
  } catch (err) {
    if (pgErrorCode(err) === PG.UNIQUE_VIOLATION) throw new RoomAdminError("Cette adresse de page est déjà utilisée.");
    throw err;
  }
}

export async function saveRoom(id: string | null, r: { code: string; room_type_id: string; operational_status: string; notes: string | null }, userId: string) {
  try {
    return await withTransaction(async (db) => {
      const row = id
        ? await queryOne<{ id: string }>("UPDATE rooms SET code=$1, room_type_id=$2, operational_status=$3, notes=$4 WHERE id=$5 RETURNING id", [r.code, r.room_type_id, r.operational_status, r.notes, id], db)
        : await queryOne<{ id: string }>("INSERT INTO rooms (code, room_type_id, operational_status, notes) VALUES ($1,$2,$3,$4) RETURNING id", [r.code, r.room_type_id, r.operational_status, r.notes], db);
      if (!row) throw new RoomAdminError("Chambre introuvable.");
      await audit({ actorId: userId, action: id ? "room.updated" : "room.created", entityType: "room", entityId: row.id, details: r }, db);
      return row;
    });
  } catch (err) {
    if (pgErrorCode(err) === PG.UNIQUE_VIOLATION) throw new RoomAdminError("Ce numéro de chambre existe déjà.");
    throw err;
  }
}

export async function addRate(r: { room_type_id: string; starts_on: string; ends_on: string; nightly_amount: number; currency: string; label: string | null }, userId: string) {
  if (r.ends_on <= r.starts_on) throw new RoomAdminError("La fin de période doit être après le début.");
  try {
    return await withTransaction(async (db) => {
      const row = await queryOne<{ id: string }>(
        "INSERT INTO room_rates (room_type_id, starts_on, ends_on, nightly_amount, currency, label) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
        [r.room_type_id, r.starts_on, r.ends_on, r.nightly_amount, r.currency, r.label],
        db,
      );
      await audit({ actorId: userId, action: "room_rate.created", entityType: "room_type", entityId: r.room_type_id, details: r }, db);
      return row!;
    });
  } catch (err) {
    if (pgErrorCode(err) === PG.EXCLUSION_VIOLATION && pgConstraint(err) === "room_rates_no_overlap") {
      throw new RoomAdminError("Cette période chevauche un tarif existant pour cette catégorie.");
    }
    throw err;
  }
}

export async function deleteRate(id: string, userId: string) {
  await withTransaction(async (db) => {
    const r = await queryOne("DELETE FROM room_rates WHERE id = $1 RETURNING room_type_id, starts_on, ends_on, nightly_amount", [id], db);
    await audit({ actorId: userId, action: "room_rate.deleted", entityType: "room_rate", entityId: id, details: r ?? {} }, db);
  });
}

export async function listRooms(db: Queryable = pool()) {
  return query<{ id: string; code: string; room_type_id: string; room_type_name: string; operational_status: string; notes: string | null; is_demo: boolean }>(
    "SELECT r.id, r.code, r.room_type_id, rt.name AS room_type_name, r.operational_status, r.notes, r.is_demo FROM rooms r JOIN room_types rt ON rt.id = r.room_type_id ORDER BY r.code",
    [],
    db,
  );
}

export async function listRates(roomTypeId: string, db: Queryable = pool()) {
  return query<{ id: string; starts_on: string; ends_on: string; nightly_amount: string; currency: string; label: string | null }>(
    `SELECT id, to_char(starts_on,'YYYY-MM-DD') starts_on, to_char(ends_on,'YYYY-MM-DD') ends_on, nightly_amount, currency, label
       FROM room_rates WHERE room_type_id = $1 ORDER BY starts_on`,
    [roomTypeId],
    db,
  );
}

export async function listActiveBlocks(db: Queryable = pool()) {
  return query<{ id: string; room_code: string; check_in: string; check_out: string; block_reason: string }>(
    `SELECT u.id, r.code AS room_code, to_char(u.check_in,'YYYY-MM-DD') check_in, to_char(u.check_out,'YYYY-MM-DD') check_out, u.block_reason
       FROM room_reservation_units u JOIN rooms r ON r.id = u.room_id
      WHERE u.kind = 'block' AND u.is_active AND u.check_out >= current_date ORDER BY u.check_in`,
    [],
    db,
  );
}
