import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { query, queryOne } from "@/server/db";
import { buildSiteConfig, loadSettings, updateSettings } from "@/server/settings";
import { bookingReadiness, changeRoomReservationStatus, createRoomBlock, createRoomReservation, getReservationByAccess, RoomBookingError, searchAvailability, priceStay } from "@/server/booking/rooms";
import { handleWebhook, processPaymentEvent, recordManualPayment, startRoomReservationPayment } from "@/server/payments/service";
import { demoProvider, DEMO_SIGNATURE_HEADER, signDemoPayload } from "@/server/payments/demo-provider";
import type { PaymentProvider } from "@/server/payments/types";
import { resetEnvCache } from "@/server/env";
import { closeDatabase, resetDatabase } from "../helpers/db";
import { makeRoomType, makeUser, openRoomBooking } from "../helpers/factories";

let admin: string;
beforeAll(async () => {
  await resetDatabase();
  admin = await makeUser("admin");
});
afterAll(closeDatabase);

const stay = (rt: string, over: Record<string, unknown> = {}) => ({
  room_type_id: rt,
  check_in: "2030-02-10",
  check_out: "2030-02-12",
  adults: 2,
  children: 0,
  rooms: 1,
  full_name: "Voyageur Test",
  phone: "+221770000010",
  email: "voyageur@example.test",
  expected_total: "100000.00",
  ...over,
});

describe("activation de la réservation de chambres", () => {
  it("est fermée par défaut, avec les raisons explicites", async () => {
    const r = await bookingReadiness(buildSiteConfig(await loadSettings()));
    expect(r.ready).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/pas activée/);
    expect(r.reasons.join(" ")).toMatch(/devise/);
  });

  it("refuse toute réservation tant que le module n'est pas prêt", async () => {
    const rt = await makeRoomType();
    const err = await createRoomReservation(stay(rt), buildSiteConfig(await loadSettings())).catch((e) => e);
    expect(err).toBeInstanceOf(RoomBookingError);
    expect((err as RoomBookingError).code).toBe("disabled");
    expect((await queryOne<{ n: string }>("SELECT count(*)::text n FROM room_reservations"))!.n).toBe("0");
  });

  it("est prête une fois catégorie, chambre, tarif, devise et activation configurés", async () => {
    const config = await openRoomBooking("on_confirmation", admin);
    expect((await bookingReadiness(config)).ready).toBe(true);
  });
});

