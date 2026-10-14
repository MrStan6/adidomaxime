import { hmac, safeEqual } from "./crypto";

/**
 * Protection anti-robots des formulaires publics, sans service tiers :
 *  1. champ « pot de miel » invisible qui doit rester vide ;
 *  2. jeton horodaté signé : refus si le formulaire est soumis en moins de
 *     3 secondes (robot) ou plus de 24 h après affichage.
 */
export const HONEYPOT_FIELD = "website_url";
export const FORM_TOKEN_FIELD = "form_token";

const MIN_FILL_MS = 3_000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function issueFormToken(formName: string, now = Date.now()): string {
  const ts = String(now);
  return `${ts}.${hmac(`form:${formName}:${ts}`).slice(0, 32)}`;
}

export type GuardResult = { ok: true } | { ok: false; reason: "honeypot" | "token" | "too_fast" | "expired" };

export function checkFormGuard(formName: string, fd: FormData, now = Date.now()): GuardResult {
  const honeypot = fd.get(HONEYPOT_FIELD);
  if (typeof honeypot === "string" && honeypot.trim() !== "") return { ok: false, reason: "honeypot" };
  const token = fd.get(FORM_TOKEN_FIELD);
  if (typeof token !== "string") return { ok: false, reason: "token" };
  const [ts, sig] = token.split(".");
  if (!ts || !sig || !/^\d+$/.test(ts)) return { ok: false, reason: "token" };
  const expected = hmac(`form:${formName}:${ts}`).slice(0, 32);
  if (!safeEqual(sig, expected)) return { ok: false, reason: "token" };
  const age = now - Number(ts);
  if (age < MIN_FILL_MS) return { ok: false, reason: "too_fast" };
  if (age > MAX_AGE_MS) return { ok: false, reason: "expired" };
  return { ok: true };
}
