import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { query, queryOne } from "@/server/db";
import { authenticate } from "@/server/auth/login";
import { createSession, destroyUserSessions, findSessionUser } from "@/server/auth/session";
import { getDashboardStats } from "@/server/repositories/dashboard";
import { createUser, updateUserAccess, UserError } from "@/server/repositories/users";
import { createDraftInvoice, issueInvoice } from "@/server/repositories/invoices";
import { findOrCreateCustomer } from "@/server/repositories/customers";
import { pool } from "@/server/db";
import { closeDatabase, resetDatabase } from "../helpers/db";

beforeAll(resetDatabase);
afterAll(closeDatabase);

describe("tableau de bord", () => {
  it("affiche des zéros sur une base vide (aucun chiffre inventé)", async () => {
    const s = await getDashboardStats();
    expect(s.quotesTotal).toBe(0);
    expect(s.quotesOpen).toBe(0);
    expect(s.venueConfirmedUpcoming).toBe(0);
    expect(s.paymentsSucceededCount).toBe(0);
    expect(s.revenue).toEqual([]);
  });
});

describe("authentification", () => {
  let userId: string;
  beforeAll(async () => {
    userId = (await createUser({ email: "Admin@Example.test", full_name: "Admin", role: "admin", password: "Un-Mot-De-Passe-42" }, null)).id;
  });

  it("connecte avec les bons identifiants (courriel insensible à la casse)", async () => {
    expect(await authenticate("admin@example.TEST", "Un-Mot-De-Passe-42", "ip1")).toEqual({ ok: true, userId });
  });

  it("refuse un mauvais mot de passe ou un compte inconnu avec le même message", async () => {
    expect(await authenticate("admin@example.test", "faux", "ip2")).toEqual({ ok: false, error: "invalid" });
    expect(await authenticate("inconnu@example.test", "faux", "ip2")).toEqual({ ok: false, error: "invalid" });
  });

  it("bloque après 5 échecs sur un compte, même avec le bon mot de passe ensuite", async () => {
    for (let i = 0; i < 5; i++) await authenticate("admin@example.test", "faux", `ip-${i}`);
    expect(await authenticate("admin@example.test", "Un-Mot-De-Passe-42", "ip-x")).toEqual({ ok: false, error: "rate_limited" });
    await query("DELETE FROM rate_limit_events");
  });

  it("gère les sessions : validité, expiration, révocation et compte désactivé", async () => {
    const { token } = await createSession(userId);
    expect((await findSessionUser(token))?.id).toBe(userId);
    expect(await findSessionUser("jeton-invalide-mais-assez-long")).toBeNull();
    const stored = await queryOne<{ id: string }>("SELECT id FROM sessions LIMIT 1");
    expect(stored!.id).not.toBe(token); // seul le hachage est stocké

    const { token: t2 } = await createSession(userId);
    await query("UPDATE sessions SET expires_at = now() - interval '1 second'");
    expect(await findSessionUser(t2)).toBeNull();

    const { token: t3 } = await createSession(userId);
    await destroyUserSessions(userId);
    expect(await findSessionUser(t3)).toBeNull();
  });

  it("refuse un compte désactivé et protège le dernier administrateur", async () => {
    const other = await createUser({ email: "reception@example.test", full_name: "Réception", role: "reception", password: "Un-Mot-De-Passe-43" }, userId);
    await updateUserAccess(other.id, { role: "reception", is_active: false, full_name: "Réception" }, userId);
    expect(await authenticate("reception@example.test", "Un-Mot-De-Passe-43", "ip9")).toEqual({ ok: false, error: "invalid" });
    await expect(updateUserAccess(userId, { role: "commercial", is_active: true, full_name: "Admin" }, userId)).rejects.toBeInstanceOf(UserError);
    await expect(createUser({ email: "ADMIN@example.test", full_name: "Doublon", role: "admin", password: "Un-Mot-De-Passe-44" }, userId)).rejects.toThrow(/existe déjà/);
  });
});

describe("factures", () => {
  it("numérote de façon continue à l'émission uniquement", async () => {
    const admin = (await queryOne<{ id: string }>("SELECT id FROM users WHERE role = 'admin' LIMIT 1"))!.id;
    const customer = await findOrCreateCustomer({ full_name: "Client Facture", email: "facture@example.test" }, pool());
    const drafts = [];
    for (let i = 0; i < 3; i++) drafts.push(await createDraftInvoice({ customer_id: customer, currency: "XOF", lines: [{ label: "Location", quantity: 1, unit_amount: 1000 }] }, admin));
    const numbers = await Promise.all(drafts.map((d) => issueInvoice(d.id, admin, new Date("2030-01-15T10:00:00Z"))));
    expect(numbers.sort()).toEqual(["F-2030-00001", "F-2030-00002", "F-2030-00003"]);
    await expect(issueInvoice(drafts[0]!.id, admin)).rejects.toThrow(/brouillon/);
  });
});
