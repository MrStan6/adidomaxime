import { describe, expect, it } from "vitest";
import { checkFormGuard, issueFormToken, HONEYPOT_FIELD, FORM_TOKEN_FIELD } from "@/server/security/form-guard";
import { canTransitionQuote } from "@/server/repositories/quotes";
import { fitsCapacity } from "@/server/booking/rooms";

const fd = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};

describe("protection anti-robots", () => {
  it("accepte un formulaire rempli normalement", () => {
    const t = issueFormToken("quote", Date.now() - 10_000);
    expect(checkFormGuard("quote", fd({ [FORM_TOKEN_FIELD]: t }))).toEqual({ ok: true });
  });
  it("refuse le pot de miel rempli", () => {
    const t = issueFormToken("quote", Date.now() - 10_000);
    expect(checkFormGuard("quote", fd({ [FORM_TOKEN_FIELD]: t, [HONEYPOT_FIELD]: "http://spam" })).ok).toBe(false);
  });
  it("refuse une soumission trop rapide, expirée ou falsifiée", () => {
    expect(checkFormGuard("quote", fd({ [FORM_TOKEN_FIELD]: issueFormToken("quote") })).ok).toBe(false);
    expect(checkFormGuard("quote", fd({ [FORM_TOKEN_FIELD]: issueFormToken("quote", Date.now() - 2 * 86400000) })).ok).toBe(false);
    expect(checkFormGuard("quote", fd({ [FORM_TOKEN_FIELD]: `${Date.now() - 10000}.deadbeef` })).ok).toBe(false);
    expect(checkFormGuard("contact", fd({ [FORM_TOKEN_FIELD]: issueFormToken("quote", Date.now() - 10_000) })).ok).toBe(false);
  });
});

describe("statuts commerciaux", () => {
  it("suit un parcours cohérent", () => {
    expect(canTransitionQuote("new", "to_process")).toBe(true);
    expect(canTransitionQuote("preparing", "sent")).toBe(true);
    expect(canTransitionQuote("sent", "accepted")).toBe(true);
    expect(canTransitionQuote("new", "accepted")).toBe(false); // pas d'acceptation sans devis envoyé
    expect(canTransitionQuote("accepted", "new")).toBe(false);
  });
});

describe("capacité des chambres", () => {
  const rt = { max_adults: 2, max_children: 1, max_occupancy: 3 };
  it("répartit les voyageurs entre les chambres", () => {
    expect(fitsCapacity(rt, 2, 1, 1)).toBe(true);
    expect(fitsCapacity(rt, 3, 0, 1)).toBe(false);
    expect(fitsCapacity(rt, 4, 2, 2)).toBe(true);
    expect(fitsCapacity(rt, 1, 0, 2)).toBe(false); // une chambre sans adulte
  });
});
