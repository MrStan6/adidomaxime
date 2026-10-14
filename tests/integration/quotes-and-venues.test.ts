import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { query, queryOne } from "@/server/db";
import { createQuoteRequest, getQuote, QuoteTransitionError, updateQuoteCommercial } from "@/server/repositories/quotes";
import { changeVenueBookingStatus, createVenueBooking, VenueBookingError, VenueConflictError } from "@/server/repositories/venue-bookings";
import { closeDatabase, resetDatabase } from "../helpers/db";
import { makeUser, venueIds } from "../helpers/factories";

let admin: string;
let v: { salle1: string; salle2: string };

beforeAll(async () => {
  await resetDatabase();
  admin = await makeUser("commercial");
  v = await venueIds();
});
afterAll(closeDatabase);

const baseQuote = {
  request_type: "quote" as const,
  full_name: "Client Test",
  phone: "+221770000001",
  email: "client@example.test",
  event_type: "Séminaire",
  venue_id: null,
  event_date: "2030-03-10",
  start_time: "09:00",
  end_time: "17:00",
  participants: 50,
  equipment: ["Sonorisation"],
  source: "website" as const,
  privacy_accepted: true,
};

describe("demandes de devis", () => {
  it("enregistre la demande avec une référence unique et le statut « nouveau »", async () => {
    const q = await createQuoteRequest(baseQuote);
    expect(q.reference).toMatch(/^DV-\d{4}-\d{6}$/);
    const detail = await getQuote(q.id);
    expect(detail?.status).toBe("new");
    expect(detail?.privacy_accepted_at).not.toBeNull();
  });

  it("ne crée pas de doublon de fiche client (même courriel)", async () => {
    await createQuoteRequest({ ...baseQuote, phone: "+221770000099" });
    const n = await queryOne<{ n: string }>("SELECT count(*)::text n FROM customers WHERE lower(email) = 'client@example.test'");
    expect(n!.n).toBe("1");
  });

  it("refuse une demande du site sans consentement (contrainte en base)", async () => {
    await expect(createQuoteRequest({ ...baseQuote, privacy_accepted: false })).rejects.toThrow();
  });

  it("modifie le suivi commercial et respecte les transitions", async () => {
    const q = await createQuoteRequest(baseQuote);
    const update = { quoted_amount: null, quoted_currency: null, follow_up_on: "2030-02-01", assigned_to: admin, venue_id: v.salle1, event_date: "2030-03-10", start_time: "09:00", end_time: "17:00", participants: 60 };
    await updateQuoteCommercial(q.id, { ...update, status: "preparing" }, admin);
    await expect(updateQuoteCommercial(q.id, { ...update, status: "new" }, admin)).rejects.toBeInstanceOf(QuoteTransitionError);
    await expect(updateQuoteCommercial(q.id, { ...update, status: "sent", quoted_amount: 1000 }, admin)).rejects.toThrow(/devise/);
    await updateQuoteCommercial(q.id, { ...update, status: "sent", quoted_amount: 1000, quoted_currency: "XOF" }, admin);
    const d = await getQuote(q.id);
    expect(d?.status).toBe("sent");
    expect(d?.quote_sent_at).not.toBeNull();
    expect(d?.participants).toBe(60);
    const notes = await query("SELECT kind FROM quote_notes WHERE quote_id = $1", [q.id]);
    expect(notes.length).toBe(2);
  });

  it("interdit la suppression d'une demande (traçabilité)", async () => {
    const q = await createQuoteRequest(baseQuote);
    await expect(query("DELETE FROM quote_requests WHERE id = $1", [q.id])).rejects.toThrow(/Suppression interdite/);
  });
});

const booking = (over: Partial<Parameters<typeof createVenueBooking>[0]> = {}) => ({
  kind: "booking" as const,
  venue_id: v.salle1,
  title: "Séminaire",
  start_date: "2030-05-10",
  start_time: "09:00",
  end_date: "2030-05-10",
  end_time: "17:00",
  status: "option" as const,
  timezone: "Africa/Abidjan",
  customer: { full_name: "Client Salle", phone: "+221770000002" },
  ...over,
});

