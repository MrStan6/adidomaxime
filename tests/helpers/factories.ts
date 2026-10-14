import { query, queryOne } from "@/server/db";
import { buildSiteConfig, loadSettings, updateSettings } from "@/server/settings";
import { createUser } from "@/server/repositories/users";

export async function makeUser(role: "admin" | "commercial" | "reception" | "comptabilite" = "admin", email?: string) {
  const u = await createUser(
    { email: email ?? `${role}-${Math.random().toString(36).slice(2, 8)}@example.test`, full_name: `Test ${role}`, role, password: "MotDePasse-Test-123" },
    null,
  );
  return u.id;
}

export async function venueIds() {
  const rows = await query<{ id: string; slug: string }>("SELECT id, slug FROM venues ORDER BY sort_order");
  return { salle1: rows[0]!.id, salle2: rows[1]!.id };
}

/** Crée une catégorie de chambres « de test » avec N chambres en service et un tarif. */
export async function makeRoomType(opts: { units?: number; nightly?: number; from?: string; to?: string; currency?: string } = {}) {
  const rt = await queryOne<{ id: string }>(
    `INSERT INTO room_types (slug, name, max_adults, max_children, max_occupancy, bed_count, is_published)
     VALUES ($1, 'Chambre test', 2, 1, 3, 1, true) RETURNING id`,
    [`test-${Math.random().toString(36).slice(2, 8)}`],
  );
  for (let i = 0; i < (opts.units ?? 1); i++) {
    await query("INSERT INTO rooms (code, room_type_id, operational_status) VALUES ($1, $2, 'in_service')", [
      `T${Math.random().toString(36).slice(2, 7)}${i}`,
      rt!.id,
    ]);
  }
  await query("INSERT INTO room_rates (room_type_id, starts_on, ends_on, nightly_amount, currency) VALUES ($1,$2,$3,$4,$5)", [
    rt!.id,
    opts.from ?? "2030-01-01",
    opts.to ?? "2030-12-31",
    opts.nightly ?? 50000,
    opts.currency ?? "XOF",
  ]);
  return rt!.id;
}

export async function openRoomBooking(paymentMode: "on_confirmation" | "online" = "on_confirmation", actorId: string) {
  await updateSettings(
    { "rooms.booking_enabled": "true", "rooms.public_status": "open", "commerce.currency": "XOF", "rooms.payment_mode": paymentMode },
    actorId,
  );
  return buildSiteConfig(await loadSettings());
}
