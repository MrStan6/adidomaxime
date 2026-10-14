import "server-only";
import type { z } from "zod";
import { requirePermission } from "./auth/current-user";
import type { Permission } from "./auth/permissions";
import type { SessionUser } from "./auth/session";
import { fieldErrors, formDataToObject, type FormState } from "@/lib/validation/common";

/**
 * Enveloppe des actions d'administration :
 *  1. vérification de la permission CÔTÉ SERVEUR (redirige sinon) ;
 *  2. validation des données ;
 *  3. erreurs métier converties en message lisible.
 */
export async function adminAction<S extends z.ZodTypeAny>(
  permission: Permission,
  fd: FormData,
  schema: S,
  run: (data: z.infer<S>, user: SessionUser) => Promise<FormState | void>,
  multi: string[] = [],
): Promise<FormState> {
  const user = await requirePermission(permission);
  const parsed = schema.safeParse(formDataToObject(fd, multi));
  if (!parsed.success) return { status: "error", message: "Certains champs sont à corriger.", errors: fieldErrors(parsed.error) };
  try {
    return (await run(parsed.data, user)) ?? { status: "success", message: "Modifications enregistrées." };
  } catch (err) {
    // Les redirections de Next.js doivent être propagées.
    if (err && typeof err === "object" && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_")) throw err;
    if (err instanceof Error && err.constructor !== Error) return { status: "error", message: err.message };
    console.error("[admin] action en erreur :", err);
    return { status: "error", message: err instanceof Error && /violates|constraint/i.test(err.message) ? "Opération refusée : données incohérentes." : "Une erreur technique est survenue. Réessayez." };
  }
}