describe("réservations de salles et conflits", () => {
  it("refuse un chevauchement sur la même salle", async () => {
    await createVenueBooking(booking(), admin);
    const err = await createVenueBooking(booking({ start_time: "16:00", end_time: "20:00" }), admin).catch((e) => e);
    expect(err).toBeInstanceOf(VenueConflictError);
    expect((err as VenueConflictError).conflicts).toHaveLength(1);
  });

  it("accepte la même période dans l'autre salle et un créneau adjacent", async () => {
    await expect(createVenueBooking(booking({ venue_id: v.salle2 }), admin)).resolves.toBeTruthy();
    await expect(createVenueBooking(booking({ start_time: "17:00", end_time: "22:00" }), admin)).resolves.toBeTruthy();
  });

  it("un blocage de maintenance empêche aussi la réservation", async () => {
    await createVenueBooking(booking({ kind: "block", block_reason: "maintenance", start_date: "2030-06-01", end_date: "2030-06-03", start_time: "00:00", end_time: "00:00", customer: null }), admin);
    await expect(createVenueBooking(booking({ start_date: "2030-06-02", end_date: "2030-06-02" }), admin)).rejects.toBeInstanceOf(VenueConflictError);
  });

  it("une annulation libère le créneau", async () => {
    const b = await createVenueBooking(booking({ start_date: "2030-07-01", end_date: "2030-07-01" }), admin);
    await expect(changeVenueBookingStatus(b.id, "cancelled", admin, {})).rejects.toThrow(/motif/);
    await changeVenueBookingStatus(b.id, "cancelled", admin, { reason: "Client a renoncé" });
    await expect(createVenueBooking(booking({ start_date: "2030-07-01", end_date: "2030-07-01" }), admin)).resolves.toBeTruthy();
  });

  it("deux réservations simultanées du même créneau : une seule réussit", async () => {
    const results = await Promise.allSettled([
      createVenueBooking(booking({ start_date: "2030-08-01", end_date: "2030-08-01" }), admin),
      createVenueBooking(booking({ start_date: "2030-08-01", end_date: "2030-08-01", start_time: "10:00" }), admin),
      createVenueBooking(booking({ start_date: "2030-08-01", end_date: "2030-08-01", start_time: "11:00" }), admin),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected").every((r) => (r as PromiseRejectedResult).reason instanceof VenueConflictError)).toBe(true);
  });

  it("une confirmation exige l'attestation des conditions de la direction", async () => {
    const b = await createVenueBooking(booking({ start_date: "2030-09-01", end_date: "2030-09-01" }), admin);
    await expect(changeVenueBookingStatus(b.id, "confirmed", admin)).rejects.toBeInstanceOf(VenueBookingError);
    await changeVenueBookingStatus(b.id, "confirmed", admin, { conditionsMet: true });
    const row = await queryOne<{ status: string; confirmed_by: string }>("SELECT status, confirmed_by FROM venue_bookings WHERE id = $1", [b.id]);
    expect(row).toEqual({ status: "confirmed", confirmed_by: admin });
    await expect(changeVenueBookingStatus(b.id, "option", admin)).rejects.toThrow(/non autorisé/);
  });

  it("enregistre les heures dans le fuseau de l'établissement", async () => {
    const b = await createVenueBooking(booking({ venue_id: v.salle2, start_date: "2030-10-01", end_date: "2030-10-01", start_time: "09:00", timezone: "Africa/Lagos" }), admin);
    const row = await queryOne<{ utc: string }>("SELECT to_char(starts_at AT TIME ZONE 'UTC', 'HH24:MI') utc FROM venue_bookings WHERE id = $1", [b.id]);
    expect(row!.utc).toBe("08:00"); // Lagos = UTC+1
  });

  it("garde l'historique de chaque opération", async () => {
    const n = await queryOne<{ n: string }>("SELECT count(*)::text n FROM audit_log WHERE entity_type = 'venue_booking'");
    expect(Number(n!.n)).toBeGreaterThan(5);
    await expect(query("DELETE FROM audit_log")).rejects.toThrow(/ajout seul/);
    await expect(query("DELETE FROM venue_bookings")).rejects.toThrow(/Suppression interdite/);
  });
});
