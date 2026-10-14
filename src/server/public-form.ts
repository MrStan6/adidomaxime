import "server-only";
import type { z } from "zod";
import { checkFormGuard } from "./security/form-guard";
import { clientFingerprint } from "./security/request";
import { isRateLimited, recordHit, type RateLimitRule } from "./security/rate-limit";
import { fieldErrors, formDataToObject, type FormState } from "@/lib/validation/common";

/**
 * Traitement commun des formulaires publics : anti-robots, limitation de
 * débit, puis validation serveur avec le même schéma que le navigateur.
 */
export async function parsePublicForm<S extends z.ZodTypeAny>(
  formName: string,
  fd: FormData,
  schema: S,
  rule: RateLimitRule,
  multi: string[] = [],
): Promise<{ ok: true; data: z.infer<S>; fingerprint: string } | { ok: false; state: FormState }> {
  const raw = formDataToObject(fd, multi);
  const values = Object.fromEntries(Object.entries(raw).filter(([k]) => !["form_token", "website_url"].includes(k)));
  const guard = checkFormGuard(formName, fd);
  if (!guard.ok) {
    const message =
      guard.reason === "expired"
        ? "La page est restée ouverte trop longtemps. Rechargez-la puis renvoyez le formulaire."
        : guard.reason === "too_fast"
          ? "Envoi trop rapide. Patientez quelques secondes puis réessayez."
          : "Le formulaire n'a pas pu être vérifié. Rechargez la page puis réessayez.";
    return { ok: false, state: { status: "error", message, values } };
  }
  const fingerprint = await clientFingerprint();
  if (await isRateLimited(rule, fingerprint)) {
    return { ok: false, state: { status: "error", message: "Trop de demandes envoyées depuis cette connexion. Réessayez dans une heure ou contactez-nous par téléphone.", values } };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, state: { status: "error", message: "Certains champs sont à corriger.", errors: fieldErrors(parsed.error), values } };
  }
  await recordHit(rule, fingerprint);
  return { ok: true, data: parsed.data, fingerprint };
}
