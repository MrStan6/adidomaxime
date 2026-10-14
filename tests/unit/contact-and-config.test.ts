import { describe, expect, it } from "vitest";
import { normalizePhone, telLink, whatsappLink, whatsappMessage, mailtoLink } from "@/lib/contact-links";
import { buildSiteConfig } from "@/server/settings";
import { formatMoney, parseTitledList } from "@/lib/format";
import { lodgingStatus } from "@/components/public/lodging-status";

describe("liens de contact", () => {
  it("n'affiche aucun lien si la coordonnée est absente ou invalide", () => {
    expect(telLink("")).toBeNull();
    expect(telLink(undefined)).toBeNull();
    expect(whatsappLink("")).toBeNull();
    expect(whatsappLink("123")).toBeNull();
    expect(mailtoLink("pas un mail")).toBeNull();
  });
  it("exige le format international pour WhatsApp", () => {
    expect(whatsappLink("0612345678")).toBeNull();
    expect(whatsappLink("+33 6 12 34 56 78")).toBe("https://wa.me/33612345678");
    expect(whatsappLink("0033612345678")).toBe("https://wa.me/33612345678");
  });
  it("encode le message prérempli", () => {
    const link = whatsappLink("+33612345678", whatsappMessage("venue_quote", { venueName: "Salle 1" }))!;
    expect(link).toContain("?text=");
    expect(decodeURIComponent(link.split("?text=")[1]!)).toContain("devis");
  });
  it("normalise les numéros", () => {
    expect(normalizePhone(" +221 (77) 000-00-00 ")).toBe("+221770000000");
  });
});

describe("configuration du site", () => {
  it("masque tout ce qui n'est pas renseigné", () => {
    const c = buildSiteConfig({});
    expect(c.name).toBeNull();
    expect(c.displayName).toBe("Complexe hôtelier");
    expect(c.phone).toBeNull();
    expect(c.whatsapp).toBeNull();
    expect(c.email).toBeNull();
    expect(c.fullAddress).toBeNull();
    expect(c.geo).toBeNull();
    expect(c.currency).toBeNull();
    expect(c.rooms.bookingEnabled).toBe(false);
    expect(c.rooms.publicStatus).toBe("coming_soon");
    expect(c.timezone).toBe("UTC");
  });
  it("ne publie jamais des coordonnées GPS non vérifiées", () => {
    expect(buildSiteConfig({ "geo.latitude": "14.7", "geo.longitude": "-17.4", "geo.verified": "false" }).geo).toBeNull();
    expect(buildSiteConfig({ "geo.latitude": "14.7", "geo.longitude": "-17.4", "geo.verified": "true" }).geo).toEqual({ lat: 14.7, lng: -17.4 });
    expect(buildSiteConfig({ "geo.latitude": "999", "geo.longitude": "0", "geo.verified": "true" }).geo).toBeNull();
  });
  it("ignore une devise ou un fuseau invalides", () => {
    const c = buildSiteConfig({ "commerce.currency": "euros", "establishment.timezone": "Mars/Olympus" });
    expect(c.currency).toBeNull();
    expect(c.timezone).toBe("UTC");
  });
  it("n'annonce jamais une réservation « ouverte » en mode démonstration ou si les prérequis manquent", () => {
    const open = { ...buildSiteConfig({ "rooms.public_status": "open" }) };
    const ready = { ready: true, reasons: [] };
    const demo = lodgingStatus({ ...open, mode: "demo" }, ready);
    expect(demo.label).toMatch(/fictive/);
    expect(lodgingStatus({ ...open, mode: "production" }, ready).label).toBe("Réservation en ligne ouverte");
    const notReady = lodgingStatus({ ...open, mode: "production" }, { ready: false, reasons: ["x"] });
    expect(notReady.canBook).toBe(false);
    expect(lodgingStatus(buildSiteConfig({}), ready).label).toBe("Ouverture à venir");
  });
});

describe("formatage", () => {
  it("n'affiche aucun prix sans devise", () => {
    expect(formatMoney(1000, null)).toBeNull();
    expect(formatMoney(null, "XOF")).toBeNull();
    expect(formatMoney(1000, "EUR")).toContain("€");
  });
  it("lit les listes « Titre | Texte »", () => {
    expect(parseTitledList("A | texte a\n\nB|texte b")).toEqual([
      { title: "A", text: "texte a" },
      { title: "B", text: "texte b" },
    ]);
  });
});
