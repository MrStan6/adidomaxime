import { cache } from "react";
import { query, type Queryable, pool } from "./db";
import { env } from "./env";
import { normalizePhone } from "@/lib/contact-links";

/**
 * Paramètres de l'établissement. Règle d'or : une valeur vide signifie
 * « non confirmée » ; l'élément correspondant n'est PAS affiché sur le site.
 */
export async function loadSettings(db: Queryable = pool()): Promise<Record<string, string>> {
  const rows = await query<{ key: string; value: string }>("SELECT key, value FROM settings", [], db);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export type RoomsPublicStatus = "coming_soon" | "to_confirm" | "open";

export type SiteConfig = {
  mode: "demo" | "production";
  siteUrl: string;
  /** Nom confirmé, ou null s'il n'est pas encore défini. */
  name: string | null;
  /** Nom à afficher : nom confirmé ou libellé générique neutre. */
  displayName: string;
  tagline: string | null;
  logoPath: string | null;
  /** Fuseau horaire IANA (UTC si non renseigné). */
  timezone: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: { street: string | null; city: string | null; region: string | null; country: string | null; directions: string | null };
  fullAddress: string | null;
  /** Coordonnées publiées UNIQUEMENT si marquées comme vérifiées. */
  geo: { lat: number; lng: number } | null;
  hours: string | null;
  legal: {
    company_name: string | null;
    legal_form: string | null;
    registration_number: string | null;
    tax_id: string | null;
    publication_director: string | null;
    hosting_provider: string | null;
    validated: boolean;
  };
  currency: string | null;
  paymentMethods: string | null;
  social: { facebook: string | null; instagram: string | null; linkedin: string | null };
  rooms: {
    publicStatus: RoomsPublicStatus;
    bookingEnabled: boolean;
    paymentMode: "on_confirmation" | "online";
    holdMinutes: number;
    maxRoomsPerBooking: number;
  };
  analyticsEnabled: boolean;
};

const v = (s: string | undefined) => {
  const t = (s ?? "").trim();
  return t === "" ? null : t;
};

export function validTimeZone(tz: string | undefined): string | null {
  if (!tz?.trim()) return null;
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone: tz.trim() });
    return tz.trim();
  } catch {
    return null;
  }
}

export function buildSiteConfig(s: Record<string, string>): SiteConfig {
  const e = env();
  const lat = Number(s["geo.latitude"]);
  const lng = Number(s["geo.longitude"]);
  const geoValid =
    s["geo.verified"] === "true" &&
    v(s["geo.latitude"]) !== null &&
    v(s["geo.longitude"]) !== null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180;
  const address = {
    street: v(s["address.street"]),
    city: v(s["address.city"]),
    region: v(s["address.region"]),
    country: v(s["address.country"]),
    directions: v(s["address.directions"]),
  };
  const fullAddress = [address.street, address.city, address.region, address.country].filter(Boolean).join(", ") || null;
  const currency = v(s["commerce.currency"]);
  const publicStatus = (["coming_soon", "to_confirm", "open"] as const).includes(s["rooms.public_status"] as RoomsPublicStatus)
    ? (s["rooms.public_status"] as RoomsPublicStatus)
    : "coming_soon";
  return {
    mode: e.APP_MODE,
    siteUrl: e.SITE_URL.replace(/\/$/, ""),
    name: v(s["establishment.name"]),
    displayName: v(s["establishment.name"]) ?? "Complexe hôtelier",
    tagline: v(s["establishment.tagline"]),
    logoPath: v(s["establishment.logo_path"]),
    timezone: validTimeZone(s["establishment.timezone"]) ?? "UTC",
    phone: normalizePhone(s["contact.phone"]) ? v(s["contact.phone"]) : null,
    whatsapp: normalizePhone(s["contact.whatsapp"])?.startsWith("+") ? v(s["contact.whatsapp"]) : null,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s["contact.email"] ?? "") ? v(s["contact.email"]) : null,
    address,
    fullAddress,
    geo: geoValid ? { lat, lng } : null,
    hours: v(s["hours.reception"]),
    legal: {
      company_name: v(s["legal.company_name"]),
      legal_form: v(s["legal.legal_form"]),
      registration_number: v(s["legal.registration_number"]),
      tax_id: v(s["legal.tax_id"]),
      publication_director: v(s["legal.publication_director"]),
      hosting_provider: v(s["legal.hosting_provider"]),
      validated: s["legal.validated"] === "true",
    },
    currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : null,
    paymentMethods: v(s["commerce.payment_methods"]),
    social: {
      facebook: v(s["social.facebook"]),
      instagram: v(s["social.instagram"]),
      linkedin: v(s["social.linkedin"]),
    },
    rooms: {
      publicStatus,
      bookingEnabled: s["rooms.booking_enabled"] === "true",
      paymentMode: s["rooms.payment_mode"] === "online" ? "online" : "on_confirmation",
      holdMinutes: Math.min(Math.max(Number(s["rooms.hold_minutes"]) || 30, 10), 24 * 60),
      maxRoomsPerBooking: Math.min(Math.max(Number(s["rooms.max_rooms_per_booking"]) || 3, 1), 10),
    },
    analyticsEnabled: s["analytics.enabled"] === "true",
  };
}

/** Configuration du site, mise en cache pour la durée d'une requête. */
export const getSiteConfig = cache(async (): Promise<SiteConfig> => buildSiteConfig(await loadSettings()));

export async function updateSettings(values: Record<string, string>, userId: string, db: Queryable = pool()) {
  for (const [key, value] of Object.entries(values)) {
    await query(
      `INSERT INTO settings (key, value, updated_by, updated_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [key, value, userId],
      db,
    );
  }
}