describe("réservations de chambres", () => {
  it("calcule le prix côté serveur et refuse un prix modifié par le client", async () => {
    const config = await openRoomBooking("on_confirmation", admin);
    const rt = await makeRoomType({ nightly: 45000 });
    expect((await priceStay(rt, "2030-02-10", "2030-02-13", 2, undefined))?.total).toBe("270000.00");
    const err = await createRoomReservation(stay(rt, { expected_total: "1.00" }), config).catch((e) => e);
    expect((err as RoomBookingError).code).toBe("price_changed");
  });

  it("refuse les nuits sans tarif (hors période de commercialisation)", async () => {
    const config = await openRoomBooking("on_confirmation", admin);
    const rt = await makeRoomType({ from: "2030-01-01", to: "2030-01-31" });
    const err = await createRoomReservation(stay(rt, { check_in: "2030-01-30", check_out: "2030-02-02" }), config).catch((e) => e);
    expect((err as RoomBookingError).code).toBe("no_rate");
  });

  it("crée une réservation « en attente de confirmation » sans paiement en ligne", async () => {
    const config = await openRoomBooking("on_confirmation", admin);
    const rt = await makeRoomType();
    const res = await createRoomReservation(stay(rt), config);
    expect(res.status).toBe("pending_confirmation");
    expect(res.reference).toMatch(/^RC-/);
    const viaLink = await getReservationByAccess(res.reference, res.accessToken);
    expect(viaLink?.status).toBe("pending_confirmation");
    expect(await getReservationByAccess(res.reference, "mauvais-jeton")).toBeNull();
  });

  it("empêche la double réservation de la dernière chambre, même en simultané", async () => {
    const config = await openRoomBooking("on_confirmation", admin);
    const rt = await makeRoomType({ units: 1 });
    const results = await Promise.allSettled([
      createRoomReservation(stay(rt), config),
      createRoomReservation(stay(rt, { email: "b@example.test" }), config),
      createRoomReservation(stay(rt, { email: "c@example.test", check_in: "2030-02-11", check_out: "2030-02-13" }), config),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const units = await queryOne<{ n: string }>(
      "SELECT count(*)::text n FROM room_reservation_units u JOIN rooms r ON r.id = u.room_id WHERE r.room_type_id = $1 AND u.is_active",
      [rt],
    );
    expect(units!.n).toBe("1");
  });

  it("la contrainte de base de données bloque un chevauchement inséré directement", async () => {
    const rt = await makeRoomType({ units: 1 });
    const room = await queryOne<{ id: string }>("SELECT id FROM rooms WHERE room_type_id = $1", [rt]);
    await createRoomBlock(room!.id, "2030-03-01", "2030-03-05", "Maintenance", admin);
    await expect(
      query("INSERT INTO room_reservation_units (room_id, check_in, check_out, kind, block_reason) VALUES ($1,'2030-03-04','2030-03-06','block','x')", [room!.id]),
    ).rejects.toThrow(/room_units_no_overlap/);
  });

  it("une annulation libère la chambre", async () => {
    const config = await openRoomBooking("on_confirmation", admin);
    const rt = await makeRoomType({ units: 1 });
    const res = await createRoomReservation(stay(rt, { check_in: "2030-04-01", check_out: "2030-04-03" }), config);
    expect(await searchAvailability({ check_in: "2030-04-01", check_out: "2030-04-03", adults: 2, children: 0, rooms: 1 }).then((r) => r.some((x) => x.roomType.id === rt))).toBe(false);
    await changeRoomReservationStatus(res.id, "cancelled", admin, "Demande du client");
    expect(await searchAvailability({ check_in: "2030-04-01", check_out: "2030-04-03", adults: 2, children: 0, rooms: 1 }).then((r) => r.some((x) => x.roomType.id === rt))).toBe(true);
  });
});

describe("paiements", () => {
  let rt: string;
  beforeEach(async () => {
    rt = await makeRoomType({ units: 3 });
  });

  const signedEvent = (e: Record<string, string>) => {
    const body = JSON.stringify(e);
    return { body, headers: new Headers({ [DEMO_SIGNATURE_HEADER]: signDemoPayload(body) }) };
  };

  async function pendingReservation(dates = { check_in: "2030-05-01", check_out: "2030-05-03" }) {
    const config = await openRoomBooking("online", admin);
    const res = await createRoomReservation(stay(rt, dates), config);
    expect(res.status).toBe("pending_payment");
    expect(res.holdExpiresAt).not.toBeNull();
    const pay = await startRoomReservationPayment(res.id, demoProvider, "/retour");
    return { res, pay };
  }

  it("ne confirme rien sur simple redirection : seule une notification signée confirme", async () => {
    const { res, pay } = await pendingReservation();
    expect((await getReservationByAccess(res.reference, res.accessToken))?.status).toBe("pending_payment");
    const forged = await handleWebhook("demo", JSON.stringify({ event_id: "evt_forged_1", type: "payment", provider_reference: `demo_${pay.paymentReference}`, payment_reference: pay.paymentReference, status: "succeeded", amount: "100000.00", currency: "XOF" }), new Headers({ [DEMO_SIGNATURE_HEADER]: "faux" }));
    expect(forged.status).toBe(400);
    expect((await getReservationByAccess(res.reference, res.accessToken))?.status).toBe("pending_payment");

    const ok = signedEvent({ event_id: "evt_ok_1", type: "payment", provider_reference: `demo_${pay.paymentReference}`, payment_reference: pay.paymentReference, status: "succeeded", amount: "100000.00", currency: "XOF" });
    expect(await handleWebhook("demo", ok.body, ok.headers)).toEqual({ status: 200, outcome: "processed" });
    expect((await getReservationByAccess(res.reference, res.accessToken))?.status).toBe("confirmed");
  });

  it("traite une notification répétée une seule fois (pas de double encaissement)", async () => {
    const { res, pay } = await pendingReservation({ check_in: "2030-05-10", check_out: "2030-05-12" });
    const evt = signedEvent({ event_id: "evt_dup_1", type: "payment", provider_reference: `demo_${pay.paymentReference}`, payment_reference: pay.paymentReference, status: "succeeded", amount: "100000.00", currency: "XOF" });
    const outcomes = await Promise.all([1, 2, 3].map(() => handleWebhook("demo", evt.body, evt.headers)));
    expect(outcomes.filter((o) => o.outcome === "processed")).toHaveLength(1);
    expect(outcomes.filter((o) => o.outcome === "duplicate")).toHaveLength(2);
    const paid = await getReservationByAccess(res.reference, res.accessToken);
    expect(paid?.paid_amount).toBe("100000.00");
    expect((await queryOne<{ n: string }>("SELECT count(*)::text n FROM payment_events WHERE event_id = 'evt_dup_1'"))!.n).toBe("1");
  });

  it("refuse un montant ou une devise qui ne correspondent pas", async () => {
    const { res, pay } = await pendingReservation({ check_in: "2030-05-20", check_out: "2030-05-22" });
    const evt = signedEvent({ event_id: "evt_mismatch_1", type: "payment", provider_reference: `demo_${pay.paymentReference}`, payment_reference: pay.paymentReference, status: "succeeded", amount: "1.00", currency: "XOF" });
    expect((await handleWebhook("demo", evt.body, evt.headers)).outcome).toBe("amount_mismatch");
    expect((await getReservationByAccess(res.reference, res.accessToken))?.status).toBe("pending_payment");
  });

  it("une erreur du prestataire marque la tentative comme échouée, jamais réussie", async () => {
    const config = await openRoomBooking("online", admin);
    const res = await createRoomReservation(stay(rt, { check_in: "2030-06-01", check_out: "2030-06-03" }), config);
    const broken: PaymentProvider = { ...demoProvider, id: "demo", createCheckout: async () => { throw new Error("timeout"); } };
    await expect(startRoomReservationPayment(res.id, broken, "/retour")).rejects.toThrow(/indisponible/);
    const p = await queryOne<{ status: string }>("SELECT status FROM payments WHERE room_reservation_id = $1", [res.id]);
    expect(p!.status).toBe("failed");
    expect((await getReservationByAccess(res.reference, res.accessToken))?.status).toBe("pending_payment");
  });

  it("libère les chambres à l'expiration du délai, et un paiement tardif est mis en vérification", async () => {
    const { res, pay } = await pendingReservation({ check_in: "2030-07-01", check_out: "2030-07-03" });
    await query("UPDATE room_reservations SET hold_expires_at = now() - interval '1 minute' WHERE id = $1", [res.id]);
    // une nouvelle réservation déclenche l'expiration des délais dépassés
    const config = await openRoomBooking("online", admin);
    await createRoomReservation(stay(rt, { check_in: "2030-08-01", check_out: "2030-08-02", expected_total: "50000.00" }), config);
    expect((await getReservationByAccess(res.reference, res.accessToken))?.status).toBe("expired");
    const late = signedEvent({ event_id: "evt_late_1", type: "payment", provider_reference: `demo_${pay.paymentReference}`, payment_reference: pay.paymentReference, status: "succeeded", amount: "100000.00", currency: "XOF" });
    expect((await handleWebhook("demo", late.body, late.headers)).outcome).toBe("needs_review");
    const row = await getReservationByAccess(res.reference, res.accessToken);
    expect(row?.status).toBe("expired");
    expect(row?.needs_review).toBe(true);
  });

  it("le prestataire de démonstration est refusé en mode production", async () => {
    const evt = signedEvent({ event_id: "evt_prod", type: "payment", provider_reference: "x", payment_reference: "y", status: "succeeded", amount: "1.00", currency: "XOF" });
    process.env.APP_MODE = "production";
    resetEnvCache();
    try {
      // la configuration elle-même est rejetée
      await expect(handleWebhook("demo", evt.body, evt.headers)).rejects.toThrow(/interdit en mode production/);
    } finally {
      process.env.APP_MODE = "demo";
      resetEnvCache();
    }
  });

  it("enregistre un paiement manuel tracé et marque les transactions de démo", async () => {
    const config = await openRoomBooking("on_confirmation", admin);
    const res = await createRoomReservation(stay(rt, { check_in: "2030-09-01", check_out: "2030-09-03" }), config);
    await recordManualPayment({ target: { type: "room_reservation", id: res.id }, amount: 100000, currency: "XOF", method: "cash", payment_type: "full" }, admin);
    const p = await queryOne<{ status: string; recorded_by: string; is_demo: boolean }>("SELECT status, recorded_by, is_demo FROM payments WHERE room_reservation_id = $1", [res.id]);
    expect(p).toEqual({ status: "succeeded", recorded_by: admin, is_demo: false });
    const demo = await queryOne<{ n: string }>("SELECT count(*)::text n FROM payments WHERE provider = 'demo' AND NOT is_demo");
    expect(demo!.n).toBe("0");
    await expect(query("DELETE FROM payments")).rejects.toThrow(/Suppression interdite/);
  });

  it("ignore un événement inconnu sans effet de bord", async () => {
    expect(await processPaymentEvent("demo", { eventId: "evt_unknown", type: "payment", providerReference: "inconnu", paymentReference: "PY-0", status: "succeeded", amount: "1", currency: "XOF", raw: {} })).toBe("unknown_payment");
  });
});

afterAll(async () => {
  await updateSettings({ "rooms.booking_enabled": "false" }, admin).catch(() => undefined);
});
