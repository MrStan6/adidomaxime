import { headers } from "next/headers";
import { env } from "../env";
import { ipFingerprint } from "./crypto";

/**
 * Adresse IP du client. L'en-tête X-Forwarded-For n'est pris en compte que
 * si TRUST_PROXY=true (sinon il pourrait être falsifié par le client).
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  if (env().TRUST_PROXY) {
    const xff = h.get("x-forwarded-for");
    if (xff) return xff.split(",")[0]!.trim();
    const real = h.get("x-real-ip");
    if (real) return real.trim();
  }
  // Sans proxy de confiance, l'IP réelle n'est pas exposée par Next.js :
  // tous les visiteurs partagent alors la même clé de limitation. En
  // production, placer l'application derrière un proxy et activer TRUST_PROXY.
  return "direct";
}

export async function clientFingerprint(): Promise<string> {
  return ipFingerprint(await clientIp());
}

export async function userAgent(): Promise<string> {
  return ((await headers()).get("user-agent") ?? "").slice(0, 300);
}
