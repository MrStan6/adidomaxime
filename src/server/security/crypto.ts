import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../env";

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export const hmac = (value: string, secret = env().APP_SECRET) =>
  createHmac("sha256", secret).update(value).digest("hex");

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Empreinte d'une adresse IP : on ne conserve jamais l'IP en clair
 * (minimisation des données), seulement un HMAC suffisant pour la
 * limitation de débit.
 */
export const ipFingerprint = (ip: string) => hmac(`ip:${ip}`).slice(0, 32);
