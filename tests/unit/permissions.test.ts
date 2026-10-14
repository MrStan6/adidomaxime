import { describe, expect, it } from "vitest";
import { hasPermission, PERMISSIONS, permissionsFor } from "@/server/auth/permissions";

describe("matrice des permissions", () => {
  it("l'administrateur a toutes les permissions", () => {
    for (const p of PERMISSIONS) expect(hasPermission("admin", p)).toBe(true);
  });

  it("seul l'administrateur gère les utilisateurs, les paramètres et le journal", () => {
    for (const role of ["commercial", "reception", "comptabilite"]) {
      expect(hasPermission(role, "users.manage")).toBe(false);
      expect(hasPermission(role, "settings.manage")).toBe(false);
      expect(hasPermission(role, "audit.view")).toBe(false);
    }
  });

  it("la réception ne voit pas les informations financières", () => {
    expect(hasPermission("reception", "finance.view")).toBe(false);
    expect(hasPermission("reception", "payments.view")).toBe(false);
    expect(hasPermission("reception", "room_reservations.manage")).toBe(true);
  });

  it("la comptabilité a un accès limité aux informations financières", () => {
    expect(hasPermission("comptabilite", "payments.manage")).toBe(true);
    expect(hasPermission("comptabilite", "quotes.manage")).toBe(false);
    expect(hasPermission("comptabilite", "content.manage")).toBe(false);
    expect(hasPermission("comptabilite", "venue_bookings.manage")).toBe(false);
  });

  it("le commercial gère devis et salles mais pas les paiements", () => {
    expect(hasPermission("commercial", "quotes.manage")).toBe(true);
    expect(hasPermission("commercial", "venue_bookings.manage")).toBe(true);
    expect(hasPermission("commercial", "payments.manage")).toBe(false);
  });

  it("un rôle inconnu n'a aucune permission", () => {
    expect(permissionsFor("pirate")).toEqual([]);
    expect(hasPermission("pirate", "dashboard.view")).toBe(false);
  });
});
