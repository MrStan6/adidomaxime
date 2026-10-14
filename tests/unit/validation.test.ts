import { describe, expect, it } from "vitest";
import { contactSchema, quoteRequestSchema, roomSearchSchema } from "@/lib/validation/public-forms";
import { fieldErrors } from "@/lib/validation/common";

const future = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

const validQuote = {
  request_type: "quote",
  full_name: "Awa Diallo",
  phone: "+221 77 000 00 00",
  email: "awa@example.org",
  event_type: "Séminaire",
  venue: "recommend",
  event_date: future(30),
  start_time: "09:00",
  end_time: "17:00",
  participants: "40",
  equipment: ["Sonorisation"],
  privacy: "on",
};

describe("formulaire de devis", () => {
  it("accepte une demande complète", () => {
    const r = quoteRequestSchema.safeParse(validQuote);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.participants).toBe(40);
      expect(r.data.phone).toBe("+221770000000");
    }
  });

  it("signale chaque champ obligatoire manquant avec un message clair", () => {
    const r = quoteRequestSchema.safeParse({ privacy: undefined });
    expect(r.success).toBe(false);
    if (!r.success) {
      const errs = fieldErrors(r.error);
      for (const f of ["full_name", "phone", "email", "event_type", "venue", "event_date", "start_time", "end_time", "participants", "privacy"]) {
        expect(errs[f], f).toBeTruthy();
      }
      expect(errs.privacy).toMatch(/politique de confidentialité/);
    }
  });

  it("refuse une date passée", () => {
    const r = quoteRequestSchema.safeParse({ ...validQuote, event_date: "2020-01-01" });
    expect(r.success).toBe(false);
  });

  it("refuse une heure de fin antérieure au début", () => {
    const r = quoteRequestSchema.safeParse({ ...validQuote, start_time: "18:00", end_time: "09:00" });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).end_time).toBeTruthy();
  });

  it("refuse une adresse électronique ou un téléphone invalides", () => {
    const r = quoteRequestSchema.safeParse({ ...validQuote, email: "pas-un-email", phone: "12" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const e = fieldErrors(r.error);
      expect(e.email).toBeTruthy();
      expect(e.phone).toBeTruthy();
    }
  });

  it("refuse un identifiant de salle arbitraire", () => {
    expect(quoteRequestSchema.safeParse({ ...validQuote, venue: "'; DROP TABLE venues;--" }).success).toBe(false);
  });

  it("refuse un équipement hors liste", () => {
    expect(quoteRequestSchema.safeParse({ ...validQuote, equipment: ["<script>"] }).success).toBe(false);
  });
});

describe("formulaire de contact", () => {
  it("exige au moins un moyen de contact", () => {
    const r = contactSchema.safeParse({ full_name: "Jean", topic: "general", message: "Bonjour, une question.", privacy: "on" });
    expect(r.success).toBe(false);
  });
  it("accepte un message avec téléphone seul", () => {
    const r = contactSchema.safeParse({ full_name: "Jean", phone: "0102030405", topic: "general", message: "Bonjour, une question.", privacy: "on" });
    expect(r.success).toBe(true);
  });
});

describe("recherche de chambres", () => {
  it("refuse un départ avant l'arrivée", () => {
    const r = roomSearchSchema.safeParse({ check_in: future(10), check_out: future(9), adults: 1, children: 0, rooms: 1 });
    expect(r.success).toBe(false);
  });
  it("exige au moins un adulte par chambre", () => {
    const r = roomSearchSchema.safeParse({ check_in: future(10), check_out: future(12), adults: 1, children: 0, rooms: 2 });
    expect(r.success).toBe(false);
  });
});
