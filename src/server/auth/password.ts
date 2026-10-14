import bcrypt from "bcryptjs";
import { z } from "zod";

const COST = 12;

export const hashPassword = (plain: string) => bcrypt.hash(plain, COST);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

/**
 * Empreinte factice calculée une fois : on effectue une comparaison même
 * si le compte n'existe pas, pour ne pas révéler son existence par le temps de réponse.
 */
let dummyHash: Promise<string> | null = null;
export const dummyHashOnce = () => (dummyHash ??= bcrypt.hash("compte-inexistant", COST));

/**
 * Politique de mot de passe : longueur avant tout (12 caractères minimum),
 * plus un minimum de variété.
 */
export const passwordSchema = z
  .string()
  .min(12, "Le mot de passe doit contenir au moins 12 caractères.")
  .max(128, "128 caractères maximum.")
  .refine((p) => /[a-zA-Z]/.test(p) && /\d/.test(p), "Le mot de passe doit contenir au moins une lettre et un chiffre.");
