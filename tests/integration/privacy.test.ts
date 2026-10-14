import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { query, queryOne } from "@/server/db";
import { createQuoteRequest } from "@/server/repositories/quotes";
import { eraseCustomerData, purgeOldContactMessages } from "@/server/privacy";
import { closeDatabase, resetDatabase } from "../helpers/db";

beforeAll(resetDatabase);
afterAll(closeDatabase);

describe("protection des données personnelles", () => {
  it("anonymise un client sans supprimer sa demande de devis (traçabilité)", async () => {
    const q = await createQuoteRequest({
      request_type: "quote",
      full_name: "Personne À Effacer",
      phone: "+221770000099",
      email: "Efface@Example.test",
      event_type: "Réunion",
      venue_id: null,
      event_date: "2030-05-02",
      participants: 12,
      equipment: [],
      message: "Mon numéro perso est le 0600000000",
      source: "website",
      privacy_accepted: true,
    });
    await query(
      `INSERT INTO contact_messages (full_name, email, topic, message, privacy_accepted_at)
       VALUES ('Personne À Effacer', 'efface@example.test', 'general', 'Bonjour', now())`,
    );

    const r = await eraseCustomerData("efface@EXAMPLE.test");
    expect(r).toEqual({ customers: 1, contactMessages: 1 });

    const row = await queryOne<{ reference: string; message: string | null; full_name: string; email: string | null; phone: string | null }>(
      `SELECT q.reference, q.message, c.full_name, c.email, c.phone
         FROM quote_requests q JOIN customers c ON c.id = q.customer_id WHERE q.id = $1`,
      [q.id],
    );
    expect(row?.reference).toBe(q.reference); // la demande existe toujours
    expect(row?.full_name).toBe("Client anonymisé");
    expect(row?.email).toBeNull();
    expect(row?.phone).toBeNull();
    expect(row?.message).toBeNull();
    const msg = await queryOne<{ email: string | null; message: string }>("SELECT email, message FROM contact_messages");
    expect(msg?.email).toBeNull();
    expect(msg?.message).not.toContain("Bonjour");
    const log = await queryOne<{ details: Record<string, unknown> }>("SELECT details FROM audit_log WHERE action = 'privacy.erase'");
    expect(JSON.stringify(log?.details)).not.toContain("efface@");
  });

  it("ne purge que les messages traités plus anciens que la durée fixée", async () => {
    await query("DELETE FROM contact_messages");
    await query(
      `INSERT INTO contact_messages (full_name, email, topic, message, status, privacy_accepted_at, created_at) VALUES
        ('Ancien traité', 'a@example.test', 'general', 'x', 'handled', now(), now() - interval '30 months'),
        ('Ancien non traité', 'b@example.test', 'general', 'x', 'new', now(), now() - interval '30 months'),
        ('Récent traité', 'c@example.test', 'general', 'x', 'handled', now(), now() - interval '2 months')`,
    );
    expect(await purgeOldContactMessages(24)).toBe(1);
    const left = await query<{ full_name: string }>("SELECT full_name FROM contact_messages ORDER BY full_name");
    expect(left.map((l) => l.full_name)).toEqual(["Ancien non traité", "Récent traité"]);
    await expect(purgeOldContactMessages(0)).rejects.toThrow();
  });
});
