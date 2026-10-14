import { z } from "zod";
import { normalizePhone } from "../contact-links";

/** Utilitaires partagés par les schémas (client et serveur). */

export const trimmed = (max: number) => z.string().trim().max(max, `${max} caractères maximum.`);

export const requiredText = (label: string, min = 2, max = 200) =>
  z
    .string({ required_error: `${label} est obligatoire.` })
    .trim()
    .min(1, `${label} est obligatoire.`)
    .min(min, `${label} : ${min} caractères minimum.`)
    .max(max, `${label} : ${max} caractères maximum.`);

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum.`)
    .optional()
    .transform((v) => (v ? v : undefined));

export const emailField = z
  .string({ required_error: "L'adresse électronique est obligatoire." })
  .trim()
  .toLowerCase()
  .min(1, "L'adresse électronique est obligatoire.")
  .max(160)
  .email("Adresse électronique invalide (exemple : nom@domaine.com).");

export const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(160)
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => !v || z.string().email().safeParse(v).success, "Adresse électronique invalide.");

export const phoneField = z
  .string({ required_error: "Le numéro de téléphone est obligatoire." })
  .trim()
  .min(1, "Le numéro de téléphone est obligatoire.")
  .refine((v) => normalizePhone(v) !== null, "Numéro invalide : indiquez 8 à 15 chiffres, de préférence avec l'indicatif (ex. +XXX…).")
  .transform((v) => normalizePhone(v) as string);

export const optionalPhone = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => !v || normalizePhone(v) !== null, "Numéro invalide.")
  .transform((v) => (v ? (normalizePhone(v) as string) : undefined));

export const dateField = (label: string) =>
  z
    .string({ required_error: `${label} est obligatoire.` })
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} est obligatoire.`)
    .refine((v) => !Number.isNaN(Date.parse(v)), `${label} invalide.`);

export const timeField = (label: string) =>
  z
    .string({ required_error: `${label} est obligatoire.` })
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, `${label} est obligatoire (format HH:MM).`);

export const consentField = z
  .union([z.literal("on"), z.literal("true"), z.boolean()], {
    errorMap: () => ({ message: "Vous devez accepter la politique de confidentialité." }),
  })
  .refine((v) => v === true || v === "on" || v === "true", "Vous devez accepter la politique de confidentialité.");

export const uuidField = z.string().uuid("Identifiant invalide.");

/** Date du jour au format YYYY-MM-DD (UTC). */
export const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Convertit un FormData en objet. Les champs listés dans `multi` sont
 * toujours renvoyés sous forme de tableau ; les fichiers sont ignorés.
 */
export function formDataToObject(fd: FormData, multi: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(fd.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const values = fd.getAll(key).filter((v): v is string => typeof v === "string");
    out[key] = multi.includes(key) ? values.filter(Boolean) : values[0];
  }
  for (const key of multi) if (!(key in out)) out[key] = [];
  return out;
}

export type FieldErrors = Record<string, string>;

/** Aplatit les erreurs zod : un message par champ (le premier). */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** État standard retourné par les actions de formulaire. */
export type FormState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: FieldErrors;
  values?: Record<string, unknown>;
  data?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };
